import { UA } from '../maps/maps.helpers';

/**
 * Photon (photon.komoot.io) — the OpenStreetMap geocoder fallback.
 *
 * Nominatim is the primary free source, but its host is unreachable from some
 * network environments (DNS pollution / outright blocking; the domain resolves
 * to junk and every fetch dies with "fetch failed" before an HTTP status ever
 * exists). Photon serves the same OpenStreetMap data through a different
 * endpoint that does answer, so a Nominatim failure degrades to a Photon
 * search instead of a dead place search. Results are shaped like Nominatim
 * answers so the callers cannot tell the difference.
 */

const BASE = 'https://photon.komoot.io';
const TIMEOUT_MS = 5_000;

/** Photon only localizes a fixed language set; anything else gets its default. */
const PHOTON_LANGS = new Set(['en', 'de', 'fr', 'it', 'es', 'pt', 'ru', 'uk', 'nl', 'pl', 'fi', 'sv']);

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    osm_id?: number;
    osm_type?: string;
    osm_key?: string;
    osm_value?: string;
    name?: string;
    housenumber?: string;
    street?: string;
    postcode?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
  };
}

/** The slice of the Nominatim response shape the maps service maps into places. */
export interface NominatimLikeResult {
  osm_type: string;
  osm_id: string;
  name: string;
  display_name: string;
  lat: string;
  lon: string;
  extratags: Record<string, string>;
}

const OSM_TYPE_PREFIX: Record<string, string> = { N: 'node', W: 'way', R: 'relation' };

/**
 * One search against Photon. Resolves to null when Photon is also unreachable
 * (or answers nonsense) so the caller can rethrow its original Nominatim
 * error; an empty feature list is a legitimate "no results", not a failure.
 */
export async function photonSearch(query: string, lang?: string, limit = 10): Promise<NominatimLikeResult[] | null> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  const l = (lang || '').split('-')[0].toLowerCase();
  if (PHOTON_LANGS.has(l)) params.set('lang', l);

  let data: { features?: PhotonFeature[] };
  try {
    const resp = await fetch(`${BASE}/api/?${params.toString()}`, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!resp.ok) return null;
    data = await resp.json();
  } catch {
    return null;
  }
  if (!data || !Array.isArray(data.features)) return null;

  return data.features.flatMap((f) => {
    const props = f.properties ?? {};
    const coords = f.geometry?.coordinates;
    if (!coords || coords.length < 2) return [];
    const lng = coords[0];
    const lat = coords[1];
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
    const name = props.name || '';
    const street = [props.street, props.housenumber].filter(Boolean).join(' ');
    const display =
      [name, street, props.city, props.county, props.state, props.country].filter(Boolean).join(', ') || name;
    return [
      {
        osm_type: OSM_TYPE_PREFIX[props.osm_type ?? ''] ?? 'node',
        osm_id: String(props.osm_id ?? ''),
        name,
        display_name: display,
        lat: String(lat),
        lon: String(lng),
        extratags: props.osm_key && props.osm_value ? { [props.osm_key]: props.osm_value } : {},
      },
    ];
  });
}
