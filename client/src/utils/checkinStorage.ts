/**
 * Place Check-in Storage
 * 行程地点打卡状态存储 — 与 landmarkStorage（地标打卡）并列的本地存储。
 *
 * The trip planner marks a place as "已打卡" from PlaceInspector; the Atlas page
 * reads the same list to draw the markers and count the check-ins. Keys are the
 * place's pool id, so re-adding a place to a day keeps its check-in state.
 */

const CHECKED_PLACES_KEY = 'tt_checked_places'

export interface CheckedPlace {
  id: number
  tripId: number | null
  name: string
  lat: number | null
  lng: number | null
  checkedAt: number
}

function readAll(): CheckedPlace[] {
  try {
    const data = localStorage.getItem(CHECKED_PLACES_KEY)
    if (!data) return []
    const parsed: unknown = JSON.parse(data)
    return Array.isArray(parsed) ? (parsed as CheckedPlace[]) : []
  } catch {
    return []
  }
}

function writeAll(places: CheckedPlace[]): void {
  try {
    localStorage.setItem(CHECKED_PLACES_KEY, JSON.stringify(places))
  } catch {
    /* private mode — the toggle still works for this session */
  }
  // Same tab (storage events only fire cross-tab) — the Atlas page listens for this.
  window.dispatchEvent(new Event('tt-checkins-changed'))
}

/** All checked-in places, oldest first (storage order). */
export function getCheckedPlaces(): CheckedPlace[] {
  return readAll()
}

export function isPlaceChecked(placeId: number): boolean {
  return readAll().some((p) => p.id === placeId)
}

/** Returns true when the place is now checked in, false when unchecked. */
export function togglePlaceCheckin(place: {
  id: number
  name: string
  lat?: number | null
  lng?: number | null
  tripId?: number | string | null
}): boolean {
  const places = readAll()
  const idx = places.findIndex((p) => p.id === place.id)
  if (idx >= 0) {
    places.splice(idx, 1)
    writeAll(places)
    return false
  }
  places.push({
    id: place.id,
    tripId: place.tripId != null ? Number(place.tripId) : null,
    name: place.name,
    lat: typeof place.lat === 'number' ? place.lat : null,
    lng: typeof place.lng === 'number' ? place.lng : null,
    checkedAt: Date.now(),
  })
  writeAll(places)
  return true
}

/** Count of checked-in places (only those with coordinates can draw a marker). */
export function countCheckedPlaces(): number {
  return readAll().length
}
