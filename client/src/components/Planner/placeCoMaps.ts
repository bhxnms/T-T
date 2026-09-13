import type { AssignmentPlace, Place } from '../../types'

type PlaceLike = Pick<Place | AssignmentPlace, 'name' | 'lat' | 'lng'>

/**
 * Open a place in CoMaps, the privacy-focused offline OpenStreetMap navigator.
 * Requested in discussion #1904.
 *
 * The https form rather than the `cm://` scheme CoMaps also answers to: both open
 * the app when it is installed, but only this one has somewhere to land when it is
 * not — comaps.at, which is the install page. A PWA cannot ask whether an Android
 * app exists, so the fallback has to be the link itself.
 *
 * Coordinates are required: CoMaps places the pin from `ll` and uses `n` only to
 * label it, so a name on its own has nothing to attach to.
 */
export function getCoMapsUrlForPlace(place: PlaceLike | null | undefined): string | null {
  if (!place || place.lat == null || place.lng == null) return null
  const name = place.name?.trim()
  const n = name ? `&n=${encodeURIComponent(name)}` : ''
  return `https://comaps.at/map?v=1&ll=${place.lat},${place.lng}${n}`
}
