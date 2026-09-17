export interface PlaceFormData {
  name: string;
  description: string;
  address: string;
  lat: string;
  lng: string;
  category_id: string;
  place_time: string;
  end_time: string;
  notes: string;
  transport_mode: string;
  website: string;
  // Populated from a maps-search pick (not part of the initial blank form).
  phone?: string;
  google_place_id?: string;
  google_ftid?: string;
  osm_id?: string;
  // AMap (高德) POI id, kept apart from osm_id: the OSM details path parses its
  // id as '<type>/<id>', and an AMap id carries no slash.
  amap_id?: string;
  // Hero image picked from the detail column. Optional and absent from
  // DEFAULT_FORM on purpose: the mobile sheet shares this type and never sets
  // it, and places.service already writes image_url through on create/update.
  image_url?: string;
  // Day-specific note on the in-context assignment (#2163). Only hydrated when
  // the form opened with an assignment in context; both forms drop it from the
  // submit payload when unchanged, and useTripPlanner strips it off the place
  // update and PUTs it per assignment instead.
  assignment_notes?: string;
}

export function isGoogleMapsUrl(input: string): boolean {
  try {
    const { hostname, pathname } = new URL(input.trim());
    const h = hostname.toLowerCase();
    // maps.app.goo.gl, goo.gl/maps
    if (h === 'maps.app.goo.gl') return true;
    if (h === 'goo.gl' && pathname.startsWith('/maps')) return true;
    // maps.google.* (e.g. maps.google.com, maps.google.co.uk)
    // Must be maps.google.<tld> or maps.google.<sld>.<tld> — reject maps.google.evil.com
    if (/^maps\.google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(h)) return true;
    // google.*/maps (e.g. google.com/maps, www.google.co.uk/maps)
    const bare = h.startsWith('www.') ? h.slice(4) : h;
    if (/^google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(bare) && pathname.startsWith('/maps')) return true;
    return false;
  } catch {
    return false;
  }
}

/** Hosts that serve an AMap place page or short link. */
const AMAP_PLACE_HOSTS = /^(www\.|ditu\.|surl\.|uri\.)?amap\.com$/i;

/** A bare AMap POI id ("B000A83M61") — the app's share text ends with one. */
const AMAP_POI_ID = /^[A-Z0-9]{8,20}$/;

/**
 * The AMap place URL inside `input`, or the input itself when it is one.
 *
 * AMap's app "分享" produces a sentence with the link buried in the middle
 * ("我在高德地图发现了一个好地方… https://surl.amap.com/xxxx …"), so callers
 * paste a paragraph rather than a URL and a plain `new URL()` throws on it. The
 * link is lifted out by scanning for a candidate token instead, and each
 * candidate is then validated as a real AMap host — the shape check alone would
 * accept any text containing "amap.com" anywhere.
 */
export function extractAmapUrl(input: string): string | null {
  const text = input.trim();
  if (!text) return null;

  // Whitespace/punctuation separated candidates. Chinese share text often glues
  // the link to the following character, so the trailing CJK run is stripped too.
  for (const token of text.split(/[\s，。、；：！？"'()<>《》【】]+/)) {
    const candidate = token.replace(/[.,;:!?]+$/, '').replace(/[\u4e00-\u9fff].*$/, '');
    if (!candidate) continue;
    const withScheme = /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`;
    try {
      const { hostname } = new URL(withScheme);
      if (AMAP_PLACE_HOSTS.test(hostname)) return withScheme;
    } catch {
      /* not a URL — try the next token */
    }
  }
  return null;
}

/**
 * A bare AMap POI id, which the app's share text carries when the link is
 * suppressed. Restricted to the id alphabet so ordinary search words (which the
 * text search path should handle) do not match.
 */
export function extractAmapPoiId(input: string): string | null {
  const text = input.trim();
  if (!text || /\s/.test(text)) return null;
  return AMAP_POI_ID.test(text) ? text : null;
}

/**
 * True when the search box content should go down the AMap-import path rather
 * than keyword search: an AMap link (bare or inside share text) or a bare POI id.
 */
export function isAmapShareInput(input: string): boolean {
  return extractAmapUrl(input) !== null || extractAmapPoiId(input) !== null;
}

export const DEFAULT_FORM: PlaceFormData = {
  name: '',
  description: '',
  address: '',
  lat: '',
  lng: '',
  category_id: '',
  place_time: '',
  end_time: '',
  notes: '',
  transport_mode: 'walking',
  website: '',
};

/**
 * The fields a maps result owns. Everything else in the form belongs to the
 * user and is never touched by picking a place.
 */
export const RESULT_FIELDS = [
  'name',
  'address',
  'lat',
  'lng',
  'google_place_id',
  'google_ftid',
  'osm_id',
  'amap_id',
  'website',
  'phone',
] as const;

export type ResultField = (typeof RESULT_FIELDS)[number];

/**
 * Folds a picked search result into the form.
 *
 * The obvious version is `result.x || prev.x`, and it has a bug that is easy to
 * miss and hard to spot as a user: that expression cannot tell "the user typed
 * this" from "the previous search result wrote this". Pick Hamburg Airport,
 * then pick Berlin Hauptbahnhof — which has no website in OpenStreetMap — and
 * the airport's website is still sitting in the field. Save it and the station
 * now links to an airport.
 *
 * So the caller tracks which fields it filled in itself. A field the last pick
 * wrote belongs to the last place and is cleared when the new one says nothing
 * about it; a field the user typed survives untouched. `autoFilled` is mutated
 * in place — it is the caller's record of what it owns.
 */
export function mergeResult(
  prev: PlaceFormData,
  result: Record<string, unknown>,
  autoFilled: Set<ResultField>
): PlaceFormData {
  const next = { ...prev } as PlaceFormData & Record<string, string | undefined>;

  for (const field of RESULT_FIELDS) {
    const raw = result[field];
    const value = raw == null ? '' : String(raw);

    if (value) {
      next[field] = value;
      autoFilled.add(field);
    } else if (autoFilled.has(field)) {
      // Belonged to the place that is no longer selected.
      next[field] = '';
      autoFilled.delete(field);
    }
    // Otherwise the user put it there; leave it alone.
  }

  return next;
}
