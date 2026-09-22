import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useParams, useSearchParams } from 'react-router'
import { helpApi, WIKI_LANGS, type WikiLang, type HelpNavSection, type HelpPageData } from '../../api/client'
import { useTranslation } from '../../i18n'

/**
 * The reader's wiki language, remembered across visits. Deliberately its own key
 * rather than the app's `app_language`: the wiki language is a reading choice
 * about the docs, and switching it must not retranslate the whole UI.
 */
const WIKI_LANG_KEY = 'tt_wiki_lang'

function isWikiLang(value: unknown): value is WikiLang {
  return typeof value === 'string' && WIKI_LANGS.some((l) => l.value === value)
}

/**
 * The language to open the wiki in, in priority order:
 *  1. `?lang=` — an explicit link. The switcher writes it, so the choice is
 *     shareable and survives a reload.
 *  2. the remembered choice.
 *  3. the app's own language, so a Chinese user lands on Chinese docs without
 *     having to find the switcher first.
 */
function initialLang(paramLang: string | null, appLanguage: string): WikiLang {
  if (isWikiLang(paramLang)) return paramLang
  try {
    const stored = localStorage.getItem(WIKI_LANG_KEY)
    if (isWikiLang(stored)) return stored
  } catch {
    /* private mode / storage disabled — fall through */
  }
  return isWikiLang(appLanguage) ? appLanguage : 'en'
}

/**
 * The heading a link asked for, without its `#`, or null when there is none.
 *
 * Wiki pages link to their own sections (`](#check-ins)`) and — more usefully —
 * to sections of *other* pages (`](Atlas#check-ins)`). The first kind is a plain
 * document fragment and the browser scrolls it natively. The second arrives as a
 * client-side route change, and `history.pushState` does not scroll to fragments
 * — that is browser behaviour, not a bug in the router. Nothing else here does it
 * either: react-router only acts on `location.hash` inside its `ScrollRestoration`
 * component, which this app does not mount (it uses the declarative
 * `BrowserRouter`, and that component requires a data router). So a cross-page
 * anchor used to land at the top of the target page, which is exactly what the
 * `window.scrollTo({ top: 0 })` below then made permanent.
 *
 * Decoded defensively: the fragment is author-written, and a stray `%` would make
 * `decodeURIComponent` throw. Browsers percent-encode non-ASCII fragments, so the
 * Chinese wiki's headings only match once decoded.
 */
function hashTarget(hash: string): string | null {
  if (!hash || hash === '#') return null
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  try {
    return decodeURIComponent(raw) || null
  } catch {
    return raw || null
  }
}

/** State + data loading for the in-app help wiki (see PATTERN.md). */
export function useHelp() {
  const { slug } = useParams<{ slug: string }>()
  const { hash, key: locationKey } = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { language: appLanguage } = useTranslation()

  const paramLang = searchParams.get('lang')
  const [lang, setLangState] = useState<WikiLang>(() => initialLang(paramLang, appLanguage))

  const [sections, setSections] = useState<HelpNavSection[]>([])
  const [page, setPage] = useState<HelpPageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState(false)
  const [query, setQuery] = useState('')
  const [navOpen, setNavOpen] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const navScrollRef = useRef<HTMLDivElement>(null)
  const navScrollKey = `tt_wiki_nav_scroll_${lang}`
  /**
   * The reader's sidebar offset, kept here rather than read back off the node.
   *
   * The sidebar unmounts on every page change — the route boundary in App.tsx
   * keys on pathname, so HelpPage is torn down and rebuilt for the next slug —
   * and a detached element reports `scrollTop === 0`. Persisting from the node
   * at cleanup therefore erased the position on the very navigation it was
   * meant to survive. The ref is updated by the scroll listener while the node
   * is alive, so the value outlives it.
   */
  const navScrollTop = useRef(0)

  const readNavScroll = (): number => {
    try {
      const saved = Number(sessionStorage.getItem(navScrollKey))
      return Number.isFinite(saved) && saved > 0 ? saved : 0
    } catch {
      return 0
    }
  }

  // Remember the offset while the reader scrolls, and write it out on the way
  // out — from the ref, never from the (by then detached) node.
  useEffect(() => {
    const nav = navScrollRef.current
    if (!nav) return
    navScrollTop.current = readNavScroll()
    nav.scrollTop = navScrollTop.current
    const remember = () => {
      navScrollTop.current = nav.scrollTop
      try {
        sessionStorage.setItem(navScrollKey, String(nav.scrollTop))
      } catch {
        /* storage is optional */
      }
    }
    nav.addEventListener('scroll', remember, { passive: true })
    return () => {
      nav.removeEventListener('scroll', remember)
      const top = navScrollTop.current
      if (top <= 0) return
      try {
        sessionStorage.setItem(navScrollKey, String(top))
      } catch {
        /* storage is optional */
      }
    }
  }, [navScrollKey])

  // Put the offset back once the list is tall enough to hold it. The sidebar
  // arrives asynchronously (and is empty on the first paint), so this runs again
  // when the sections land — assigning before then would clamp to 0 and lose it.
  // A `scrollHeight` of 0 is jsdom, where the check cannot mean anything.
  useLayoutEffect(() => {
    const nav = navScrollRef.current
    if (!nav) return
    const wanted = navScrollTop.current || readNavScroll()
    if (wanted <= 0 || nav.scrollTop === wanted) return
    if (nav.scrollHeight > 0 && nav.scrollHeight - nav.clientHeight < wanted) return
    nav.scrollTop = wanted
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, navScrollKey])

  // Adopt a `?lang=` that arrives after mount — a pasted link, or the browser's
  // back/forward — so the URL and the rendered language cannot drift apart.
  useEffect(() => {
    if (isWikiLang(paramLang) && paramLang !== lang) setLangState(paramLang)
  }, [paramLang, lang])

  // Refetched on language change: the sidebar titles are themselves translated.
  useEffect(() => {
    let alive = true
    helpApi
      .index(lang)
      .then((d) => {
        if (alive) setSections(d.sections)
      })
      .catch(() => {
        if (alive) setSections([])
      })
    return () => {
      alive = false
    }
  }, [lang])

  const homeSlug = sections[0]?.pages[0]?.slug ?? 'Home'
  const activeSlug = slug ?? homeSlug

  /**
   * The section the URL asked for, mirrored into a ref.
   *
   * The fetch effect below has to know whether a fragment is in play, but it must
   * not re-run when the fragment changes — that would refetch the page on every
   * same-page anchor click. A ref carries the answer without joining its deps.
   */
  const hashTargetRef = useRef<string | null>(null)
  hashTargetRef.current = hashTarget(hash)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setPageError(false)
    helpApi
      .page(activeSlug, lang)
      .then((p) => {
        if (!alive) return
        setPage(p)
        setLoading(false)
      })
      .catch(() => {
        if (!alive) return
        setPageError(true)
        setLoading(false)
      })
    // A fragment names a section on the page being loaded, so resetting to the
    // top here would fight the anchor jump below — and win, because this runs
    // while the request is still in flight and the heading does not exist yet.
    // Measured in a browser: the jump did fire, and this then undid it.
    if (!hashTargetRef.current) {
      contentRef.current?.scrollTo?.({ top: 0 })
      window.scrollTo?.({ top: 0 })
    }
    setNavOpen(false)
    return () => {
      alive = false
    }
  }, [activeSlug, lang])

  /**
   * Land on the section a cross-page link pointed at.
   *
   * Runs after the page's markdown has been committed, so the heading exists by
   * the time it looks for it — the fetch above is asynchronous and the element is
   * simply absent until the content lands.
   *
   * `scrollIntoView` rather than a computed offset: it walks up to whichever
   * ancestor actually scrolls (in this layout that is `body`, not the window —
   * `html` is `overflow: hidden`), and it honours the `scroll-mt-24` the heading
   * renderers set, so the sticky navbar does not cover the heading it just
   * revealed. A missing element (a stale or hand-written anchor) is left alone —
   * the reader keeps the top of the page rather than an error.
   *
   * One call is not enough, and that is measured rather than assumed: the same
   * call landed the heading at 96px once the page had settled and at 745px when
   * it ran during the first commit, because the wiki's images load afterwards and
   * push everything below them down. So the jump is re-applied while the content
   * keeps resizing, and a reader who scrolls in the meantime takes over — the
   * page stops fighting them the moment they move.
   */
  useLayoutEffect(() => {
    const target = hashTarget(hash)
    if (!target) return
    const el = document.getElementById(target)
    if (!el) return

    let done = false
    let userTookOver = false
    const yieldToReader = () => {
      userTookOver = true
    }
    // `once` on each: the first sign of manual scrolling is the only one that
    // matters, and a passive listener keeps this off the scroll path.
    window.addEventListener('wheel', yieldToReader, { passive: true, once: true })
    window.addEventListener('touchstart', yieldToReader, { passive: true, once: true })
    window.addEventListener('keydown', yieldToReader, { once: true })

    const jump = () => {
      if (done || userTookOver) return
      el.scrollIntoView({ block: 'start' })
    }
    jump()

    // Observe the element the heading lives in — the prose container is what the
    // wiki's images grow, so that is the box whose height moves the heading.
    // Falls back to body, which is this layout's scroll container anyway.
    const watched = el.parentElement ?? document.body
    const canObserve = typeof ResizeObserver !== 'undefined'
    const observer = canObserve ? new ResizeObserver(jump) : undefined
    observer?.observe(watched)
    // Backstop for a page whose layout never settles (or a browser without
    // ResizeObserver): stop correcting shortly after the jump.
    const stop = window.setTimeout(() => {
      done = true
      observer?.disconnect()
    }, 4000)

    return () => {
      done = true
      observer?.disconnect()
      window.clearTimeout(stop)
      window.removeEventListener('wheel', yieldToReader)
      window.removeEventListener('touchstart', yieldToReader)
      window.removeEventListener('keydown', yieldToReader)
    }
  }, [hash, locationKey, page])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sections
    return sections
      .map((s) => ({ ...s, pages: s.pages.filter((p) => p.title.toLowerCase().includes(q)) }))
      .filter((s) => s.pages.length > 0)
  }, [sections, query])

  /**
   * Switch the wiki language. Written to the URL as well as storage so the choice
   * is shareable and survives a reload, and `replace` so flipping the language a
   * few times does not fill the back stack with the same page.
   */
  const setLang = (next: WikiLang): void => {
    setLangState(next)
    try {
      localStorage.setItem(WIKI_LANG_KEY, next)
    } catch {
      /* private mode — the URL still carries it */
    }
    const params = new URLSearchParams(searchParams)
    if (next === 'en') params.delete('lang')
    else params.set('lang', next)
    setSearchParams(params, { replace: true })
  }

  return {
    page,
    loading,
    pageError,
    query,
    setQuery,
    navOpen,
    setNavOpen,
    contentRef,
    navScrollRef,
    activeSlug,
    filtered,
    lang,
    setLang,
    availableLangs: WIKI_LANGS,
  }
}
