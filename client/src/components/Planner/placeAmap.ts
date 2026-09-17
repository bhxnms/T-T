import type { AssignmentPlace, Place } from '../../types';

type PlaceLike = Pick<Place | AssignmentPlace, 'name' | 'lat' | 'lng' | 'amap_id'>;

/**
 * Open a place in AMap (高德地图), the map a traveller in China is most likely
 * to have installed.
 *
 * The URI API rather than a www.amap.com link: uri.amap.com hands the place to
 * the installed app when there is one and opens the web map when there is not,
 * which is the same trade every other entry in the navigation menu makes.
 *
 * POI id first, because it resolves the exact entry — the difference between the
 * right unit inside a mall and the building's front door. The coordinate form is
 * the fallback and declares `coordinate=wgs84`: TREK stores WGS-84, while AMap's
 * URI API assumes GCJ-02 unless told otherwise, so without it every pin would
 * land a few hundred metres off. The conversion is left to AMap rather than done
 * here, since it is the party that knows which frame it wants.
 *
 * `src` is AMap's own request to identify the caller (it advises filling it in
 * for service quality); it is a label, never a credential.
 */
const AMAP_SRC = 'tt-travel-planner';

export function getAmapUrlForPlace(place: PlaceLike | null | undefined): string | null {
  if (!place) return null;

  const amapId = place.amap_id?.trim();
  if (amapId) {
    return `https://uri.amap.com/marker?poiid=${encodeURIComponent(amapId)}&src=${AMAP_SRC}`;
  }

  if (place.lat == null || place.lng == null) return null;
  // position is `lng,lat` — the reverse of how the coordinates are stored.
  const position = `${place.lng},${place.lat}`;
  const name = place.name?.trim();
  const n = name ? `&name=${encodeURIComponent(name)}` : '';
  return `https://uri.amap.com/marker?position=${position}&coordinate=wgs84&src=${AMAP_SRC}${n}`;
}
