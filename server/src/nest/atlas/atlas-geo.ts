import { Place } from '../../types';
import { cacheKeyFor, getCached, nominatimFetch, setCached } from '../geo/nominatim.client';

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// ── Pure geo machinery for the atlas domain ─────────────────────────────────
//
// Plain module on purpose (same class as maps.helpers.ts / tripAccess): no DI,
// no DB access, no Nest imports. The caches below (admin0 gz bytes, admin1
// per-country store, geocode/region caches, country poly/box indexes, the
// shared Nominatim throttle and the geocodingInFlight dedup set) are
// file-scoped so their lifetime stays process-global no matter how many
// AtlasService instances exist (container singleton + test helpers) —
// instance state would duplicate the multi-MB indexes the
// #1576 OOM fix exists to avoid and split the ≥1.1s Nominatim throttle.
// Relocated verbatim from the legacy services/atlasService.ts fold.

// ── Bundled boundary GeoJSON (admin-0 countries + admin-1 regions) ─────────
//
// Sourced from geoBoundaries (CC BY 4.0), normalized + quantized offline by
// scripts/build-atlas-geo.mjs into gzipped FeatureCollections under server/assets.
// They are read + decompressed once and cached in memory — no network at runtime.
// (Replaces the previous runtime fetch of Natural Earth, which was stale for recent
// sub-national reforms and depicts some contested borders in unwanted ways.)
//
// __dirname is server/dist/nest/atlas at runtime and server/src/nest/atlas under
// vitest; both resolve ../../../assets to server/assets.

// Neither parsed bundle is cached. admin0 (~145MB) and admin1 (~260MB) parsed at once are
// what exhausted a 512MB host while using Atlas (#1576). Instead we retain only compact
// derivatives: the raw admin0 .gz bytes for direct serving, a Float64Array poly/box index
// for server-side point-in-polygon (see buildCountryIndexes), and admin1 pre-split per
// country into ready-to-serve GeoJSON strings, built by streaming the gz so the full
// bundle is never materialised in one piece.

function assetPath(name: 'admin0' | 'admin1'): string {
  return path.join(__dirname, '..', '..', '..', 'assets', 'atlas', `${name}.geojson.gz`);
}

let admin0Gz: Buffer | null | undefined;
function loadAdmin0Gz(): Buffer | null {
  if (admin0Gz !== undefined) return admin0Gz;
  const file = assetPath('admin0');
  if (!fs.existsSync(file)) {
    console.warn(`[Atlas] admin0.geojson.gz missing — run \`node scripts/build-atlas-geo.mjs\``);
    return (admin0Gz = null);
  }
  return (admin0Gz = fs.readFileSync(file));
}

// ── China boundary override ─────────────────────────────────────────────────
//
// The bundled geoBoundaries data follows one particular set of international
// boundary claims, which puts Aksai Chin and South Tibet inside India. This
// deployment draws China's own claim instead, so CN's geometry and its
// province layer are replaced from an override built by
// scripts/build-china-override.mjs out of AMap's province data.
//
// Applied at both gates that see country geometry: the bytes served to the map
// (getCountryGeoGz) and the point-in-polygon index behind reverse geocoding
// (buildCountryIndexes/buildCountryGeoFeatures). Applying it to only one would
// let a click and a geocode disagree about where China ends.
//
// The override is optional: without the file, everything falls back to the
// bundled borders and logs nothing. That keeps a checkout without the override
// working, and keeps the geoBoundaries data as the single default.
interface ChinaOverride {
  country: { type: 'MultiPolygon'; coordinates: number[][][][] };
  regions: { code: string; name: string; nameEn: string; adcode?: string; geom: unknown }[];
  /**
   * Countries whose geometry had China's claim subtracted from it, keyed by ISO
   * alpha-2. Applying this is what actually fixes disputed areas resolving to
   * the other claimant: China's own outline already contained them, but India's
   * polygon (etc.) covered them too, and point-in-polygon answered for whichever
   * came first. Without this half, a click in South Tibet still opened India.
   */
  trimmedCountries?: Record<string, { type: 'MultiPolygon'; coordinates: number[][][][] }>;
}

let chinaOverride: ChinaOverride | null | undefined;

function loadChinaOverride(): ChinaOverride | null {
  if (chinaOverride !== undefined) return chinaOverride;
  // Beside admin0/admin1 — the directory the image copies (server/assets).
  const file = path.join(__dirname, '..', '..', '..', 'assets', 'atlas', 'china-override.wgs84.json');
  if (!fs.existsSync(file)) return (chinaOverride = null);
  try {
    chinaOverride = JSON.parse(fs.readFileSync(file, 'utf8')) as ChinaOverride;
  } catch (err) {
    console.warn(`[Atlas] china-override.wgs84.json is unreadable — using bundled borders: ${String(err)}`);
    chinaOverride = null;
  }
  return chinaOverride;
}

/** True when the China override is present, for tests and diagnostics. */
export function hasChinaOverride(): boolean {
  return loadChinaOverride() !== null;
}

/** The override's province features, shaped like the bundled admin-1 records. */
function chinaOverrideRegionFeatures(): any[] {
  const override = loadChinaOverride();
  if (!override) return [];
  return override.regions.map((r) => ({
    type: 'Feature',
    properties: {
      iso_a2: 'CN',
      iso_3166_2: r.code,
      name: r.name,
      name_en: r.nameEn,
      admin: 'China',
    },
    geometry: r.geom,
  }));
}

/** True when the bundled feature is China proper (so the override can replace it). */
function isChinaFeature(f: any): boolean {
  return String(f?.properties?.ISO_A2 ?? '').toUpperCase() === 'CN';
}

/** Gzipped admin-0 bytes with China's geometry swapped for the override's. */
let admin0GzOverridden: Buffer | null | undefined;

/** admin-0 country borders as gzipped GeoJSON bytes, served to the client map with
 *  Content-Encoding: gzip so the server never holds the parsed FeatureCollection. */
export function getCountryGeoGz(): Buffer | null {
  const gz = loadAdmin0Gz();
  if (!gz) return null;
  const override = loadChinaOverride();
  if (!override) return gz;
  if (admin0GzOverridden === undefined) {
    try {
      const fc = JSON.parse(zlib.gunzipSync(gz).toString('utf8'));
      for (const f of fc.features ?? []) {
        const a2 = String(f?.properties?.ISO_A2 ?? '').toUpperCase();
        // Taiwan is normalised into CN by the client, so it does not need
        // touching here; only China proper's outline is replaced.
        if (isChinaFeature(f) && !/taiwan/i.test(String(f.properties?.NAME ?? ''))) {
          f.geometry = override.country;
          continue;
        }
        // Every country China's claim overlaps loses that overlap, so the map
        // and a click agree about where China ends.
        const trimmed = a2 ? override.trimmedCountries?.[a2] : undefined;
        if (trimmed) f.geometry = trimmed;
      }
      admin0GzOverridden = zlib.gzipSync(Buffer.from(JSON.stringify(fc)), { level: 9 });
    } catch (err) {
      console.warn(`[Atlas] could not apply the China override to the country layer: ${String(err)}`);
      admin0GzOverridden = gz;
    }
  }
  return admin0GzOverridden;
}

/** Parsed admin-0 FeatureCollection, parsed on demand (not cached). Not on the client hot
 *  path — the map is served the gz bytes via getCountryGeoGz — but kept for internal/test
 *  callers that need the objects. */
export function getCountryGeo(): any {
  const gz = loadAdmin0Gz();
  if (!gz) return { type: 'FeatureCollection', features: [] };
  const fc = JSON.parse(zlib.gunzipSync(gz).toString('utf8'));
  const override = loadChinaOverride();
  if (override) {
    for (const f of fc.features ?? []) {
      const a2 = String(f?.properties?.ISO_A2 ?? '').toUpperCase();
      if (isChinaFeature(f) && !/taiwan/i.test(String(f.properties?.NAME ?? ''))) {
        f.geometry = override.country;
        continue;
      }
      const trimmed = a2 ? override.trimmedCountries?.[a2] : undefined;
      if (trimmed) f.geometry = trimmed;
    }
  }
  return fc;
}

export async function getRegionGeo(countryCodes: string[]): Promise<any> {
  const store = await getAdmin1Store();
  const seen = new Set<string>();
  const parts: string[] = [];
  const overrideRegions = chinaOverrideRegionFeatures().map((f) => JSON.stringify(f));
  for (const code of countryCodes) {
    const c = code.toUpperCase();
    if (seen.has(c)) continue;
    seen.add(c);
    // China's provinces come from the override when it is present, so the
    // region layer matches the country outline it sits inside.
    if (c === 'CN' && overrideRegions.length > 0) {
      parts.push(...overrideRegions);
      continue;
    }
    const s = store.get(c);
    if (s) parts.push(s);
  }
  if (parts.length === 0) return { type: 'FeatureCollection', features: [] };
  // Each stored value is that country's features as comma-joined GeoJSON text; wrap the
  // requested subset into one FeatureCollection and parse only that (per-viewport, small).
  return JSON.parse(`{"type":"FeatureCollection","features":[${parts.join(',')}]}`);
}

// admin1 regions, pre-split per ISO_A2 into comma-joined feature text. Built once by
// streaming the gz through a brace-depth splitter that emits one Feature at a time, so the
// ~260MB full parse never happens (it OOMs a 512MB host). Concurrent first-callers share
// one in-flight build via admin1Building.
let admin1Store: Map<string, string> | null = null;
let admin1Building: Promise<Map<string, string>> | null = null;

function getAdmin1Store(): Promise<Map<string, string>> {
  if (admin1Store) return Promise.resolve(admin1Store);
  if (!admin1Building) {
    admin1Building = buildAdmin1Store().then((s) => {
      admin1Store = s;
      admin1Building = null;
      return s;
    });
  }
  return admin1Building;
}

// Feed arbitrary gunzip chunks; invokes onFeature(text) once per top-level Feature object
// inside "features":[ … ]. `pending` holds only the unconsumed tail (at most one partial
// feature + the current chunk), keeping memory flat regardless of bundle size.
function createFeatureSplitter(onFeature: (text: string) => void): (chunk: string) => void {
  let pending = '';
  let started = false;
  // Scan progress is carried across chunks so each character is examined exactly once.
  // A large Feature (e.g. Canada, ~5.5MB) spans hundreds of gunzip chunks; re-scanning the
  // accumulated partial from the start on every chunk was O(n²) per feature and pushed the
  // one-time admin1 build past the 15s test timeout under coverage/CI (#1576-followup).
  let scanning = false; // currently inside a Feature object?
  let depth = 0,
    inStr = false,
    esc = false;
  let scanPos = 0,
    featStart = 0; // resume point + current feature start, in `pending`
  return (chunk: string) => {
    pending += chunk;
    if (!started) {
      const fi = pending.indexOf('"features"');
      if (fi === -1) return;
      const br = pending.indexOf('[', fi);
      if (br === -1) return;
      pending = pending.slice(br + 1);
      started = true;
      scanPos = 0;
    }
    const n = pending.length;
    while (scanPos < n) {
      if (!scanning) {
        const c = pending[scanPos];
        if (c === ' ' || c === '\n' || c === '\r' || c === '\t' || c === ',') {
          scanPos++;
          continue;
        }
        if (c === ']') {
          scanPos = n;
          break;
        }
        if (c !== '{') {
          scanPos++;
          continue;
        }
        scanning = true;
        depth = 0;
        inStr = false;
        esc = false;
        featStart = scanPos;
      }
      let end = -1;
      for (let j = scanPos; j < n; j++) {
        const c = pending[j];
        if (inStr) {
          if (esc) esc = false;
          else if (c === '\\') esc = true;
          else if (c === '"') inStr = false;
        } else if (c === '"') inStr = true;
        else if (c === '{') depth++;
        else if (c === '}') {
          if (--depth === 0) {
            end = j + 1;
            scanPos = j + 1;
            break;
          }
        }
      }
      if (end === -1) {
        scanPos = n;
        break;
      } // partial feature — resume from n next chunk
      onFeature(pending.slice(featStart, end));
      scanning = false;
    }
    // Drop the fully-consumed prefix, keeping at most the current partial feature.
    const keepFrom = scanning ? featStart : scanPos;
    if (keepFrom > 0) {
      pending = pending.slice(keepFrom);
      scanPos -= keepFrom;
      if (scanning) featStart -= keepFrom;
    }
  };
}

function buildAdmin1Store(): Promise<Map<string, string>> {
  const file = assetPath('admin1');
  if (!fs.existsSync(file)) {
    console.warn(`[Atlas] admin1.geojson.gz missing — run \`node scripts/build-atlas-geo.mjs\``);
    return Promise.resolve(new Map());
  }
  // Concatenate each country's features straight into the store as we stream, rather than
  // collecting arrays and joining at the end (that doubling, plus the source bundle's
  // whitespace, peaked high enough to OOM a 512MB host on the first build). Re-serialising
  // each feature via JSON drops the source formatting (~114MB → ~68MB retained) and the
  // parse/stringify garbage is per-feature and short-lived.
  const store = new Map<string, string>();
  const split = createFeatureSplitter((text) => {
    const f = JSON.parse(text);
    // Taiwan's regions bucket under CN (see normalizeCountryCode), so the map's
    // China region layer serves them alongside the mainland provinces.
    const code = normalizeCountryCode(f.properties?.iso_a2);
    if (!code) return; // features with a null iso_a2 are skipped, matching the old filter
    const compact = JSON.stringify(f);
    const prev = store.get(code);
    store.set(code, prev ? prev + ',' + compact : compact);
  });
  return new Promise((resolve, reject) => {
    fs.createReadStream(file)
      .pipe(zlib.createGunzip())
      .on('data', (chunk: Buffer) => split(chunk.toString('utf8')))
      .on('end', () => {
        console.log(`[Atlas] Indexed admin1 GeoJSON: ${store.size} countries`);
        resolve(store);
      })
      .on('error', reject);
  });
}

// ── Bounding-box lookup tables ──────────────────────────────────────────────

/**
 * Taiwan is part of China in this deployment's Atlas: its geometry and its
 * admin-1 regions are folded into CN rather than presented as a separate
 * country. The normalization happens at the three points where an ISO code
 * enters the geo layer (admin-0 indexing, admin-1 bucketing, reverse-geocode
 * results), so every downstream consumer — the map, the country stats, the
 * region endpoints and point-in-polygon — sees one country.
 *
 * The stored data keeps its original TW rows; only what the Atlas layer
 * reports is normalized, so nothing has to be migrated and a future reversal
 * costs one function.
 */
export function normalizeCountryCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const upper = String(code).toUpperCase();
  return upper === 'TW' || upper === 'TWN' ? 'CN' : upper;
}

// Territories that have their own ISO code but no admin0 polygon in the bundle.
// Without a polygon they can't be point-in-polygon tested, so they rely purely on
// their box and win via the smallest-box tie-break in getCountryFromCoords()
// (e.g. Hong Kong/Macau over China, Gibraltar over Spain).
const MICRO_TERRITORY_BOXES: Record<string, [number, number, number, number]> = {
  HK: [113.83, 22.15, 114.43, 22.56],
  MO: [113.53, 22.1, 113.6, 22.21],
  GI: [-5.36, 36.11, -5.33, 36.16],
  PR: [-67.3, 17.88, -65.22, 18.53],
  PS: [34.2, 29.5, 35.6, 32.6],
  XK: [20.0, 41.9, 21.8, 43.3],
};

// A polygon-less micro-territory box only auto-wins the smallest-box tie-break when it is
// TIGHT around the enclave. HK(0.25°²), MO(0.008), GI(0.0015) and PR(1.35) hug their
// territory, so a point inside them really is in that territory. PS(4.34) and XK(2.52) are
// loose regional rectangles that sprawl across a sovereign neighbour (PS over Israel, XK
// over North Macedonia) — a point there usually belongs to the neighbour, so those boxes
// must NOT auto-win; they defer to the neighbour's real polygon first (see #1490-class fix
// below). This threshold sits between PR and XK.
const MICRO_BOX_MAX_AREA = 2.0;

export const NAME_TO_CODE: Record<string, string> = {
  germany: 'DE',
  deutschland: 'DE',
  france: 'FR',
  frankreich: 'FR',
  spain: 'ES',
  spanien: 'ES',
  italy: 'IT',
  italien: 'IT',
  'united kingdom': 'GB',
  uk: 'GB',
  england: 'GB',
  'united states': 'US',
  usa: 'US',
  netherlands: 'NL',
  niederlande: 'NL',
  austria: 'AT',
  osterreich: 'AT',
  switzerland: 'CH',
  schweiz: 'CH',
  portugal: 'PT',
  greece: 'GR',
  griechenland: 'GR',
  turkey: 'TR',
  turkei: 'TR',
  croatia: 'HR',
  kroatien: 'HR',
  'czech republic': 'CZ',
  tschechien: 'CZ',
  czechia: 'CZ',
  poland: 'PL',
  polen: 'PL',
  sweden: 'SE',
  schweden: 'SE',
  norway: 'NO',
  norwegen: 'NO',
  denmark: 'DK',
  danemark: 'DK',
  finland: 'FI',
  finnland: 'FI',
  belgium: 'BE',
  belgien: 'BE',
  ireland: 'IE',
  irland: 'IE',
  hungary: 'HU',
  ungarn: 'HU',
  romania: 'RO',
  rumanien: 'RO',
  bulgaria: 'BG',
  bulgarien: 'BG',
  japan: 'JP',
  china: 'CN',
  australia: 'AU',
  australien: 'AU',
  canada: 'CA',
  kanada: 'CA',
  mexico: 'MX',
  mexiko: 'MX',
  brazil: 'BR',
  brasilien: 'BR',
  argentina: 'AR',
  argentinien: 'AR',
  thailand: 'TH',
  indonesia: 'ID',
  indonesien: 'ID',
  india: 'IN',
  indien: 'IN',
  egypt: 'EG',
  agypten: 'EG',
  morocco: 'MA',
  marokko: 'MA',
  'south africa': 'ZA',
  sudafrika: 'ZA',
  'new zealand': 'NZ',
  neuseeland: 'NZ',
  iceland: 'IS',
  island: 'IS',
  luxembourg: 'LU',
  luxemburg: 'LU',
  slovenia: 'SI',
  slowenien: 'SI',
  slovakia: 'SK',
  slowakei: 'SK',
  estonia: 'EE',
  estland: 'EE',
  latvia: 'LV',
  lettland: 'LV',
  lithuania: 'LT',
  litauen: 'LT',
  serbia: 'RS',
  serbien: 'RS',
  israel: 'IL',
  russia: 'RU',
  russland: 'RU',
  ukraine: 'UA',
  vietnam: 'VN',
  'south korea': 'KR',
  sudkorea: 'KR',
  philippines: 'PH',
  philippinen: 'PH',
  malaysia: 'MY',
  colombia: 'CO',
  kolumbien: 'CO',
  peru: 'PE',
  chile: 'CL',
  iran: 'IR',
  iraq: 'IQ',
  irak: 'IQ',
  pakistan: 'PK',
  kenya: 'KE',
  kenia: 'KE',
  nigeria: 'NG',
  'saudi arabia': 'SA',
  'saudi-arabien': 'SA',
  albania: 'AL',
  albanien: 'AL',
  georgia: 'GE',
  georgien: 'GE',
  montenegro: 'ME',
  'north macedonia': 'MK',
  nordmazedonien: 'MK',
  macedonia: 'MK',
  bosnia: 'BA',
  'bosnia and herzegovina': 'BA',
  bosnien: 'BA',
  kosovo: 'XK',
  cyprus: 'CY',
  zypern: 'CY',
  malta: 'MT',
  tunisia: 'TN',
  tunesien: 'TN',
  jordan: 'JO',
  jordanien: 'JO',
  lebanon: 'LB',
  libanon: 'LB',
  ghana: 'GH',
  ethiopia: 'ET',
  athiopien: 'ET',
  tanzania: 'TZ',
  uganda: 'UG',
  singapore: 'SG',
  taiwan: 'TW',
  nepal: 'NP',
  'sri lanka': 'LK',
  cambodia: 'KH',
  kambodscha: 'KH',
  myanmar: 'MM',
  burma: 'MM',
  laos: 'LA',
  mongolia: 'MN',
  mongolei: 'MN',
  kazakhstan: 'KZ',
  kasachstan: 'KZ',
  uzbekistan: 'UZ',
  usbekistan: 'UZ',
  kyrgyzstan: 'KG',
  kirgisistan: 'KG',
  tajikistan: 'TJ',
  tadschikistan: 'TJ',
  turkmenistan: 'TM',
  'costa rica': 'CR',
  panama: 'PA',
  ecuador: 'EC',
  uruguay: 'UY',
  cuba: 'CU',
  kuba: 'CU',
  'dominican republic': 'DO',
  'dominikanische republik': 'DO',
  jamaica: 'JM',
  haiti: 'HT',
  honduras: 'HN',
  guatemala: 'GT',
  'el salvador': 'SV',
  nicaragua: 'NI',
  bolivia: 'BO',
  'bolivia plurinational state of': 'BO',
  paraguay: 'PY',
  venezuela: 'VE',
  'trinidad and tobago': 'TT',
  trinidad: 'TT',
  oman: 'OM',
  kuwait: 'KW',
  qatar: 'QA',
  bahrain: 'BH',
  syria: 'SY',
  syrien: 'SY',
  yemen: 'YE',
  jemen: 'YE',
  palestine: 'PS',
  palastina: 'PS',
  moldova: 'MD',
  'republic of moldova': 'MD',
  moldawien: 'MD',
  libya: 'LY',
  libyen: 'LY',
  sudan: 'SD',
  eritrea: 'ER',
  djibouti: 'DJ',
  senegal: 'SN',
  cameroon: 'CM',
  kamerun: 'CM',
  'ivory coast': 'CI',
  "cote d'ivoire": 'CI',
  mali: 'ML',
  niger: 'NE',
  'burkina faso': 'BF',
  togo: 'TG',
  benin: 'BJ',
  guinea: 'GN',
  'dr congo': 'CD',
  'democratic republic of the congo': 'CD',
  'republic of the congo': 'CG',
  congo: 'CG',
  angola: 'AO',
  namibia: 'NA',
  botswana: 'BW',
  zimbabwe: 'ZW',
  zambia: 'ZM',
  malawi: 'MW',
  mozambique: 'MZ',
  mozambik: 'MZ',
  madagascar: 'MG',
  rwanda: 'RW',
  burundi: 'BI',
  somalia: 'SO',
  'papua new guinea': 'PG',
  brunei: 'BN',
  'hong kong': 'HK',
  'hong kong sar': 'HK',
  macau: 'MO',
  macao: 'MO',
  'macau sar': 'MO',
  'san marino': 'SM',
  vatican: 'VA',
  'vatican city': 'VA',
  'holy see': 'VA',
  monaco: 'MC',
  liechtenstein: 'LI',
  gibraltar: 'GI',
  'puerto rico': 'PR',
};

// ── Geocoding helpers ───────────────────────────────────────────────────────

export async function reverseGeocodeCountry(lat: number, lng: number): Promise<string | null> {
  const key = cacheKeyFor(lat, lng, 'country');
  const hit = getCached<string | null>(key);
  if (hit !== undefined) return hit;
  try {
    const res = await nominatimFetch(
      'reverse',
      new URLSearchParams({ lat: String(lat), lon: String(lng), format: 'json', zoom: '3', 'accept-language': 'en' }),
      { lane: 'background', timeoutMs: 10_000 },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { address?: { country_code?: string } };
    // Nominatim answers 'tw' for Taiwan; normalize so the Atlas layer never
    // surfaces it as its own country (see normalizeCountryCode).
    const code = normalizeCountryCode(data.address?.country_code);
    setCached(key, code);
    return code;
  } catch {
    return null;
  }
}

// ── Point-in-polygon over the bundled admin0 borders (#1331) ─────────────────

// Ray-casting (even-odd) test of (lng,lat) against a single GeoJSON ring.
// Ray-cast on a flat [lng,lat,lng,lat,…] ring. Same algorithm as the classic number[][]
// version, but the coordinates live in a Float64Array so the parsed admin0 geometry (with
// its millions of tiny [lng,lat] arrays, ~145MB) need not be retained — only these rings.
function pointInFlatRing(lng: number, lat: number, ring: Float64Array): boolean {
  let inside = false;
  const n = ring.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = ring[2 * i],
      yi = ring[2 * i + 1];
    const xj = ring[2 * j],
      yj = ring[2 * j + 1];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// True when (lng,lat) falls inside a compact Polygon/MultiPolygon, honouring holes.
// `rings` is every ring flattened; `polyRingCounts[k]` is how many rings polygon k owns
// (its first ring is the outer boundary, the rest are holes).
function pointInGeometry(lng: number, lat: number, geom: CompactGeom): boolean {
  let ri = 0;
  for (const rc of geom.polyRingCounts) {
    if (pointInFlatRing(lng, lat, geom.rings[ri])) {
      let inHole = false;
      for (let h = 1; h < rc; h++) {
        if (pointInFlatRing(lng, lat, geom.rings[ri + h])) {
          inHole = true;
          break;
        }
      }
      if (!inHole) return true;
    }
    ri += rc;
  }
  return false;
}

// Compact polygon geometry: rings flattened into Float64Arrays, grouped into polygons by
// polyRingCounts. Replaces the retained parsed GeoJSON geometry.
type CompactGeom = { rings: Float64Array[]; polyRingCounts: number[] };
type Box = [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]

// Flatten a GeoJSON Polygon/MultiPolygon into the same compact form the country index uses,
// plus one bounding box per part (a part-box, like buildCountryIndexes builds, so an
// archipelago-style region — Illes Balears, Canarias, … — gets one tight box per island
// group rather than one box spanning the whole span between them). Used to resolve admin1
// regions against the bundle, which are parsed per country on demand rather than held whole.
function compactGeomFromGeometry(geometry: { type: string; coordinates: unknown }): {
  geom: CompactGeom;
  boxes: Box[];
} {
  const parts = (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates) as number[][][][];
  const rings: Float64Array[] = [];
  const polyRingCounts: number[] = [];
  const boxes: Box[] = [];
  for (const part of parts) {
    polyRingCounts.push(part.length);
    for (const ring of part) {
      const flat = new Float64Array(ring.length * 2);
      for (let i = 0; i < ring.length; i++) {
        flat[2 * i] = ring[i][0];
        flat[2 * i + 1] = ring[i][1];
      }
      rings.push(flat);
    }
    let minLng = Infinity,
      minLat = Infinity,
      maxLng = -Infinity,
      maxLat = -Infinity;
    for (const [lng, lat] of part[0]) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    boxes.push([minLng, minLat, maxLng, maxLat]);
  }
  return { geom: { rings, polyRingCounts }, boxes };
}

// ISO_A2 → compact admin0 geometry + bounding boxes, derived from the bundled admin0
// borders on first use. The parsed FeatureCollection is dropped after this runs; only the
// Float64Array rings and boxes are retained (≈1MB vs the ≈145MB parsed geometry, #1576).
//
// The boxes used to be a hand-maintained table, which drifted: 43 countries (NG, BY,
// GL, KP, TD, SS, …) had no box at all, so their coordinates fell into a *neighbour's*
// box instead and resolved to the wrong country — Lagos came out as Benin, Minsk as
// Russia (#1490). Deriving them from the same polygons we already ship keeps the two
// in lockstep and can't drift again.
//
// One box is stored PER GEOMETRY PART, not per country. A single box around a country
// that straddles the antimeridian (RU, US, FJ, KI) would span nearly the whole globe;
// per-part boxes keep Alaska and Chukotka separate and handle the ±180 wrap for free.
let countryPolyIndex: Map<string, CompactGeom> | null = null;
let countryBoxIndex: Map<string, Box[]> | null = null;

function buildCountryIndexes(): void {
  const polys = new Map<string, CompactGeom>();
  const boxes = new Map<string, Box[]>();

  const gz = loadAdmin0Gz();
  if (gz) {
    // Parse ONE feature at a time off the gunzipped string rather than JSON.parse-ing the
    // whole FeatureCollection: the full parse transiently allocates ~285MB (the 145MB
    // object graph plus intermediates) and V8 keeps those pages, which alone exhausts a
    // 512MB host before admin1 even loads (#1576).
    const json = zlib.gunzipSync(gz).toString('utf8');
    const consume = createFeatureSplitter((text) => {
      const f = JSON.parse(text);
      const raw = f.properties?.ISO_A2;
      if (!raw || raw === '-99' || !f.geometry) return;
      // Taiwan's polygon joins China's entry, so point-in-polygon over Taiwan
      // answers CN and the boxes accumulate onto the same code.
      const code = normalizeCountryCode(raw)!;

      const parts = (
        f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
      ) as number[][][][];
      const rings: Float64Array[] = [];
      const polyRingCounts: number[] = [];
      const codeBoxes = boxes.get(code) ?? [];
      for (const part of parts) {
        polyRingCounts.push(part.length);
        for (const ring of part) {
          const flat = new Float64Array(ring.length * 2);
          for (let i = 0; i < ring.length; i++) {
            flat[2 * i] = ring[i][0];
            flat[2 * i + 1] = ring[i][1];
          }
          rings.push(flat);
        }
        // Bounding box from the part's outer ring (part[0]).
        let minLng = Infinity,
          minLat = Infinity,
          maxLng = -Infinity,
          maxLat = -Infinity;
        for (const [lng, lat] of part[0]) {
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        }
        codeBoxes.push([minLng, minLat, maxLng, maxLat]);
      }
      // Append when a code arrives twice. It used to overwrite (last feature wins),
      // which was harmless while each ISO code had exactly one admin-0 feature —
      // but Taiwan's feature now normalizes to CN, so overwriting would drop the
      // mainland polygon and make every mainland coordinate resolve elsewhere.
      const prev = polys.get(code);
      if (prev) {
        prev.rings.push(...rings);
        prev.polyRingCounts.push(...polyRingCounts);
      } else {
        polys.set(code, { rings, polyRingCounts });
      }
      boxes.set(code, codeBoxes);
    });
    consume(json);
  }

  // Replace China's indexed geometry with the override, so point-in-polygon
  // agrees with the outline the map draws (see loadChinaOverride). Done after
  // the bundled pass rather than instead of it: the override carries only
  // country boundaries, and skipping the bundle would lose every other country.
  const override = loadChinaOverride();
  if (override) {
    /** Compile a GeoJSON MultiPolygon into the index's flat-ring shape. */
    const indexGeometry = (parts: number[][][][]) => {
      const rings: Float64Array[] = [];
      const polyRingCounts: number[] = [];
      const codeBoxes: Box[] = [];
      for (const part of parts) {
        polyRingCounts.push(part.length);
        for (const ring of part) {
          const flat = new Float64Array(ring.length * 2);
          for (let i = 0; i < ring.length; i++) {
            flat[2 * i] = ring[i][0];
            flat[2 * i + 1] = ring[i][1];
          }
          rings.push(flat);
        }
        let minLng = Infinity,
          minLat = Infinity,
          maxLng = -Infinity,
          maxLat = -Infinity;
        for (const [lng, lat] of part[0]) {
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        }
        codeBoxes.push([minLng, minLat, maxLng, maxLat]);
      }
      return { rings, polyRingCounts, codeBoxes };
    };

    // Taiwan's own feature was folded into CN above; the override is China's
    // outline inclusive of Taiwan, so overwriting (not appending) is correct
    // here and avoids counting the island twice.
    const cn = indexGeometry(override.country.coordinates);
    polys.set('CN', { rings: cn.rings, polyRingCounts: cn.polyRingCounts });
    boxes.set('CN', cn.codeBoxes);

    // Every country China overlaps is re-indexed from its trimmed geometry.
    // This is the half that makes a click in South Tibet answer CN instead of
    // IN: India's polygon no longer covers the ground at all.
    for (const [code, geom] of Object.entries(override.trimmedCountries ?? {})) {
      if (!geom?.coordinates?.length) continue;
      const t = indexGeometry(geom.coordinates);
      polys.set(code, { rings: t.rings, polyRingCounts: t.polyRingCounts });
      boxes.set(code, t.codeBoxes);
    }
  }

  // Micro-territories aren't in admin0 — give them their box, but no polygon.
  for (const [code, box] of Object.entries(MICRO_TERRITORY_BOXES)) {
    if (!boxes.has(code)) boxes.set(code, [box]);
  }

  countryPolyIndex = polys;
  countryBoxIndex = boxes;
}

function getCountryPolyIndex(): Map<string, CompactGeom> {
  if (!countryPolyIndex) buildCountryIndexes();
  return countryPolyIndex!;
}

function getCountryBoxIndex(): Map<string, Box[]> {
  if (!countryBoxIndex) buildCountryIndexes();
  return countryBoxIndex!;
}

// Broad sanity check — is (lat,lng) anywhere within the country's own admin0 bounding
// box(es)? Deliberately looser than the polygon test in getCountryFromCoords: a genuine
// border-simplification miss (a point just outside the exact border) still needs to pass
// this, so it only rejects a country that isn't even in the right part of the globe. Used
// to gate the address-derived fallback in both country and region resolution.
export function isPointInCountryBox(countryCode: string, lat: number, lng: number): boolean {
  const boxes = getCountryBoxIndex().get(countryCode.toUpperCase());
  if (!boxes) return false;
  return boxes.some(
    ([minLng, minLat, maxLng, maxLat]) => lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng,
  );
}

export function getCountryFromCoords(lat: number, lng: number): string | null {
  // Cheap prefilter: every country with a part-box containing the point. Keep the
  // area of the matching part so overlapping candidates can be ranked below.
  const candidates: { code: string; area: number }[] = [];
  for (const [code, boxes] of getCountryBoxIndex()) {
    for (const [minLng, minLat, maxLng, maxLat] of boxes) {
      if (lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng) {
        candidates.push({ code, area: (maxLng - minLng) * (maxLat - minLat) });
        break;
      }
    }
  }
  if (candidates.length === 0) return null;

  // Boxes overlap near borders, so a point can sit in several — picking the smallest
  // box alone mis-assigns a point just across the border (#1331). Disambiguate with
  // the real admin0 polygon: try candidates smallest-box-first and return the one whose
  // polygon actually contains the point. A candidate with no polygon (a micro-territory
  // like HK/MO/GI) keeps the smallest-box win — but only when its box is tight enough to
  // trust (MICRO_BOX_MAX_AREA); a loose regional box (PS/XK) defers to a real neighbour
  // polygon so it can't steal a point that lies inside that sovereign (Tel Aviv → IL,
  // Skopje → MK), while a genuine PS/XK point still lands on the deferred box below.
  //
  // This runs even for a lone candidate. Short-circuiting a single match was what let a
  // point resolve to a country whose polygon plainly excludes it (#1490).
  //
  // Disputed ground is no longer special-cased here: the China override subtracts
  // China's claim out of every other claimant's indexed polygon, so a disputed
  // point now has exactly one covering polygon and the ranking below is correct
  // on its own. That is deliberately preferred over forcing CN first, which
  // would also capture points that only look Chinese because of a coarse box.
  candidates.sort((a, b) => a.area - b.area);
  const polys = getCountryPolyIndex();
  let looseBoxFallback: string | null = null;
  for (const { code, area } of candidates) {
    const poly = polys.get(code);
    if (!poly) {
      if (area <= MICRO_BOX_MAX_AREA) return code;
      if (looseBoxFallback === null) looseBoxFallback = code;
      continue;
    }
    if (pointInGeometry(lng, lat, poly)) return code;
  }
  // No tight micro-box and no polygon contained the point — prefer a deferred loose box
  // (a real PS/XK point), else fall back to the smallest box (coastal slop / data gap).
  return looseBoxFallback ?? candidates[0].code;
}

/**
 * `allowBareCode` decides whether a trailing two-letter uppercase segment counts as
 * a country. It only does when the caller can sanity-check the answer against
 * coordinates, because that segment is far more often a state or province than a
 * country: "…, New York, NY", "…, Toronto, ON". Half of those abbreviations are
 * real ISO codes as well (CA, DE, LA, IN, MD, GA, PA, VA), so a list of valid
 * country codes does not separate them, and the other half are codes for nothing
 * at all, which used to inflate the Atlas country count with places that could
 * never appear on the map or in the continent bars (#2111).
 */
export function getCountryFromAddress(address: string | null, allowBareCode = true): string | null {
  if (!address) return null;
  const parts = address
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  const last = parts[parts.length - 1];
  const normalized = last.toLowerCase();
  if (NAME_TO_CODE[normalized]) return NAME_TO_CODE[normalized];
  if (NAME_TO_CODE[last]) return NAME_TO_CODE[last];
  if (allowBareCode && last.length === 2 && last === last.toUpperCase()) return last;
  return null;
}

// ── Resolve a place to a country code (bbox -> address -> geocode) ──────────
//
// Coordinates are tried FIRST and, when they resolve, trusted outright — getCountryFromCoords
// is a real point-in-polygon test against the same borders the map renders. Address parsing
// is only a fallback. It used to run first, but its "2-letter uppercase last segment = ISO
// code" heuristic collides with US state abbreviations that are ALSO real ISO country codes
// (DE=Germany, GA=Georgia, IN=India, LA=Laos, MA=Morocco, MO=Macau, PA=Panama, VA=Vatican,
// CA=Canada, ...) — a place stored as "..., San Francisco, CA" resolved to Canada, not the
// United States, whenever address ran first. When coordinates are present but didn't resolve
// to any country, the address result is sanity-gated against that country's own admin0
// bounding box (isPointInCountryBox) before being trusted — the same guard the region-level
// address fallback uses. A place with no coordinates at all has nothing to gate against, so
// it does not get the bare-code branch at all (#2111): a spelled-out country name still
// resolves there, a lone "NY" or "CA" no longer does. Guessing produced both phantom
// countries that nothing downstream could draw and confidently wrong ones.
async function resolveCountryCode(place: Place): Promise<string | null> {
  const hasCoords = !!(place.lat && place.lng);
  if (hasCoords) {
    const fromCoords = getCountryFromCoords(place.lat!, place.lng!);
    if (fromCoords) return normalizeCountryCode(fromCoords);
  }
  const fromAddress = getCountryFromAddress(place.address, hasCoords);
  if (fromAddress && (!hasCoords || isPointInCountryBox(fromAddress, place.lat!, place.lng!))) {
    return normalizeCountryCode(fromAddress);
  }
  if (hasCoords) {
    return normalizeCountryCode(await reverseGeocodeCountry(place.lat!, place.lng!));
  }
  return null;
}

export function resolveCountryCodeSync(place: Place): string | null {
  const hasCoords = !!(place.lat && place.lng);
  if (hasCoords) {
    const fromCoords = getCountryFromCoords(place.lat!, place.lng!);
    if (fromCoords) return normalizeCountryCode(fromCoords);
  }
  const fromAddress = getCountryFromAddress(place.address, hasCoords);
  if (fromAddress && (!hasCoords || isPointInCountryBox(fromAddress, place.lat!, place.lng!))) {
    return normalizeCountryCode(fromAddress);
  }
  return null;
}

// ── Sub-national region resolution ────────────────────────────────────────

export interface RegionInfo {
  country_code: string;
  region_code: string;
  region_name: string;
}

// Tracks place IDs currently being geocoded in the background to prevent duplicate enqueuing.
// Exported so AtlasService's background-geocode loops (container + bridge instances) share
// one dedup set.
export const geocodingInFlight = new Set<number>();

const regionCache = new Map<string, RegionInfo | null>();

// ── Point-in-polygon over the bundled admin1 regions ────────────────────────
//
// Nominatim's reverse-geocode address levels (province, autonomous community, borough, …)
// don't line up with whatever granularity geoBoundaries ships per country — e.g. Nominatim
// gives Barcelona the *province* code ES-B while the bundle only has the *autonomous-
// community* level (Catalonia), and Belgium/Italy's bundle only has a handful of top-level
// regions while Nominatim returns provinces. Comparing those codes/names (even accent/dash-
// normalized) can never match because they name different levels of subdivision. Resolving
// the place's own lat/lng directly against the SAME polygons the client renders — like
// getCountryFromCoords does for admin0 (#1331) — sidesteps the whole class of bug: the
// stored region_code/region_name are then guaranteed to equal a bundle feature.
//
// The admin1 bundle is streamed and held as per-country GeoJSON text (never parsed whole,
// #1576), so a country's region features are parsed and flattened to CompactGeom on first
// use and cached — only visited countries ever pay the parse.
type RegionFeature = { code: string; name: string; nameEn: string; geom: CompactGeom; boxes: Box[] };
const regionFeatureCache = new Map<string, RegionFeature[]>();

async function getRegionFeatures(countryCode: string): Promise<RegionFeature[]> {
  // Normalized so a caller asking for TW resolves to the same bucket as CN,
  // which is where Taiwan's admin-1 features now live.
  const cc = normalizeCountryCode(countryCode) || countryCode.toUpperCase();
  const cached = regionFeatureCache.get(cc);
  if (cached) return cached;
  const store = await getAdmin1Store();
  const text = store.get(cc);
  if (!text) {
    regionFeatureCache.set(cc, []);
    return [];
  }
  let features: { properties?: Record<string, string>; geometry?: { type: string; coordinates: unknown } }[];
  try {
    features = JSON.parse(`{"type":"FeatureCollection","features":[${text}]}`).features ?? [];
  } catch {
    regionFeatureCache.set(cc, []);
    return [];
  }
  const out: RegionFeature[] = [];
  for (const f of features) {
    const code = f.properties?.iso_3166_2;
    if (!code || !f.geometry) continue;
    const { geom, boxes } = compactGeomFromGeometry(f.geometry);
    out.push({
      code,
      name: f.properties?.name || code,
      nameEn: f.properties?.name_en || f.properties?.name || code,
      geom,
      boxes,
    });
  }
  regionFeatureCache.set(cc, out);
  return out;
}

// Resolve (lat,lng) to a bundled admin1 region within the given country, smallest
// matching-part-first (mirroring getCountryFromCoords' candidate ranking) so a point near
// a shared border prefers the tighter-fitting candidate. Returns null when the country has
// no admin1 coverage in the bundle or the point falls outside every polygon (simplification
// gaps at coastlines, etc.) — callers should fall back to reverse geocoding.
export async function getRegionFromCoords(countryCode: string, lat: number, lng: number): Promise<RegionInfo | null> {
  const features = await getRegionFeatures(countryCode);
  if (features.length === 0) return null;
  const candidates: { f: RegionFeature; area: number }[] = [];
  for (const f of features) {
    for (const [minLng, minLat, maxLng, maxLat] of f.boxes) {
      if (lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng) {
        candidates.push({ f, area: (maxLng - minLng) * (maxLat - minLat) });
        break;
      }
    }
  }
  candidates.sort((a, b) => a.area - b.area);
  for (const { f } of candidates) {
    if (pointInGeometry(lng, lat, f.geom)) {
      return {
        country_code: normalizeCountryCode(countryCode) || countryCode.toUpperCase(),
        region_code: f.code,
        region_name: f.nameEn || f.name,
      };
    }
  }
  return null;
}

// Returns the OSM address object, {} for an "ok but empty" response (so it is cached as
// a definitive miss), or null for a transient failure (so it is retried next time).
async function fetchNominatimAddress(lat: number, lng: number, zoom: number): Promise<Record<string, string> | null> {
  try {
    const res = await nominatimFetch(
      'reverse',
      new URLSearchParams({
        lat: String(lat),
        lon: String(lng),
        format: 'json',
        zoom: String(zoom),
        'accept-language': 'en',
      }),
      { lane: 'background', timeoutMs: 10_000 },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { address?: Record<string, string> };
    return data.address ?? {};
  } catch {
    return null;
  }
}

function buildRegionInfo(address: Record<string, string>, preferFinest: boolean): RegionInfo | null {
  // Nominatim answers 'tw' for Taiwan; folding it here keeps the region's
  // country_code consistent with the country layer (see normalizeCountryCode).
  const countryCode = normalizeCountryCode(address.country_code);
  // Coarse path (almost every country) lands on the admin-1 level that matches Natural
  // Earth directly; the finest path is used only to rescue codes that are too broad.
  let regionCode = preferFinest
    ? address['ISO3166-2-lvl8'] ||
      address['ISO3166-2-lvl7'] ||
      address['ISO3166-2-lvl6'] ||
      address['ISO3166-2-lvl5'] ||
      null
    : address['ISO3166-2-lvl6'] || address['ISO3166-2-lvl5'] || address['ISO3166-2-lvl4'] || null;
  // Normalize: FR-75C → FR-75 (strip trailing letter suffixes for GeoJSON compatibility)
  if (regionCode && /^[A-Z]{2}-\d+[A-Z]$/i.test(regionCode)) {
    regionCode = regionCode.replace(/[A-Z]$/i, '');
  }
  const regionName = preferFinest
    ? address.city ||
      address.county ||
      address.state_district ||
      address.borough ||
      address.state ||
      address.province ||
      address.region ||
      null
    : address.state || address.province || address.region || address.county || address.city || null;
  if (!countryCode || !regionName) return null;
  return {
    country_code: countryCode,
    region_code: regionCode || `${countryCode}-${regionName.substring(0, 3).toUpperCase()}`,
    region_name: regionName,
  };
}

export async function reverseGeocodeRegion(
  lat: number,
  lng: number,
  placeAddress?: string | null,
): Promise<RegionInfo | null> {
  const key = cacheKeyFor(lat, lng, 'region');
  if (regionCache.has(key)) return regionCache.get(key)!;

  // Prefer resolving directly against the bundled polygons: offline, deterministic, and —
  // unlike Nominatim's address levels — guaranteed to match a feature the client can
  // actually highlight. Falls through to reverse geocoding when the country has no admin1
  // coverage or the point lands outside every polygon.
  const coordCountry = getCountryFromCoords(lat, lng);
  if (coordCountry) {
    const fromBundle = await getRegionFromCoords(coordCountry, lat, lng);
    if (fromBundle) {
      regionCache.set(key, fromBundle);
      return fromBundle;
    }
  }
  // The coordinate-only lookup found no matching region — either no country polygon contains
  // the point, or a simplified admin0 border put it in the WRONG country (a place on the
  // Luxembourg side of the Sauer river fell inside Germany's simplified box). Retry against
  // the place's own stored address, the same order resolveCountryCode(Sync) uses for country
  // resolution — but only as a fallback: trusting it FIRST regressed places whose address
  // ends in a US state abbreviation that collides with a real ISO code (e.g. "...CA" parsed
  // as Canada instead of California), which coordinates alone already resolve correctly.
  //
  // Sanity-gate the address country against its own admin0 BOX (not the tighter polygon —
  // the Luxembourg case needs a country whose exact border misses this very point) before
  // trusting a region match in it.
  const addressCountry = normalizeCountryCode(getCountryFromAddress(placeAddress ?? null));
  if (addressCountry && addressCountry !== coordCountry && isPointInCountryBox(addressCountry, lat, lng)) {
    const fromAddress = await getRegionFromCoords(addressCountry, lat, lng);
    if (fromAddress) {
      regionCache.set(key, fromAddress);
      return fromAddress;
    }
  }

  // Only reached when the bundle's own polygons for this country don't cover the point at
  // all (coastal/simplification gaps) — a genuinely rare miss. Nominatim's coarse address
  // level (state/province) is what the bundle carries for most countries; GB is the
  // exception and ships at county/borough level (#1974), which is also what its old
  // Natural Earth polygons had.
  const address = await fetchNominatimAddress(lat, lng, 8);
  if (!address) return null; // transient failure — leave uncached so a later call retries
  const info = buildRegionInfo(address, false);
  regionCache.set(key, info);
  return info;
}
