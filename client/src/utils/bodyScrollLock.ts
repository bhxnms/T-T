/**
 * The one body scroll lock every overlay in the app shares.
 *
 * Below 768px the document itself is the scroller now (#1809), so locking is no
 * longer cosmetic: an overlay that resets `body.style.overflow` unconditionally
 * really does unlock the page behind another overlay that is still open (a
 * system notice re-running its effect used to do exactly that to an open
 * sheet). Overlays stack, so the first lock remembers the original value and
 * only the last release puts it back.
 */
let locks = 0
let savedOverflow = ''
let savedPosition = ''
let savedTop = ''
let savedLeft = ''
let savedWidth = ''
let savedHtmlOverflow = ''
let savedScrollBy: typeof window.scrollBy | null = null
let savedScrollTo: typeof window.scrollTo | null = null
let savedScrollX = 0
let savedScrollY = 0

/**
 * Locks body scrolling and returns the matching release. Releasing twice is a
 * no-op, so the return value can be used directly as an effect cleanup.
 */
export function lockBodyScroll(): () => void {
  if (locks === 0) {
    const body = document.body
    const html = document.documentElement
    savedOverflow = body.style.overflow
    savedPosition = body.style.position
    savedTop = body.style.top
    savedLeft = body.style.left
    savedWidth = body.style.width
    savedHtmlOverflow = html.style.overflow
    savedScrollX = window.scrollX
    savedScrollY = window.scrollY
    savedScrollBy = window.scrollBy
    savedScrollTo = window.scrollTo
    window.scrollBy = (() => {}) as typeof window.scrollBy
    window.scrollTo = (() => {}) as typeof window.scrollTo

    // The phone layout deliberately lets the viewport/root scroller move. A
    // body-only overflow lock does not affect that scroller, so also guard the
    // scrolling APIs while the overlay is open (#1809).
    body.style.overflow = 'hidden'
    html.style.overflow = 'hidden'
  }
  locks += 1

  let released = false
  return () => {
    if (released) return
    released = true
    locks = Math.max(0, locks - 1)
    if (locks === 0) {
      const body = document.body
      const html = document.documentElement
      if (savedScrollBy) window.scrollBy = savedScrollBy
      savedScrollBy = null
      if (savedScrollTo) window.scrollTo = savedScrollTo
      savedScrollTo = null
      body.style.overflow = savedOverflow
      body.style.position = savedPosition
      body.style.top = savedTop
      body.style.left = savedLeft
      body.style.width = savedWidth
      html.style.overflow = savedHtmlOverflow
      window.scrollTo(savedScrollX, savedScrollY)
    }
  }
}

/** How many locks are currently held. For tests and diagnostics. */
export function bodyScrollLocks(): number {
  return locks
}

/** Test seam: the counter is module state and outlives a single test case. */
export function resetBodyScrollLock(): void {
  locks = 0
  savedOverflow = ''
  savedPosition = ''
  savedTop = ''
  savedLeft = ''
  savedWidth = ''
  savedHtmlOverflow = ''
  savedScrollBy = null
  savedScrollTo = null
  savedScrollX = 0
  savedScrollY = 0
}
