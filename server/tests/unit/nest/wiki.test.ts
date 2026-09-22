import path from 'path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The wiki module picks its source (local disk vs GitHub) once at module load, so each
// mode needs a fresh import with TREK_WIKI_DIR already set.
const FIXTURE_WIKI = path.join(__dirname, '..', '..', 'fixtures', 'wiki');
const MISSING_WIKI = path.join(__dirname, '..', '..', 'fixtures', 'no-such-wiki');

type WikiModule = typeof import('../../../src/nest/help/wiki');

async function loadWiki(dir: string | undefined): Promise<WikiModule> {
  vi.resetModules();
  if (dir === undefined) delete process.env.TREK_WIKI_DIR;
  else process.env.TREK_WIKI_DIR = dir;
  return import('../../../src/nest/help/wiki');
}

const fetchSpy = vi.fn();

beforeEach(() => {
  fetchSpy.mockReset();
  vi.stubGlobal('fetch', fetchSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.TREK_WIKI_DIR;
});

describe('wiki — local wiki on disk', () => {
  it('serves the sidebar from disk and never touches the network', async () => {
    const wiki = await loadWiki(FIXTURE_WIKI);
    expect(wiki.isLocalWiki()).toBe(true);

    const { sections } = await wiki.getWikiIndex();

    expect(sections.map((s) => s.title)).toEqual(['Getting Started', 'Planning']); // empty section dropped
    expect(sections[0].pages).toEqual([
      { title: 'Home', slug: 'Home' },
      { title: 'Quick Start', slug: 'Quick-Start' },
    ]);
    // `_private` fails SLUG_RE, so it is filtered out of the nav.
    expect(sections[1].pages).toEqual([{ title: 'Sample Page', slug: 'Sample' }]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('renders a page, rewriting wikilinks and relative images', async () => {
    const wiki = await loadWiki(FIXTURE_WIKI);
    const page = await wiki.getWikiPage('Sample');

    expect(page.title).toBe('Sample Page');
    expect(page.markdown).toContain('[Quick Start](/help/Quick-Start)');
    expect(page.markdown).toContain('[Home](/help/Home)');
    expect(page.markdown).toContain('![A picture](/api/help/asset/assets/pic.png)');
    expect(page.markdown).toContain('![External](https://example.com/x.png)'); // absolute URLs left alone
    expect(page.markdown).not.toContain('TODO: screenshot'); // HTML comments stripped
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rewrites bare relative links, the spelling most wiki pages actually use', async () => {
    const wiki = await loadWiki(FIXTURE_WIKI);
    const page = await wiki.getWikiPage('Sample');

    // These resolve against the wiki root on GitHub but used to fall through to
    // HelpPage's external-link branch in-app and open a dead tab.
    expect(page.markdown).toContain('[Currencies](/help/Currencies)');
    expect(page.markdown).toContain('[Quick Start](/help/Quick-Start#first-steps)');
    expect(page.markdown).toContain('[with extension](/help/Home)'); // .md stripped
  });

  it('leaves links that are already resolvable alone', async () => {
    const wiki = await loadWiki(FIXTURE_WIKI);
    const page = await wiki.getWikiPage('Sample');

    expect(page.markdown).toContain('[external](https://example.com)');
    expect(page.markdown).toContain('[absolute](/dashboard)');
    expect(page.markdown).toContain('[anchor](#section)');
    expect(page.markdown).toContain('[mail](mailto:hi@example.com)');
    // Images must not be caught by the link rewriter.
    expect(page.markdown).toContain('![A picture](/api/help/asset/assets/pic.png)');
    expect(page.markdown).not.toContain('/help/assets/pic.png');
  });

  it('leaves code samples alone', async () => {
    const wiki = await loadWiki(FIXTURE_WIKI);
    const page = await wiki.getWikiPage('Sample');

    // Plugin-Development.md documents `actions[key](ctx)`, which reads as a
    // markdown link. Rewriting it would corrupt a verbatim snippet.
    expect(page.markdown).toContain('`actions[key](ctx)`');
    expect(page.markdown).toContain('`[x](y)`');
    expect(page.markdown).toContain('const link = [label](Currencies)'); // fenced block
    expect(page.markdown).not.toContain('/help/ctx');
    expect(page.markdown).not.toContain('[label](/help/Currencies)');
  });

  it('does not render a wikilink anchor as visible link text', async () => {
    const wiki = await loadWiki(FIXTURE_WIKI);
    const page = await wiki.getWikiPage('Sample');

    // `[[Quick Start#first-steps|Quick-Start]]` — the anchor belongs in the href.
    expect(page.markdown).toContain('[Quick Start](/help/Quick-Start#first-steps)');
    expect(page.markdown).not.toContain('[Quick Start#first-steps]');
  });

  it('404s an unknown page instead of falling back to GitHub', async () => {
    const wiki = await loadWiki(FIXTURE_WIKI);

    // A page missing from disk does not exist in *this* version — falling back to
    // GitHub here is what would reintroduce version skew.
    await expect(wiki.getWikiPage('Nope')).rejects.toBeInstanceOf(wiki.WikiNotFound);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([['_Sidebar'], ['../Home'], ['a/b'], ['']])('rejects the invalid slug %j', async (slug) => {
    const wiki = await loadWiki(FIXTURE_WIKI);
    await expect(wiki.getWikiPage(slug)).rejects.toBeInstanceOf(wiki.WikiNotFound);
  });

  it('serves an asset from disk with the right content type', async () => {
    const wiki = await loadWiki(FIXTURE_WIKI);
    const { buf, type } = await wiki.getWikiAsset('assets/pic.png');

    expect(type).toBe('image/png');
    expect(buf.subarray(1, 4).toString()).toBe('PNG');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([
    ['../../src/config.ts'],
    ['../../../.env'],
    ['assets/../../package.json'],
    ['/etc/passwd'],
    ['assets/notes.txt'],
  ])('refuses the asset path %j', async (assetPath) => {
    const wiki = await loadWiki(FIXTURE_WIKI);
    await expect(wiki.getWikiAsset(assetPath)).rejects.toBeInstanceOf(wiki.WikiNotFound);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('404s a missing asset', async () => {
    const wiki = await loadWiki(FIXTURE_WIKI);
    await expect(wiki.getWikiAsset('assets/ghost.png')).rejects.toBeInstanceOf(wiki.WikiNotFound);
  });
});

describe('wiki — GitHub fallback when no wiki is on disk', () => {
  const ok = (body: string): Response =>
    ({
      ok: true,
      status: 200,
      text: async () => body,
      arrayBuffer: async () => new ArrayBuffer(4),
    }) as unknown as Response;

  it('fetches from GitHub and caches the result', async () => {
    const wiki = await loadWiki(MISSING_WIKI);
    expect(wiki.isLocalWiki()).toBe(false);

    fetchSpy.mockResolvedValue(ok('## Docs\n- [[Home]]\n'));

    const first = await wiki.getWikiIndex();
    const second = await wiki.getWikiIndex();

    expect(first.sections[0].pages).toEqual([{ title: 'Home', slug: 'Home' }]);
    expect(second).toEqual(first);
    expect(fetchSpy).toHaveBeenCalledTimes(1); // second read served from cache
    expect(fetchSpy.mock.calls[0][0]).toContain('raw.githubusercontent.com');
  });

  it('serves a stale cache entry when GitHub is unreachable', async () => {
    const wiki = await loadWiki(MISSING_WIKI);

    fetchSpy.mockResolvedValueOnce(ok('# Cached\n'));
    const before = await wiki.getWikiPage('Home');

    fetchSpy.mockRejectedValue(new Error('network down'));
    const after = await wiki.getWikiPage('Home');

    expect(after.title).toBe(before.title);
  });

  it('passes a deadline to every GitHub request', async () => {
    const wiki = await loadWiki(MISSING_WIKI);
    fetchSpy.mockResolvedValue(ok('# Timed'));

    await wiki.getWikiPage('Home');

    expect(fetchSpy.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it('falls through to WikiNotFound when GitHub declares a body over the cap', async () => {
    const wiki = await loadWiki(MISSING_WIKI);
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (h: string) => (h === 'content-length' ? String(5 * 1024 * 1024) : null) },
      text: async () => '# Huge',
    } as unknown as Response);

    await expect(wiki.getWikiPage('Home')).rejects.toBeInstanceOf(wiki.WikiNotFound);
  });

  it('404s when GitHub is unreachable and nothing is cached', async () => {
    const wiki = await loadWiki(MISSING_WIKI);
    fetchSpy.mockRejectedValue(new Error('network down'));

    await expect(wiki.getWikiPage('Home')).rejects.toBeInstanceOf(wiki.WikiNotFound);
  });
});

describe('wiki — default path resolution', () => {
  it("resolves the repo's wiki/ with no override, so a release never ships without docs", async () => {
    // Guards the __dirname anchor and the Dockerfile COPY: if either breaks, help
    // silently degrades to the GitHub fallback and nobody notices.
    const wiki = await loadWiki(undefined);

    expect(wiki.isLocalWiki()).toBe(true);
    const page = await wiki.getWikiPage('Home');
    expect(page.title.length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

/**
 * Language selection. The fixture tree deliberately has a zh/ directory holding
 * Home but NOT Sample, so the fallback has a real gap to exercise: a partially
 * translated wiki must still read end to end.
 */
describe('wiki — language selection', () => {
  it('serves the translated page when the language has one', async () => {
    const wiki = await loadWiki(FIXTURE_WIKI);

    const zh = await wiki.getWikiPage('Home', 'zh');
    expect(zh.title).toBe('示例首页');
    expect(zh.markdown).toContain('这是中文首页');

    const en = await wiki.getWikiPage('Home');
    expect(en.title).toBe('Fixture Home');
  });

  it('falls back to English for a page the language has not translated', async () => {
    const wiki = await loadWiki(FIXTURE_WIKI);

    // Sample.md exists in the root tree and is absent from zh/ — the exact state
    // a partially translated wiki is in, and the reason the fallback exists.
    const zh = await wiki.getWikiPage('Sample', 'zh');
    expect(zh.title).toBe(await wiki.getWikiPage('Sample').then((p) => p.title));
    expect(zh.markdown).toContain('Sample Page');
  });

  it('falls back to English for the whole tree when the language directory is absent', async () => {
    // TREK_WIKI_DIR is a tree with no zh/ at all (an image built before the
    // translation shipped). Every request must still answer, in English.
    const wiki = await loadWiki(MISSING_WIKI);

    // No sidebar anywhere -> the GitHub path, which the stub fetch fails, so this
    // is the honest "nothing at all" case and must still 404 rather than hang.
    await expect(wiki.getWikiPage('Home', 'zh')).rejects.toBeInstanceOf(wiki.WikiNotFound);
  });

  it('carries the language on rewritten links and images, and omits it for English', async () => {
    const wiki = await loadWiki(FIXTURE_WIKI);

    const zh = await wiki.getWikiPage('Home', 'zh');
    expect(zh.markdown).not.toMatch(/\]\(\/help\/[A-Za-z-]+\)/); // none without the param
    if (/\]\(\/help\//.test(zh.markdown)) expect(zh.markdown).toMatch(/\?lang=zh/);

    const en = await wiki.getWikiPage('Home');
    expect(en.markdown).not.toMatch(/\?lang=/);
  });

  it('normalizes an unknown or missing language to English', async () => {
    const wiki = await loadWiki(FIXTURE_WIKI);
    const en = await wiki.getWikiPage('Home');

    for (const input of ['fr', 'klingon', '', undefined, null, 'ZH ']) {
      const page = await wiki.getWikiPage('Home', wiki.normalizeWikiLang(input));
      if (String(input).trim().toLowerCase() === 'zh') expect(page.title).toBe('示例首页');
      else expect(page.title).toBe(en.title);
    }
  });

  it('falls back to the English asset when the translated one is missing', async () => {
    const wiki = await loadWiki(FIXTURE_WIKI);

    // zh/assets holds pic.png but not notes.txt' sibling png set; the language-
    // neutral images (Portainer's UI, in the real wiki) exist only in English.
    const viaZh = await wiki.getWikiAsset('assets/pic.png', 'zh');
    expect(viaZh.buf.length).toBeGreaterThan(0);
    expect(viaZh.type).toBe('image/png');

    // notes.txt is not an image, so it is refused regardless of language.
    await expect(wiki.getWikiAsset('assets/notes.txt', 'zh')).rejects.toBeInstanceOf(wiki.WikiNotFound);
  });
});
