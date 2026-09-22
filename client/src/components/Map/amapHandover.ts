import type { NamedWaypoint } from './RouteCalculator'
import { wgs84ToGcj02 } from './engines/amap'

/**
 * Handing a day's route to the AMap app when the device has one.
 *
 * The web link (`ditu.amap.com/dir`) always works, but on a phone the app is the
 * better destination: it navigates, it works with the screen off, and it is what
 * somebody with AMap installed expects a route tap to open.
 *
 * AMap publishes native schemes for exactly this — `amapuri://` on Android,
 * `iosamap://` on iOS — and they take a documented route form. Two things about
 * them are worth stating, because both were checked against the live service:
 *
 *  - They accept **any number of waypoints** (`vian`/`vialons`/`vialats`/
 *    `vianames`, `|`-separated). The web `navigation` URI takes only one, which
 *    is why the web fallback needs the indexed `ditu.amap.com/dir` form. So the
 *    app handover is not merely nicer here, it is lossless.
 *  - `dev=0` declares the coordinates **already offset** (GCJ-02), so they are
 *    converted before they are put in the URL. Sending WGS-84 with `dev=0` would
 *    shift every stop by a few hundred metres.
 *
 * A browser cannot ask whether a scheme is handled. The standard answer is the
 * one used here: start the handover, and if the page is still in the foreground
 * after a short grace period, no app took it — fall back to the web link. That
 * grace period is also why this never runs on a desktop, where the scheme is
 * certain to fail and the delay would be pure latency.
 */

/** Android answers `amapuri://`, iOS `iosamap://`; a desktop answers neither. */
export function amapAppScheme(): 'amapuri' | 'iosamap' | null {
  if (typeof navigator === 'undefined') return null
  const ua = navigator.userAgent
  // iPadOS 13+ can report a Macintosh UA while still being an iPad. Touch
  // points are the reliable discriminator in that mode.
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) {
    return 'iosamap'
  }
  if (/Android/i.test(ua)) return 'amapuri'
  return null
}

/** How long to give the OS to switch apps before assuming there is none. */
const APP_LAUNCH_GRACE_MS = 1600

/** AMap asks callers to identify themselves; a label, never a credential. */
const AMAP_SRC = 'tt-travel-planner'

/** Travel mode, in the native scheme's numbering: 0 drive, 2 walk, 3 cycle. */
const AMAP_MODE_DRIVE = 0

/**
 * The native route URL for these stops, or null when this device has no scheme
 * to answer (a desktop) or the day has fewer than two located stops.
 *
 * A single stop is deliberately not handled here: the marker link already hands
 * off correctly on a phone, and a "route" with no start is not what the user
 * tapped.
 */
export function generateAmapAppUrl(places: NamedWaypoint[]): string | null {
  const scheme = amapAppScheme()
  if (!scheme) return null
  const valid = places.filter((p) => p.lat != null && p.lng != null)
  if (valid.length < 2) return null

  const gcj = (p: NamedWaypoint) => wgs84ToGcj02(Number(p.lng), Number(p.lat))
  const [first, ...rest] = valid
  const last = rest.pop()!

  // Each name is encoded on its own; the `|` that separates them stays literal,
  // which is the separator AMap's own examples use.
  const joinNames = (list: NamedWaypoint[]) =>
    list.map((p) => encodeURIComponent(p.name?.trim() || '')).join('|')

  const start = gcj(first)
  const end = gcj(last)
  const params = [
    `sourceApplication=${AMAP_SRC}`,
    `slat=${start.lat}`,
    `slon=${start.lng}`,
    `sname=${encodeURIComponent(first.name?.trim() || '')}`,
    `dlat=${end.lat}`,
    `dlon=${end.lng}`,
    `dname=${encodeURIComponent(last.name?.trim() || '')}`,
    // 0 = the coordinates are already offset, i.e. GCJ-02.
    'dev=0',
    `t=${AMAP_MODE_DRIVE}`,
    // Required by the native route contract on current Android and iOS builds;
    // kept as 0 because the app's local travel preference owns the exact policy.
    'm=0',
  ]

  if (rest.length > 0) {
    const vias = rest.map(gcj)
    params.push(
      `vian=${rest.length}`,
      `vialons=${vias.map((v) => v.lng).join('|')}`,
      `vialats=${vias.map((v) => v.lat).join('|')}`,
      `vianames=${joinNames(rest)}`,
    )
  }

  const query = params.join('&')
  // Android's documented path carries a trailing slash; iOS uses `path`.
  return scheme === 'amapuri' ? `amapuri://route/plan/?${query}` : `iosamap://path?${query}`
}

/**
 * Open these stops in the AMap app, falling back to `webUrl` when no app answers.
 *
 * The current context is used rather than a new tab: a custom scheme in a new
 * window is blocked by the popup rules and, when it does fire, leaves an empty
 * window behind on the way back.
 */
export interface AMapHandoverOptions {
  /** Test hook; production callers leave this unset and use the current page. */
  navigate?: (url: string) => void
}

export function openAmapMaps(
  places: NamedWaypoint[],
  webUrl: string | null,
  options: AMapHandoverOptions = {},
): void {
  const appUrl = generateAmapAppUrl(places)
  const navigate = options.navigate ?? ((url: string) => { window.location.href = url })
  const openWeb = (): void => {
    if (webUrl) navigate(webUrl)
  }
  if (!appUrl) {
    openWeb()
    return
  }

  let handedOver = false
  const settle = (): void => {
    handedOver = true
    clearTimeout(timer)
    document.removeEventListener('visibilitychange', onBackground)
  }
  // The app taking over hides the page; that means the handover worked and the
  // web fallback must not also run. We intentionally do not treat pagehide as
  // success: normal browser navigation can emit it while the document remains
  // visible, and that would suppress the fallback on browsers that do not hand
  // the scheme to an installed app.
  const onBackground = (): void => {
    if (document.visibilityState === 'hidden') settle()
  }
  const timer = setTimeout(() => {
    if (handedOver) return
    settle()
    openWeb()
  }, APP_LAUNCH_GRACE_MS)

  document.addEventListener('visibilitychange', onBackground)
  navigate(appUrl)
}
