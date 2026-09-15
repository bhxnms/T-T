import { DatabaseService } from '../database/database.service';
import { readInstanceApiKey } from '../settings/instance-api-keys';
import { wgs84ToGcj02, gcj02ToWgs84 } from './gcj02';

/**
 * AMap (高德) Web-Service adapter for place search and driving/walking/cycling
 * routing.
 *
 * Enabled instance-wide by the admin with two `app_settings` rows:
 *   - `amap_api_key`        the Web服务 key, encrypted like the other instance keys
 *   - `amap_search_enabled` 'true' → /api/maps search routes through AMap,
 *                           'false'/absent → native TREK behaviour (Nominatim,
 *                           or Google when a Places key resolves)
 *
 * Coordinates: AMap answers in GCJ-02. Everything TREK stores and draws is
 * WGS-84, so every coordinate that leaves this file is already converted
 * (iterative inverse, sub-metre). AMap route polylines are converted vertex by
 * vertex, so the drawn line sits on OSM tiles where the road actually is.
 *
 * restapi.amap.com is a fixed public host and no part of the URL is ever
 * user-configurable, so these calls use plain `fetch`; the SSRF guard would add
 * nothing here.
 */

const BASE = 'https://restapi.amap.com';
const TIMEOUT_MS = 12_000;

export function readAmapSetting(db: DatabaseService, key: string): string | null {
  // app_settings holds two kinds of rows; this helper is only used for the
  // plaintext `amap_search_enabled` flag — the key itself goes through
  // readInstanceApiKey so at-rest encryption applies.
  return db.get<{ value: string | null }>('SELECT value FROM app_settings WHERE key = ?', key)?.value ?? null;
}

export function getAmapKey(db: DatabaseService): string | null {
  const key = readInstanceApiKey(db, 'amap_api_key');
  return key && key.trim() ? key.trim() : null;
}

export function isAmapSearchEnabled(db: DatabaseService): boolean {
  return readAmapSetting(db, 'amap_search_enabled') === 'true' && !!getAmapKey(db);
}

function toGcj(p: { lat: number; lng: number }): string {
  const g = wgs84ToGcj02(p.lng, p.lat);
  return `${g.lng.toFixed(6)},${g.lat.toFixed(6)}`;
}

async function amapFetchV3(path: string, params: URLSearchParams, key: string): Promise<any> {
  params.set('key', key);
  const res = await fetch(`${BASE}${path}?${params.toString()}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = (await res.json().catch(() => ({}))) as any;
  if (data?.status !== '1') {
    throw new Error(`AMap ${path} failed: ${data?.info || `HTTP ${res.status}`}`);
  }
  return data;
}

/** v4 (bicycling) answers with `errcode: 0` + `data`, not v3's `status: '1'`. */
async function amapFetchV4(path: string, params: URLSearchParams, key: string): Promise<any> {
  params.set('key', key);
  const res = await fetch(`${BASE}${path}?${params.toString()}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = (await res.json().catch(() => ({}))) as any;
  if (data?.errcode !== 0) {
    throw new Error(`AMap ${path} failed: ${data?.errmsg || `HTTP ${res.status}`}`);
  }
  return data;
}

export interface AmapSearchPlace {
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  amap_id: string | null;
  website: null;
  phone: string | null;
  rating: null;
  source: 'amap';
  amap_type: string | null;
}

/** POI text search (v5 place/text), results converted to WGS-84. */
export async function amapSearchPlaces(
  db: DatabaseService,
  query: string,
  opts: { locationBias?: { lat: number; lng: number; radius?: number } | null; limit?: number } = {},
): Promise<AmapSearchPlace[]> {
  const key = getAmapKey(db);
  if (!key) return [];
  const params = new URLSearchParams({
    keywords: query,
    offset: String(opts.limit ?? 10),
    page: '1',
    extensions: 'base',
    output: 'JSON',
  });
  if (opts.locationBias && Number.isFinite(opts.locationBias.lat) && Number.isFinite(opts.locationBias.lng)) {
    const g = wgs84ToGcj02(opts.locationBias.lng, opts.locationBias.lat);
    params.set('location', `${g.lng.toFixed(6)},${g.lat.toFixed(6)}`);
    params.set('radius', String(Math.min(Math.max(opts.locationBias.radius ?? 50_000, 1000), 300_000)));
    params.set('sortrule', 'distance');
  }
  const data = await amapFetchV3('/v5/place/text', params, key);
  const pois: any[] = data.pois || [];
  return pois.map((poi) => {
    const [lngStr, latStr] = String(poi.location || '').split(',');
    const lng = Number.parseFloat(lngStr);
    const lat = Number.parseFloat(latStr);
    const wgs = Number.isFinite(lng) && Number.isFinite(lat) ? gcj02ToWgs84(lng, lat) : null;
    return {
      name: poi.name || '',
      address: [poi.pname, poi.adname, poi.address].filter(Boolean).join(' · ') || String(poi.address || ''),
      lat: wgs ? wgs.lat : null,
      lng: wgs ? wgs.lng : null,
      amap_id: poi.id || null,
      website: null,
      phone: String(poi.tel || '') || null,
      rating: null,
      source: 'amap' as const,
      amap_type: String(poi.type || '') || null,
    };
  });
}

export interface AmapRouteLeg {
  distance: number; // metres
  duration: number; // seconds
}

export interface AmapRouteResult {
  /** WGS-84 [lat, lng] polyline for the whole route. */
  coordinates: [number, number][];
  distance: number;
  duration: number;
  legs: AmapRouteLeg[];
}

function appendPolyline(coords: [number, number][], raw: string): void {
  for (const pair of raw.split(';')) {
    const [lngStr, latStr] = pair.split(',');
    const lng = Number.parseFloat(lngStr);
    const lat = Number.parseFloat(latStr);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    const w = gcj02ToWgs84(lng, lat);
    const last = coords[coords.length - 1];
    if (!last || last[0] !== w.lat || last[1] !== w.lng) coords.push([w.lat, w.lng]);
  }
}

/**
 * One request per consecutive waypoint pair (leg-by-leg), for every profile.
 * Walking (v3) rejects >2 points outright and driving's multi-waypoint `paths`
 * omit per-leg durations without a second round-trip anyway; legs are exactly
 * what the day sidebar renders between places, so per-pair fetches are the
 * shape that needs no post-processing. The client caches per coordinate set.
 *
 * `strategy=0` (速度优先) on driving: for a future departure time the closest
 * documented v3 option. Real-time congestion is folded into `duration` by
 * AMap itself on the day of travel.
 */
export async function amapRoute(
  db: DatabaseService,
  profile: 'driving' | 'walking' | 'cycling',
  waypoints: { lat: number; lng: number }[],
): Promise<AmapRouteResult> {
  const key = getAmapKey(db);
  if (!key) throw new Error('AMap key not configured');
  if (waypoints.length < 2) throw new Error('At least 2 waypoints required');

  const legs: AmapRouteLeg[] = [];
  const coordinates: [number, number][] = [];

  for (let i = 0; i < waypoints.length - 1; i++) {
    const origin = toGcj(waypoints[i]);
    const destination = toGcj(waypoints[i + 1]);

    if (profile === 'cycling') {
      const data = await amapFetchV4(
        '/v4/direction/bicycling',
        new URLSearchParams({
          origin,
          destination,
        }),
        key,
      );
      const path = data.data?.paths?.[0];
      if (!path) throw new Error('AMap: no cycling route found');
      legs.push({ distance: Number(path.distance) || 0, duration: Number(path.duration) || 0 });
      for (const step of path.steps || []) appendPolyline(coordinates, String(step.polyline || ''));
    } else {
      const path = profile === 'walking' ? '/v3/direction/walking' : '/v3/direction/driving';
      const params = new URLSearchParams({
        origin,
        destination,
        extensions: 'base',
        output: 'JSON',
      });
      if (profile === 'driving') params.set('strategy', '0');
      const data = await amapFetchV3(path, params, key);
      const routePath = data.route?.paths?.[0];
      if (!routePath) throw new Error(`AMap: no ${profile} route found`);
      legs.push({ distance: Number(routePath.distance) || 0, duration: Number(routePath.duration) || 0 });
      for (const step of routePath.steps || []) appendPolyline(coordinates, String(step.polyline || ''));
    }
  }

  if (!coordinates.length) throw new Error('AMap: route returned no geometry');
  return {
    coordinates,
    distance: legs.reduce((s, l) => s + l.distance, 0),
    duration: legs.reduce((s, l) => s + l.duration, 0),
    legs,
  };
}
