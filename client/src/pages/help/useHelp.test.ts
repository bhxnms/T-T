// FE-PAGE-HELP-001 to FE-PAGE-HELP-012, plus FE-PAGE-HELP-013..016 for the
// wiki language switcher.
import { act, renderHook, waitFor } from '@testing-library/react';
import { helpApi, type HelpNavSection, type HelpPageData } from '../../api/client';
import { useHelp } from './useHelp';

let routeParams: { slug?: string } = {};
/** Mirrors what the router hands back; the hook writes ?lang= into it. */
let searchParams = new URLSearchParams();
const setSearchParams = vi.fn((next: URLSearchParams) => {
  searchParams = next;
});
/** The URL fragment and navigation key the router reports, for anchor jumps. */
let locationHash = '';
let locationKey = 'default';
let appLanguage = 'en';
vi.mock('react-router', () => ({
  useParams: () => routeParams,
  useSearchParams: () => [searchParams, setSearchParams],
  useLocation: () => ({ hash: locationHash, key: locationKey, pathname: '/help', search: '', state: null }),
}));
vi.mock('../../i18n', () => ({
  useTranslation: () => ({ t: (k: string) => k, language: appLanguage }),
}));

const SECTIONS: HelpNavSection[] = [
  { title: 'Getting started', pages: [{ slug: 'Home', title: 'Welcome' }, { slug: 'Install', title: 'Installation' }] },
  { title: 'Guides', pages: [{ slug: 'Trips', title: 'Planning a trip' }, { slug: 'Budget', title: 'Splitting costs' }] },
] as HelpNavSection[];

const PAGE = { slug: 'Home', title: 'Welcome', body: '# Welcome' } as unknown as HelpPageData;

beforeEach(() => {
  routeParams = {};
  searchParams = new URLSearchParams();
  locationHash = '';
  locationKey = 'default';
  appLanguage = 'en';
  setSearchParams.mockClear();
  // jsdom has no scrollTo and logs a "Not implemented" error for every call.
  vi.stubGlobal('scrollTo', vi.fn());
  vi.spyOn(helpApi, 'index').mockResolvedValue({ sections: SECTIONS } as never);
  vi.spyOn(helpApi, 'page').mockResolvedValue(PAGE as never);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('useHelp', () => {
  it('FE-PAGE-HELP-001: loads the navigation and the landing page', async () => {
    const { result } = renderHook(() => useHelp());
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.filtered).toEqual(SECTIONS);
    expect(result.current.page).toEqual(PAGE);
    expect(result.current.pageError).toBe(false);
  });

  it('FE-PAGE-HELP-002: defaults to the first page in the index when the route has no slug', async () => {
    renderHook(() => useHelp());
    await waitFor(() => expect(helpApi.page).toHaveBeenLastCalledWith('Home', 'en'));
  });

  it('FE-PAGE-HELP-003: falls back to the Home slug while the index is still loading', () => {
    renderHook(() => useHelp());
    expect(helpApi.page).toHaveBeenCalledWith('Home', 'en');
  });

  it('FE-PAGE-HELP-004: honours the slug from the route', async () => {
    routeParams = { slug: 'Budget' };
    const { result } = renderHook(() => useHelp());

    await waitFor(() => expect(result.current.activeSlug).toBe('Budget'));
    expect(helpApi.page).toHaveBeenCalledWith('Budget', 'en');
  });

  it('FE-PAGE-HELP-005: keeps an empty navigation when the index request fails', async () => {
    vi.mocked(helpApi.index).mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useHelp());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.filtered).toEqual([]);
  });

  it('FE-PAGE-HELP-006: flags a page that could not be fetched', async () => {
    vi.mocked(helpApi.page).mockRejectedValue(new Error('404'));
    const { result } = renderHook(() => useHelp());

    await waitFor(() => expect(result.current.pageError).toBe(true));
    expect(result.current.loading).toBe(false);
    expect(result.current.page).toBeNull();
  });

  it('FE-PAGE-HELP-007: filters the navigation by page title, case-insensitively', async () => {
    const { result } = renderHook(() => useHelp());
    await waitFor(() => expect(result.current.filtered).toHaveLength(2));

    act(() => result.current.setQuery('  PLAN  '));

    expect(result.current.filtered).toEqual([
      { title: 'Guides', pages: [{ slug: 'Trips', title: 'Planning a trip' }] },
    ]);
  });

  it('FE-PAGE-HELP-008: drops sections that no longer have a matching page', async () => {
    const { result } = renderHook(() => useHelp());
    await waitFor(() => expect(result.current.filtered).toHaveLength(2));

    act(() => result.current.setQuery('zzz'));
    expect(result.current.filtered).toEqual([]);
  });

  it('FE-PAGE-HELP-009: an empty query restores the full navigation', async () => {
    const { result } = renderHook(() => useHelp());
    await waitFor(() => expect(result.current.filtered).toHaveLength(2));

    act(() => result.current.setQuery('install'));
    expect(result.current.filtered).toHaveLength(1);

    act(() => result.current.setQuery('   '));
    expect(result.current.filtered).toEqual(SECTIONS);
  });

  it('FE-PAGE-HELP-010: scrolls back to the top and closes the mobile nav on navigation', async () => {
    const scrollTo = vi.mocked(window.scrollTo);
    const { result, rerender } = renderHook(() => useHelp());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setNavOpen(true));
    expect(result.current.navOpen).toBe(true);

    routeParams = { slug: 'Trips' };
    rerender();

    await waitFor(() => expect(result.current.navOpen).toBe(false));
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
  });

  it('FE-PAGE-HELP-011: scrolls the content pane when the ref is attached', async () => {
    const { result, rerender } = renderHook(() => useHelp());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const scrollTo = vi.fn();
    (result.current.contentRef as { current: unknown }).current = { scrollTo };

    routeParams = { slug: 'Install' };
    rerender();

    await waitFor(() => expect(scrollTo).toHaveBeenCalledWith({ top: 0 }));
  });

  it('FE-PAGE-HELP-018: a detached sidebar keeps the offset it last held, and restores it', async () => {
    // The route boundary in App.tsx keys on pathname, so HelpPage unmounts on
    // every page change and a detached node reports scrollTop === 0. Persisting
    // from the node at cleanup erased the position on the very navigation it was
    // supposed to survive. Simulate the real sequence: scroll, navigate, remount.
    const KEY = 'tt_wiki_nav_scroll_en';
    const makeNav = (top: number, height = 3000, client = 600) => {
      const nav = document.createElement('div');
      Object.defineProperty(nav, 'scrollHeight', { value: height, configurable: true });
      Object.defineProperty(nav, 'clientHeight', { value: client, configurable: true });
      let value = top;
      Object.defineProperty(nav, 'scrollTop', {
        // jsdom keeps a plain scrollTop property across a detach, so the mock has
        // to model the browser instead: a detached element reports 0. Without
        // that the test would pass against the very bug it exists to catch.
        get: () => (nav.isConnected ? value : 0),
        set: (v: number) => { value = v; },
        configurable: true,
      });
      return nav;
    };

    // --- first mount while the reader scrolls
    const first = makeNav(0);
    document.body.appendChild(first);
    const view1 = renderHook(() => {
      const help = useHelp();
      // The real component attaches this ref during render, before the effect
      // that wires the listener — so the test has to do the same.
      (help.navScrollRef as { current: unknown }).current = first;
      return help;
    });
    await waitFor(() => expect(view1.result.current.filtered).toHaveLength(2));

    first.scrollTop = 640;
    first.dispatchEvent(new Event('scroll'));
    expect(sessionStorage.getItem(KEY)).toBe('640');

    // --- navigate away: React detaches the node, then the cleanup runs
    first.remove();
    view1.unmount();
    expect(sessionStorage.getItem(KEY)).toBe('640'); // not clobbered to 0

    // --- next page: a fresh, empty node gets the saved offset once the list lands
    const second = makeNav(0);
    document.body.appendChild(second);
    const view2 = renderHook(() => {
      const help = useHelp();
      (help.navScrollRef as { current: unknown }).current = second;
      return help;
    });
    await waitFor(() => expect(view2.result.current.filtered).toHaveLength(2));

    // The restore rides the sections landing, so give it the same tick.
    await waitFor(() => expect(second.scrollTop).toBe(640));
    second.remove();
    view2.unmount();
  });

  it('FE-PAGE-HELP-019: a cross-page anchor scrolls to the section it names', async () => {
    // `](Atlas#check-ins)` arrives as a client-side route change, and pushState
    // does not scroll to a fragment — so the hook has to. Before this, the link
    // landed at the top of the target page, because the scroll-to-top in the
    // fetch effect fired last.
    const heading = document.createElement('h2');
    heading.id = 'check-ins';
    const scrollIntoView = vi.fn();
    heading.scrollIntoView = scrollIntoView;
    document.body.appendChild(heading);

    locationHash = '#check-ins';
    routeParams = { slug: 'Atlas' };
    const { result } = renderHook(() => useHelp());

    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());

    heading.remove();
  });

  it('FE-PAGE-HELP-024: the jump is re-applied while the layout keeps resizing', async () => {
    // One call is not enough. Measured in a real browser: the same call landed the
    // heading at 96px once the page had settled but at 745px when it ran during
    // the first commit, because the wiki's images load afterwards and push
    // everything below them down. The hook therefore keeps correcting while the
    // content resizes.
    const heading = document.createElement('h2');
    heading.id = 'check-ins';
    const scrollIntoView = vi.fn();
    heading.scrollIntoView = scrollIntoView;
    // The hook observes the heading's parent — the prose container the wiki's
    // images grow — so the heading has to be attached to something.
    const article = document.createElement('article');
    article.appendChild(heading);
    document.body.appendChild(article);

    const observers: (() => void)[] = [];
    class FakeResizeObserver {
      constructor(private cb: () => void) {
        observers.push(() => this.cb());
      }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);

    locationHash = '#check-ins';
    const { result } = renderHook(() => useHelp());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const afterFirstPaint = scrollIntoView.mock.calls.length;
    expect(afterFirstPaint).toBeGreaterThan(0);
    expect(observers.length).toBeGreaterThan(0);

    // Simulate the images arriving and the content growing.
    act(() => observers.forEach((fire) => fire()));

    expect(scrollIntoView.mock.calls.length).toBeGreaterThan(afterFirstPaint);
    article.remove();
  });

  it('FE-PAGE-HELP-025: a reader who scrolls away is not dragged back', async () => {
    // The correction loop runs for a few seconds, which is long enough to fight
    // someone who started reading. The first sign of manual scrolling ends it.
    const heading = document.createElement('h2');
    heading.id = 'check-ins';
    const scrollIntoView = vi.fn();
    heading.scrollIntoView = scrollIntoView;
    document.body.appendChild(heading);

    const observers: (() => void)[] = [];
    class FakeResizeObserver {
      constructor(private cb: () => void) {
        observers.push(() => this.cb());
      }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);

    locationHash = '#check-ins';
    const { result } = renderHook(() => useHelp());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => window.dispatchEvent(new Event('wheel')));
    const afterWheel = scrollIntoView.mock.calls.length;

    act(() => observers.forEach((fire) => fire()));

    expect(scrollIntoView.mock.calls.length).toBe(afterWheel);
    heading.remove();
  });

  it('FE-PAGE-HELP-020: a percent-encoded anchor resolves to the decoded heading id', async () => {
    // Browsers encode non-ASCII fragments, so the Chinese wiki's `#打卡点` reaches
    // the hook as `%E6%89%93%E5%8D%A1%E7%82%B9`. Matching the raw fragment against
    // an element id would always miss.
    const heading = document.createElement('h2');
    heading.id = '打卡点';
    const scrollIntoView = vi.fn();
    heading.scrollIntoView = scrollIntoView;
    document.body.appendChild(heading);

    locationHash = '#%E6%89%93%E5%8D%A1%E7%82%B9';
    routeParams = { slug: 'Atlas' };
    const { result } = renderHook(() => useHelp());

    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());

    heading.remove();
  });

  it('FE-PAGE-HELP-021: a plain page load still starts at the top', async () => {
    // The anchor step must not turn every navigation into a scroll: without a
    // fragment the reader keeps the top of the page.
    const heading = document.createElement('h2');
    heading.id = 'check-ins';
    const scrollIntoView = vi.fn();
    heading.scrollIntoView = scrollIntoView;
    document.body.appendChild(heading);

    locationHash = '';
    const { result } = renderHook(() => useHelp());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(scrollIntoView).not.toHaveBeenCalled();

    heading.remove();
  });

  it('FE-PAGE-HELP-022: an anchor with no matching heading is ignored, not an error', async () => {
    // Stale or hand-written anchors are normal in a wiki that is edited in
    // markdown; the reader falls back to the top of the page.
    locationHash = '#no-such-section';
    const { result } = renderHook(() => useHelp());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.pageError).toBe(false);
  });

  it('FE-PAGE-HELP-023: follows the fragment when only the hash changes', async () => {
    // A same-page anchor (a table of contents, say) changes nothing but the
    // fragment; the effect has to re-run on that alone.
    const heading = document.createElement('h2');
    heading.id = 'installation';
    const scrollIntoView = vi.fn();
    heading.scrollIntoView = scrollIntoView;
    document.body.appendChild(heading);

    locationHash = '';
    const { result, rerender } = renderHook(() => useHelp());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(scrollIntoView).not.toHaveBeenCalled();

    locationHash = '#installation';
    rerender();

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());

    heading.remove();
  });

  it('FE-PAGE-HELP-012: a page arriving after a slug change does not overwrite the newer one', async () => {
    let resolveFirst: ((p: HelpPageData) => void) | undefined;
    vi.mocked(helpApi.page).mockImplementationOnce(
      () => new Promise(res => { resolveFirst = res as (p: HelpPageData) => void; }) as never,
    );

    const { result, rerender } = renderHook(() => useHelp());

    routeParams = { slug: 'Trips' };
    rerender();
    await waitFor(() => expect(result.current.page).toEqual(PAGE));

    const stale = { slug: 'Home', title: 'Stale', body: '' } as unknown as HelpPageData;
    await act(async () => { resolveFirst!(stale); });

    expect(result.current.page).toEqual(PAGE);
  });

  // ── Wiki language switcher ──────────────────────────────────────────────────
  //
  // The wiki language is separate from the app language: a reader can want the UI
  // in one language and the docs in another, so the choice lives under its own
  // storage key and rides on the URL rather than touching app_language.

  it('FE-PAGE-HELP-013: asks the server for the chosen language, on both endpoints', async () => {
    const { result } = renderHook(() => useHelp());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setLang('zh'));

    await waitFor(() => expect(helpApi.page).toHaveBeenLastCalledWith('Home', 'zh'));
    // The sidebar titles are themselves translated, so the index refetches too.
    expect(helpApi.index).toHaveBeenLastCalledWith('zh');
  });

  it('FE-PAGE-HELP-014: the choice is remembered and put on the URL', async () => {
    const { result } = renderHook(() => useHelp());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setLang('zh'));

    expect(localStorage.getItem('tt_wiki_lang')).toBe('zh');
    const calls = setSearchParams.mock.calls;
    const written = calls[calls.length - 1]?.[0] as URLSearchParams;
    expect(written.get('lang')).toBe('zh');
  });

  it('FE-PAGE-HELP-015: English drops the param so the plain URL stays canonical', async () => {
    searchParams = new URLSearchParams('lang=zh');
    const { result } = renderHook(() => useHelp());
    await waitFor(() => expect(result.current.lang).toBe('zh'));

    act(() => result.current.setLang('en'));

    const calls = setSearchParams.mock.calls;
    const written = calls[calls.length - 1]?.[0] as URLSearchParams;
    expect(written.has('lang')).toBe(false);
    expect(localStorage.getItem('tt_wiki_lang')).toBe('en');
  });

  it('FE-PAGE-HELP-016: opens in the app language when nothing has been chosen yet', async () => {
    appLanguage = 'zh';
    const { result } = renderHook(() => useHelp());
    expect(result.current.lang).toBe('zh');
    await waitFor(() => expect(helpApi.page).toHaveBeenCalledWith('Home', 'zh'));
  });

  it('FE-PAGE-HELP-017: a ?lang= link wins over both storage and the app language', async () => {
    appLanguage = 'zh';
    localStorage.setItem('tt_wiki_lang', 'zh');
    searchParams = new URLSearchParams('lang=en');

    const { result } = renderHook(() => useHelp());
    expect(result.current.lang).toBe('en');
    await waitFor(() => expect(helpApi.page).toHaveBeenCalledWith('Home', 'en'));
  });
});
