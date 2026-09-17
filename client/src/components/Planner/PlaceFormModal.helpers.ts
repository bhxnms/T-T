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
 * A URL as it appears inside share text.
 *
 * The link is FOUND in the paragraph rather than the paragraph being split up
 * and the pieces tested: AMap's share text glues the URL straight onto the
 * preceding character ("…14层1401https://surl.amap.com/gXe3qqOFa56"), so a
 * whitespace split leaves one token that is mostly Chinese and carries the URL
 * at its end. A token-based scan has to strip that Chinese — and stripping
 * "everything from the first CJK character" removes the URL with it, which is
 * why pasting a real share message used to resolve to nothing.
 *
 * The match therefore starts at the scheme and runs until something that cannot
 * be part of a URL: whitespace, a CJK character, or a CJK/fullwidth punctuation
 * mark. Trailing ASCII punctuation (the sentence's comma, a closing bracket) is
 * trimmed off afterwards.
 */
const URL_IN_TEXT = /https?:\/\/[^\s\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]+/gi;

/**
 * A scheme-less AMap host, which people also paste ("www.amap.com/place/…").
 *
 * The lookbehind is what keeps this from re-opening the hole the credential
 * check closes: in the mangled "\\:高德地图:// a@amap.com" the address is
 * `a@amap.com`, and without the guard this pattern would match the `amap.com`
 * part of it as a bare host. A preceding `@`, word character or dot means the
 * token is part of something larger, so it is not a host standing on its own.
 */
const BARE_AMAP_HOST =
  /(?<![\w@.])((?:www|ditu|surl|uri)\.amap\.com|amap\.com)(\/[^\s\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]*)?/gi;

/**
 * The AMap place URL inside `input`, or null when there is none.
 *
 * A URL carrying credentials is refused outright. AMap share links never have
 * any, and the shape is exactly what a mangled share string produces: the
 * position-passcode text ends with "\\:高德地图:// a@amap.com", which `new URL()`
 * happily parses as host `amap.com` with username `a`. Letting that through sent
 * the server off to fetch amap.com's homepage and return whatever place it found
 * there — a confidently wrong address, which is worse than no result.
 */
export function extractAmapUrl(input: string): string | null {
  const text = input.trim();
  if (!text) return null;

  for (const match of text.matchAll(URL_IN_TEXT)) {
    const candidate = match[0].replace(/[.,;:!?)\]}>"'，。、；：！？）】》]+$/, '');
    if (!candidate) continue;
    try {
      const url = new URL(candidate);
      if (url.username || url.password) continue; // mangled text, not a share link
      if (AMAP_PLACE_HOSTS.test(url.hostname)) return url.toString();
    } catch {
      /* not a URL — try the next match */
    }
  }

  // Nothing matched with a scheme. Fall back to a bare host, which is also
  // pasted — but only when the text carries no scheme at all. A URL that was
  // examined and rejected (a lookalike such as `amap.com.evil.test`, or one
  // carrying credentials) must not be re-matched here by its inner `amap.com`
  // substring, which is exactly what would let it through.
  if (/[a-z][a-z0-9+.-]*:\/\//i.test(text)) return null;
  const bare = BARE_AMAP_HOST.exec(text);
  if (bare) {
    const candidate = `${bare[1]}${bare[2] ?? ''}`.replace(/[.,;:!?)\]}>"'，。、；：！？）】》]+$/, '');
    try {
      return new URL(`https://${candidate}`).toString();
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * An AMap "位置口令" (position passcode), e.g. "我的高德位置口令为006224…".
 *
 * These are resolved by AMap's own app only; there is no public endpoint that
 * turns a passcode into coordinates. Recognising one exists purely so the caller
 * can say so, instead of forwarding the number as a keyword search or — much
 * worse — letting the mangled `a@amap.com` tail inside the same message be read
 * as a link.
 */
export function extractAmapPasscode(input: string): string | null {
  const match = input.match(/位置口令[^0-9]{0,4}(\d{4,12})/);
  return match ? match[1] : null;
}

/**
 * The POI payload AMap puts in `?p=` on the page a share link redirects to.
 *
 * Verified against a live short link, which redirected to
 * `https://www.amap.com/?p=B0MRJ44YYT,26.65037…,106.62117…,<name>,<address>` —
 * POI id, LATITUDE, LONGITUDE, name, address, in that order. The lat-first order
 * is the opposite of AMap's own `position=lng,lat` convention, so it is checked
 * rather than assumed: a payload whose latitude falls outside ±90 is rejected as
 * not-the-format-we-think-it-is instead of being silently used.
 *
 * Carrying the coordinates inline is what makes this worth parsing — a place can
 * be added from a share link with no Web-Service key configured at all.
 */
export interface AmapPoiPayload {
  amapId: string | null;
  lat: number;
  lng: number;
  name: string | null;
  address: string | null;
}

export function parseAmapPoiPayload(url: string): AmapPoiPayload | null {
  let raw: string | null = null;
  try {
    raw = new URL(url).searchParams.get('p');
  } catch {
    return null;
  }
  if (!raw) return null;

  const parts = raw.split(',');
  if (parts.length < 3) return null;
  const [id, latPart, lngPart, namePart, addressPart] = parts;
  const lat = Number.parseFloat(latPart);
  const lng = Number.parseFloat(lngPart);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  // Latitude first, as measured. A longitude sitting where the latitude should
  // be means the payload is laid out differently than assumed, so decline it.
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

  const clean = (v?: string) => {
    const decoded = v ? decodeURIComponent(v).trim() : '';
    return decoded || null;
  };
  return {
    amapId: AMAP_POI_ID.test(id) ? id : null,
    lat,
    lng,
    name: clean(namePart),
    address: clean(addressPart),
  };
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
 * than keyword search: an AMap link (bare or inside share text), a bare POI id,
 * or a position passcode — the last so the caller can explain that a passcode
 * cannot be resolved here instead of searching for the number.
 */
export function isAmapShareInput(input: string): boolean {
  return extractAmapUrl(input) !== null || extractAmapPoiId(input) !== null || extractAmapPasscode(input) !== null;
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
