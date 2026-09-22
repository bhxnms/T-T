import { readEnv } from '../../app-config';
import { exceedsDeclaredLength, readCapped, readCappedText } from '../../utils/cappedFetch';

import { existsSync, promises as fs } from 'fs';
import path from 'path';

/**
 * In-app Help/Wiki content, sourced from the `wiki/**` directory that ships with
 * the app — the same content that CI mirrors to the public GitHub wiki. Reading
 * from disk keeps the help pages pinned to the running version (a v1.2 install
 * shows v1.2 docs, not whatever `main` says) and works offline.
 *
 * If that directory can't be resolved — an unusual layout, an image built without
 * it — we fall back to fetching from the GitHub wiki over the network and caching
 * hourly, so help degrades instead of disappearing. The client never talks to
 * GitHub directly either way; images are proxied through /api/help/asset.
 */

const REPO = 'liketrek/TREK';
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/main/wiki`;
const TTL_MS = 60 * 60 * 1000; // remote fallback only: refresh from GitHub at most hourly
// Remote fallback only: raw.githubusercontent.com is a third party on the
// request path, so it gets a deadline and a size budget like every other
// outbound client. A page or a screenshot over the budget falls through to the
// stale-cache path instead of being buffered whole.
const WIKI_TIMEOUT_MS = 8000;
const WIKI_MAX_BYTES = 2 * 1024 * 1024;
const SLUG_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * Languages the wiki ships in. English is canonical: it sits at the wiki root and
 * is the fallback for every other language, so a partially translated tree still
 * serves complete help instead of 404ing on the pages nobody has translated yet.
 */
const WIKI_LANGS = ['en', 'zh'] as const;
export type WikiLang = (typeof WIKI_LANGS)[number];

/** The language a request asked for, or English. Untrusted: comes from a query param. */
export function normalizeWikiLang(value: unknown): WikiLang {
  const v = String(value ?? '').trim().toLowerCase();
  return (WIKI_LANGS as readonly string[]).includes(v) ? (v as WikiLang) : 'en';
}

/**
 * A wiki file's path within the tree, per language. English sits at the root;
 * every other language gets its own directory (`wiki/zh/Home.md`), matching the
 * `shared/src/i18n/<locale>/` layout the rest of the repo already uses.
 */
function langPath(lang: WikiLang, file: string): string {
  return lang === 'en' ? file : `${lang}/${file}`;
}

/**
 * `server/{src,dist}/nest/help` both sit four levels under the repo root, so this
 * one anchor resolves in dev, a built source install, vitest, and Docker (where
 * the Dockerfile copies `wiki/` to /app/wiki). `process.cwd()` would not — Docker
 * runs the server from /app/server. The depth is counted from THIS file: it was
 * three while the module lived in `src/services`.
 */
const WIKI_DIR = readEnv().paths.wikiDir ?? path.join(__dirname, '..', '..', '..', '..', 'wiki');

/**
 * Probe for the sidebar rather than the bare directory: an empty or half-copied
 * `wiki/` should fall back to GitHub, not serve an empty table of contents.
 *
 * Per language, and cached: the bundled tree is fixed for the process's lifetime,
 * so this is one stat() per language rather than per request. A language with no
 * local directory (an install built before that translation shipped, or a `zh/`
 * nobody created) falls back to GitHub on its own, independently of English.
 */
const localWikiLangs = new Map<WikiLang, boolean>();

function hasLocalWikiFor(lang: WikiLang): boolean {
  const cached = localWikiLangs.get(lang);
  if (cached !== undefined) return cached;
  const present = existsSync(path.join(WIKI_DIR, langPath(lang, '_Sidebar.md')));
  localWikiLangs.set(lang, present);
  return present;
}

if (!hasLocalWikiFor('en')) {
  console.warn(
    `[help] wiki not found at ${WIKI_DIR} — falling back to the GitHub wiki (help may not match this version)`,
  );
}

export class WikiNotFound extends Error {
  status = 404;
}

interface TextEntry {
  data: string;
  ts: number;
}
const textCache = new Map<string, TextEntry>();
const assetCache = new Map<string, { buf: Buffer; type: string; ts: number }>();

const fresh = (ts: number): boolean => Date.now() - ts < TTL_MS;

/** Resolve a path inside the wiki dir, refusing anything that escapes it. */
function resolveInWiki(rel: string): string {
  const root = path.resolve(WIKI_DIR);
  const full = path.resolve(root, rel);
  if (full !== root && !full.startsWith(root + path.sep)) throw new WikiNotFound(rel);
  return full;
}

/** URL-encode a wiki path for the GitHub fallback, one segment at a time.
 *
 * Encoding the whole path would turn `zh/Home.md` into `zh%2FHome.md`, which
 * raw.githubusercontent answers 404 for — the nested language directory has to
 * keep its separators literal. */
function encodeWikiPath(file: string): string {
  return file.split('/').map(encodeURIComponent).join('/');
}

/**
 * Fetch a wiki text file for a language: local disk, or GitHub with
 * cache → stale-cache fallback.
 *
 * A language directory that is missing falls through to English, so a partially
 * translated tree serves the English page rather than 404ing. Only the very last
 * miss (no translated file AND no English one) is a real 404.
 */
async function fetchText(file: string, lang: WikiLang = 'en'): Promise<string> {
  const primary = langPath(lang, file);

  if (hasLocalWikiFor(lang)) {
    try {
      return await fs.readFile(resolveInWiki(primary), 'utf8');
    } catch (err) {
      if (err instanceof WikiNotFound) throw err;
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
      // Not translated (or not this lang's tree) — fall back below rather than 404.
      if (lang === 'en') throw new WikiNotFound(file);
      return fetchText(file, 'en');
    }
  }

  const cached = textCache.get(primary);
  if (cached && fresh(cached.ts)) return cached.data;
  try {
    const res = await fetch(`${RAW_BASE}/${encodeWikiPath(primary)}`, {
      headers: { 'User-Agent': 'TREK-help', Accept: 'text/plain' },
      signal: AbortSignal.timeout(WIKI_TIMEOUT_MS),
    });
    if (res.ok && !exceedsDeclaredLength(res, WIKI_MAX_BYTES)) {
      const { text, truncated } = await readCappedText(res, WIKI_MAX_BYTES);
      if (truncated) throw new Error('wiki page exceeds size limit');
      textCache.set(primary, { data: text, ts: Date.now() });
      return text;
    }
    if (res.status === 404) {
      // Same rule as the local branch: an untranslated page falls back to English.
      if (lang !== 'en') return fetchText(file, 'en');
      throw new WikiNotFound(file);
    }
  } catch (err) {
    if (err instanceof WikiNotFound) throw err;
    // network/parse error — fall through to stale cache
  }
  if (cached) return cached.data; // serve stale rather than fail
  throw new WikiNotFound(file);
}

export interface WikiNavItem {
  title: string;
  slug: string;
}
export interface WikiNavSection {
  title: string;
  pages: WikiNavItem[];
}

/** Parse the wiki `_Sidebar.md` into ordered sections of `[[Title|Slug]]` links. */
function parseSidebar(md: string): WikiNavSection[] {
  const sections: WikiNavSection[] = [];
  let current: WikiNavSection | null = null;
  for (const raw of md.split('\n')) {
    // The title, trimmed: a run that starts and ends on a non-space, or a single
    // character (a heading whose body is only spaces still opens a section, the way
    // `(.+?)\s*$` did). Spelled out so no two quantifiers compete for the same
    // spaces — that pairing backtracks quadratically on a long ragged line.
    const heading = raw.match(/^#{1,4}\s+(\S.*\S|.)\s*$/);
    if (heading) {
      current = { title: heading[1].replace(/[*_`]/g, '').trim(), pages: [] };
      sections.push(current);
      continue;
    }
    const link = raw.match(/^\s*[-*]\s*\[\[([^\]]+)\]\]/);
    if (link) {
      if (!current) {
        current = { title: '', pages: [] };
        sections.push(current);
      }
      const inner = link[1];
      const [title, slugRaw] = inner.includes('|') ? inner.split('|') : [inner, inner];
      const slug = slugRaw.trim().replace(/\s+/g, '-');
      if (SLUG_RE.test(slug)) current.pages.push({ title: title.trim(), slug });
    }
  }
  return sections.filter((s) => s.pages.length > 0);
}

/**
 * Rewrite GitHub-wiki `[[..]]` links to /help routes and proxy relative images.
 *
 * `lang` rides along on both, so following a link inside a translated page keeps
 * the reader in that language instead of dropping them back into English. It is
 * carried as a query param rather than a route segment because the client route
 * is `/help/:slug` and the sidebar/anchors already key off the slug alone.
 */
function processMarkdown(md: string, lang: WikiLang = 'en'): string {
  const suffix = lang === 'en' ? '' : `?lang=${lang}`;
  // Strip HTML comments (e.g. `<!-- TODO: screenshot … -->` placeholders) — the
  // markdown renderer would otherwise surface them as raw text.
  let out = md.replace(/<!--[\s\S]*?-->/g, '');
  out = out.replace(/\[\[([^\]]+)\]\]/g, (_m, inner: string) => {
    const [titleRaw, slugRaw] = inner.includes('|') ? inner.split('|') : [inner, inner];
    const slug = slugRaw.trim().replace(/\s+/g, '-');
    // `[[Plugin Development#talking-to-plugins|Plugin-Development]]` must not
    // render its anchor as visible link text.
    const [title, anchor] = titleRaw.includes('#') ? titleRaw.split('#') : [titleRaw, ''];
    const hash = anchor ? `#${anchor.trim()}` : '';
    return `[${title.trim()}](/help/${slug}${suffix}${hash})`;
  });
  // The optional title after the URL (`![a](u "t")`) has to start on whitespace,
  // so it cannot compete with the URL group for the same characters.
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)(\s[^)]*)?\)/g, (m, alt: string, url: string) => {
    if (/^https?:\/\//i.test(url) || url.startsWith('/api/help/asset/')) return m;
    const clean = url.replace(/^\.?\//, '').replace(/^wiki\//, '');
    // The asset endpoint takes the language itself, so a translated page's
    // screenshots come from that language's asset directory (with an English
    // fallback for the few images that are language-neutral, e.g. Portainer's UI).
    return `![${alt}](/api/help/asset/${clean}${suffix})`;
  });
  // Bare relative links — `[Currencies](Currencies)`, the native GitHub-wiki
  // spelling and by far the most common in these pages (455 of them across 81
  // files, against 114 `[[..]]` links). GitHub resolves them against the wiki
  // root; in-app they used to fall through to HelpPage's external-link branch
  // and open a dead tab. Rewriting them here fixes every page at once and keeps
  // the source GitHub-compatible, so contributors can keep writing either form.
  //
  // Runs last: `[[..]]` links and images have already become absolute paths by
  // this point, so the leading-slash guard skips them.
  out = outsideCode(out, (segment) =>
    segment.replace(/(^|[^!])\[([^\]]+)\]\(([^)\s]+)\)/g, (m, prefix: string, text: string, url: string) => {
      if (/^(https?:|mailto:|tel:|#|\/)/i.test(url)) return m;
      const [pageRaw, anchor] = url.includes('#') ? url.split('#') : [url, ''];
      const page = pageRaw
        .replace(/^\.?\//, '')
        .replace(/\.md$/i, '')
        .trim();
      if (!page || !SLUG_RE.test(page)) return m;
      return `${prefix}[${text}](/help/${page}${suffix}${anchor ? `#${anchor}` : ''})`;
    }),
  );
  return out;
}

/**
 * Apply `fn` to the parts of the markdown that are NOT code, leaving fenced
 * blocks and inline spans untouched.
 *
 * Without this the link rewriter corrupts code samples: Plugin-Development.md
 * documents `actions[key](ctx)`, which reads as a markdown link and would be
 * rewritten to `actions[key](/help/ctx)` inside what is supposed to be a
 * verbatim snippet.
 */
function outsideCode(md: string, fn: (segment: string) => string): string {
  // Alternation order matters: fenced blocks first, so a ``` fence containing
  // backticks is consumed whole rather than being split by the inline rule.
  const CODE = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g;
  const parts = md.split(CODE);
  // split() with a capturing group yields [text, code, text, code, …].
  return parts.map((part, i) => (i % 2 === 1 ? part : fn(part))).join('');
}

function extractTitle(md: string, fallback: string): string {
  // Same shape as the sidebar heading above — see the note there.
  const h1 = md.match(/^#\s+(\S.*\S|.)\s*$/m);
  return h1 ? h1[1].replace(/[*_`]/g, '').trim() : fallback.replaceAll('-', ' ');
}

export interface WikiPage {
  slug: string;
  title: string;
  markdown: string;
}

/** True when help is served from the bundled wiki rather than fetched from GitHub. */
export const isLocalWiki = (lang: WikiLang = 'en'): boolean => hasLocalWikiFor(lang);

export async function getWikiIndex(lang: WikiLang = 'en'): Promise<{ sections: WikiNavSection[] }> {
  const md = await fetchText('_Sidebar.md', lang);
  return { sections: parseSidebar(md) };
}

export async function getWikiPage(slug: string, lang: WikiLang = 'en'): Promise<WikiPage> {
  if (!SLUG_RE.test(slug)) throw new WikiNotFound(slug);
  const md = await fetchText(`${slug}.md`, lang);
  return { slug, title: extractTitle(md, slug), markdown: processMarkdown(md, lang) };
}

const ASSET_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
};

/** Read a wiki image from disk, or proxy it from GitHub so the browser never calls it directly. */
export async function getWikiAsset(assetPath: string, lang: WikiLang = 'en'): Promise<{ buf: Buffer; type: string }> {
  // Defend against traversal; allow nested image folders.
  if (assetPath.includes('..') || !/^[A-Za-z0-9/._-]+$/.test(assetPath)) throw new WikiNotFound(assetPath);
  const ext = path.extname(assetPath).toLowerCase();
  const type = ASSET_TYPES[ext];
  if (!type) throw new WikiNotFound(assetPath);

  // The path arrives as written in the markdown (`assets/Atlas.png`), relative to
  // the page's own language tree. A language-neutral asset — the Portainer UI
  // screenshots, which we cannot re-shoot — lives only in the English tree, so a
  // miss in `zh/assets/` falls back to `assets/` rather than breaking the page.
  // Plain file reads, no directory probing: ENOENT simply means "try the next".
  const candidates = lang === 'en' ? [assetPath] : [langPath(lang, assetPath), assetPath];

  for (const rel of candidates) {
    try {
      // resolveInWiki re-checks containment: the regex above is a filter, this is the boundary.
      const buf = await fs.readFile(resolveInWiki(rel));
      return { buf, type };
    } catch (err) {
      if (err instanceof WikiNotFound) throw err;
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }

  const cached = assetCache.get(assetPath);
  if (cached && fresh(cached.ts)) return { buf: cached.buf, type: cached.type };
  try {
    const res = await fetch(`${RAW_BASE}/${encodeWikiPath(candidates[0])}`, {
      headers: { 'User-Agent': 'TREK-help' },
      signal: AbortSignal.timeout(WIKI_TIMEOUT_MS),
    });
    if (res.ok && !exceedsDeclaredLength(res, WIKI_MAX_BYTES)) {
      const { bytes: buf, truncated } = await readCapped(res, WIKI_MAX_BYTES);
      if (truncated) throw new Error('wiki asset exceeds size limit');
      assetCache.set(assetPath, { buf, type, ts: Date.now() });
      return { buf, type };
    }
  } catch {
    /* fall through */
  }
  if (cached) return { buf: cached.buf, type: cached.type };
  throw new WikiNotFound(assetPath);
}
