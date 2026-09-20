#!/usr/bin/env node
/**
 * Build the China boundary override from AMap province data.
 *
 * Why this exists: the Atlas country layer ships geoBoundaries, which follows a
 * particular set of international boundary claims. For China that means Aksai
 * Chin and South Tibet (Arunachal) are drawn inside India, which is not the map
 * this deployment wants. AMap's own province data carries China's claim, so it
 * is folded in here instead.
 *
 * Input:  server/scripts/data/china-provinces.gcj02.geojson
 *         (AMap province-level outlines, GCJ-02, one feature per province)
 * Output: server/scripts/data/china-override.wgs84.json
 *         {
 *           country: <MultiPolygon in WGS-84>,   // all provinces merged
 *           regions: [ { code, name, nameEn, geom } ]  // per province, WGS-84
 *         }
 *
 * Two things this script is careful about:
 *
 * 1. **Coordinate frame.** AMap answers in GCJ-02; everything Tourism-Team
 *    stores and draws is WGS-84. Every vertex is converted with the same
 *    `gcj02ToWgs84` the server uses at runtime, so the override cannot drift
 *    from how a live AMap answer is treated.
 *
 * 2. **The union is computed, not approximated.** Merging provinces by simply
 *    concatenating their rings would leave every internal provincial border as
 *    a seam in the country outline — visible as a mesh of lines across China
 *    and, worse, as gaps where simplification pulled two provinces apart. The
 *    provinces are therefore unioned with polygon-clipping, which is why this
 *    is a build step with a dependency rather than a runtime transform.
 *
 * Run: node server/scripts/build-china-override.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

import polygonClipping from 'polygon-clipping';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, 'data', 'china-provinces.gcj02.geojson');
/** The bundled country layer, read here so the disputed features keep their
 *  geoBoundaries geometry rather than a hand-copied approximation. */
const assetPath = (name) => path.join(__dirname, '..', 'assets', 'atlas', `${name}.geojson.gz`);
// The output is runtime data, so it lives beside admin0/admin1 under assets/ —
// that is the directory the Docker image copies. Keeping it under scripts/ would
// leave the override out of a built image, where it would silently do nothing.
const OUT = path.join(__dirname, '..', 'assets', 'atlas', 'china-override.wgs84.json');

// ── GCJ-02 → WGS-84 (mirrors server/src/nest/geo/gcj02.ts) ──────────────────
const PI = Math.PI;
const A = 6378245.0;
const EE = 0.006693421622965943;

function transformLat(x, y) {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(y * PI) + 40.0 * Math.sin((y / 3.0) * PI)) * 2.0) / 3.0;
  ret += ((160.0 * Math.sin((y / 12.0) * PI) + 320 * Math.sin((y * PI) / 30.0)) * 2.0) / 3.0;
  return ret;
}

function transformLng(x, y) {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(x * PI) + 40.0 * Math.sin((x / 3.0) * PI)) * 2.0) / 3.0;
  ret += ((150.0 * Math.sin((x / 12.0) * PI) + 300.0 * Math.sin((x / 30.0) * PI)) * 2.0) / 3.0;
  return ret;
}

function outOfChina(lng, lat) {
  return !(lng > 73.66 && lng < 135.05 && lat > 3.86 && lat < 53.55);
}

function wgs84ToGcj02(lng, lat) {
  if (outOfChina(lng, lat)) return { lng, lat };
  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = (lat / 180.0) * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / (((A * (1 - EE)) / (magic * sqrtMagic)) * PI);
  dLng = (dLng * 180.0) / ((A / sqrtMagic) * Math.cos(radLat) * PI);
  return { lng: lng + dLng, lat: lat + dLat };
}

function gcj02ToWgs84(lng, lat) {
  if (outOfChina(lng, lat)) return { lng, lat };
  let wLng = lng;
  let wLat = lat;
  for (let i = 0; i < 3; i++) {
    const g = wgs84ToGcj02(wLng, wLat);
    wLng += lng - g.lng;
    wLat += lat - g.lat;
  }
  return { lng: wLng, lat: wLat };
}

/**
 * Round to 2 decimals for the final outline, 3 for provinces. Deliberately the
 * same precision build-atlas-geo.mjs uses for ADM0/ADM1: this override replaces
 * those features, so a finer grid here would make China's outline visibly more
 * detailed than every neighbour's.
 *
 * Applied ONLY to geometry on its way out. The clipper is fed full-precision
 * input, because rounding first collapses near-duplicate vertices into repeats
 * and then fails to close its output rings ("Unable to complete output ring …")
 * on exactly the long, messy borders this override exists to fix.
 */
const COUNTRY_DECIMALS = 2;
const REGION_DECIMALS = 3;

const r5 = (n, decimals) => {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
};

/**
 * Province code → the ISO-3166-2 style code and English name the Atlas region
 * layer keys on. The Chinese name comes from the source data.
 *
 * adcode is AMap's own administrative code (province level), which is stable
 * and makes a better identity than the country-prefixed name slug the
 * geoBoundaries build synthesises.
 */
const REGION_EN = {
  110000: ['CN-BJ', 'Beijing'],
  120000: ['CN-TJ', 'Tianjin'],
  130000: ['CN-HE', 'Hebei'],
  140000: ['CN-SX', 'Shanxi'],
  150000: ['CN-NM', 'Inner Mongolia'],
  210000: ['CN-LN', 'Liaoning'],
  220000: ['CN-JL', 'Jilin'],
  230000: ['CN-HL', 'Heilongjiang'],
  310000: ['CN-SH', 'Shanghai'],
  320000: ['CN-JS', 'Jiangsu'],
  330000: ['CN-ZJ', 'Zhejiang'],
  340000: ['CN-AH', 'Anhui'],
  350000: ['CN-FJ', 'Fujian'],
  360000: ['CN-JX', 'Jiangxi'],
  370000: ['CN-SD', 'Shandong'],
  410000: ['CN-HA', 'Henan'],
  420000: ['CN-HB', 'Hubei'],
  430000: ['CN-HN', 'Hunan'],
  440000: ['CN-GD', 'Guangdong'],
  450000: ['CN-GX', 'Guangxi'],
  460000: ['CN-HI', 'Hainan'],
  500000: ['CN-CQ', 'Chongqing'],
  510000: ['CN-SC', 'Sichuan'],
  520000: ['CN-GZ', 'Guizhou'],
  530000: ['CN-YN', 'Yunnan'],
  540000: ['CN-XZ', 'Tibet'],
  610000: ['CN-SN', 'Shaanxi'],
  620000: ['CN-GS', 'Gansu'],
  630000: ['CN-QH', 'Qinghai'],
  640000: ['CN-NX', 'Ningxia'],
  650000: ['CN-XJ', 'Xinjiang'],
  710000: ['CN-TW', 'Taiwan'],
  810000: ['CN-HK', 'Hong Kong'],
  820000: ['CN-MO', 'Macau'],
};

/**
 * One province's geometry as polygon-clipping wants it: [[ring, hole…], …].
 *
 * Kept at the source's own precision (not rounded) because these polygons are
 * fed to the clipper; see the note on COUNTRY_DECIMALS for why clipping needs
 * full precision.
 */
function toMultiPolygon(geometry) {
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polys.map((poly) => poly.map((ring) => ring.map(([lng, lat]) => {
    const w = gcj02ToWgs84(lng, lat);
    return [w.lng, w.lat];
  })));
}

/** Round a completed geometry for output. Never applied before clipping. */
function quantizePolys(polys, decimals) {
  return polys.map((poly) => poly.map((ring) => ring.map(([lng, lat]) => [r5(lng, decimals), r5(lat, decimals)])));
}

/**
 * Drop parts that are too small to be real land.
 *
 * The province union leaves hundreds of 4-5 vertex slivers — sub-kilometre
 * artefacts where two provinces' coastlines did not quite meet. Two reasons to
 * remove them rather than ship them:
 *
 *   1. They are invisible at any zoom the Atlas draws, so they only cost bytes.
 *   2. They are what breaks the India subtraction. polygon-clipping fails with
 *      "Unable to complete output ring" when a subject is clipped against a
 *      MultiPolygon carrying that many degenerate fragments, so leaving them in
 *      means the disputed areas silently stay Indian.
 *
 * Threshold is expressed as an area in square degrees (~100 km² at these
 * latitudes), not a vertex count: a genuine small island can be described by
 * very few points, and dropping those would erase real territory.
 */
const MIN_PART_AREA_DEG2 = 1e-4;

function partArea(ring) {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  }
  return Math.abs(sum / 2);
}

function dropSlivers(polys) {
  return polys.filter((poly) => partArea(poly[0]) >= MIN_PART_AREA_DEG2);
}

/**
 * Coarsen every 2nd vertex, ring by ring, keeping the ring closed.
 *
 * This is a workaround for polygon-clipping, not a cartographic choice. Against
 * China's full merged outline (638 parts, ~8900 vertices, hundreds of them
 * 4-5 point fragments) the library aborts the India subtraction with "Unable to
 * complete output ring starting at [68.17, 23.61]" — and India is exactly the
 * polygon that has to be trimmed. Decimating the SUBTRAHEND by two settles the
 * sweep-line on those shared borders while leaving India's own coastline at
 * full resolution, so the result is correct where it matters.
 *
 * Only ever applied to geometry used as the subtrahend. Half the vertices of a
 * 1:1,000,000-scale outline is still finer than the 2-decimal quantization the
 * output gets, so nothing visible is lost.
 */
function decimatePolys(polys, step) {
  if (step <= 1) return polys;
  return polys.map((poly) =>
    poly.map((ring) => {
      if (ring.length <= 4) return ring;
      const out = [];
      for (let i = 0; i < ring.length; i += step) out.push(ring[i]);
      const first = out[0];
      const last = out[out.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) out.push([first[0], first[1]]);
      return out.length >= 4 ? out : ring;
    }),
  );
}

/**
 * Strip consecutive duplicate vertices and drop rings that collapse below four
 * points, closing each ring explicitly.
 *
 * Necessary, not cosmetic: the bundled admin0 geometry carries repeated points
 * (India's first part alone has 203 vertices for 194 distinct positions), and
 * polygon-clipping cannot close an output ring through them — it throws
 * "Unable to complete output ring starting at …". Since India is precisely the
 * polygon that has to be trimmed, without this step the fix silently does not
 * happen and the disputed areas keep resolving to India.
 */
function cleanPolys(polys) {
  const out = [];
  for (const poly of polys) {
    const rings = [];
    for (const ring of poly) {
      const cleaned = [];
      for (const pt of ring) {
        const prev = cleaned[cleaned.length - 1];
        if (prev && prev[0] === pt[0] && prev[1] === pt[1]) continue;
        cleaned.push(pt);
      }
      // Re-close, since a dropped duplicate may have been the closing point.
      if (cleaned.length >= 3) {
        const first = cleaned[0];
        const last = cleaned[cleaned.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) cleaned.push([first[0], first[1]]);
      }
      if (cleaned.length >= 4) rings.push(cleaned);
    }
    if (rings.length > 0) out.push(rings);
  }
  return out;
}

/**
 * Hong Kong and Macau are Special Administrative Regions: they are part of
 * China, but the Atlas keeps them as their own clickable territories (the
 * micro-territory boxes), so their polygons must NOT be merged into the country
 * outline — doing that makes them unselectable, because point-in-polygon over
 * China then answers first for every point inside them.
 */
const SEPARATE_TERRITORY_ADCODES = new Set(['810000', '820000']);

// ── Disputed areas to assign to China ───────────────────────────────────────
//
// The bundled admin0 data does not fold these into any country. It carries them
// as their own features with a null ISO_A2 — geoBoundaries' way of saying
// "disputed, no side chosen" — which has two consequences for the Atlas:
//
//   1. Nothing paints them. A feature with no country code is not visited, not
//      clickable, and not counted: the area renders as a hole between China and
//      India, and clicking it offers no country at all.
//   2. India's own polygon still covers the parts India claims, so anywhere it
//      overlaps resolves to IN and shows India's card.
//
// The operator's instruction is that these belong to China, so each is
// absorbed into China's geometry AND subtracted from every other country's —
// the subtraction is what actually fixes the click behaviour, because leaving
// India's polygon intact means point-in-polygon still answers IN first there.
//
// The names are geoBoundaries' own, matched exactly.
const DISPUTED_TO_CHINA = new Set([
  'Aksai Chin',
  'Demchok',
  'CH-IN',
  'Siachen-Saltoro',
  'Paracel Is',
  'Senkakus',
]);

// Deliberately NOT reassigned: Abyei, Dragonja, Dramana-Shakatoe, Falkland
// Islands, Gaza Strip, Kalapani, Isla Brasilera, Koualou, No Man's Land,
// Sanafir & Tiran Is., West Bank — none of them China's, and the operator
// asked only for the areas listed above.

/** True when this feature is one of the disputed areas China should absorb. */
function isDisputedToChina(f) {
  return DISPUTED_TO_CHINA.has(String(f?.properties?.NAME ?? ''));
}

/** A GeoJSON geometry reduced to polygon-clipping's [ [ring, …], … ] shape. */
function geometryToPolys(geometry) {
  if (!geometry) return [];
  return geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
}

/**
 * The same, cleaned — use this for anything headed into the clipper. The
 * bundled admin0 geometry carries consecutive duplicate vertices, which stops
 * polygon-clipping from closing its output rings (see cleanPolys).
 */
function geometryToCleanPolys(geometry) {
  return cleanPolys(geometryToPolys(geometry));
}

/** [minLng, minLat, maxLng, maxLat] over a polygon set. */
function boundsOf(polys) {
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;
  for (const poly of polys) {
    for (const ring of poly) {
      for (const [lng, lat] of ring) {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
    }
  }
  return [minLng, minLat, maxLng, maxLat];
}

function boxesOverlap(a, b) {
  return !(a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1]);
}

/** China spans roughly 73–135°E, 18–54°N; padded, since this only gates the clip. */
const CHINA_BOX = [70, 15, 140, 57];

function main() {
  const raw = JSON.parse(fs.readFileSync(SRC, 'utf8').replace(/^\uFEFF/, ''));
  console.log(`[china-override] ${raw.features.length} provinces from ${path.basename(SRC)}`);

  const regions = [];
  const allPolygons = [];

  for (const f of raw.features) {
    const adcode = String(f.properties?.adcode ?? '');
    const zhName = f.properties?.name ?? '';
    if (!f.geometry) continue;
    // Cleaned before it reaches the clipper: the province data carries repeated
    // vertices too (same reason as the bundled geometry — see cleanPolys).
    const mp = cleanPolys(toMultiPolygon(f.geometry));
    // HK/MO stay selectable territories, so their polygons go into the region
    // layer but not into the merged country outline (see the note above).
    if (!SEPARATE_TERRITORY_ADCODES.has(adcode)) allPolygons.push(...mp);

    const meta = REGION_EN[adcode];
    regions.push({
      code: meta?.[0] ?? `CN-${adcode}`,
      name: zhName,
      nameEn: meta?.[1] ?? zhName,
      adcode,
      geom: { type: 'MultiPolygon', coordinates: quantizePolys(mp, REGION_DECIMALS) },
    });
  }

  // Union every province into one country outline. Without this the internal
  // provincial borders survive as seams across the drawn country.
  console.log(`[china-override] unioning ${allPolygons.length} province parts…`);
  let merged = polygonClipping.union(allPolygons[0], ...allPolygons.slice(1));

  // Union co-ordinates that were quantized to 2dp can leave degenerate slivers
  // (~4-5 vertex fragments) behind. They are invisible, they bloat the bundle,
  // and they are what makes polygon-clipping give up on the India subtraction
  // below. Removed here; the region layer keeps every province intact, so only
  // the drawn country outline is affected.
  console.log(`[china-override] dropping slivers: ${merged.length} parts before`);
  merged = dropSlivers(merged);
  console.log(`[china-override] country outline kept ${merged.length} parts`);

  // ── Fold the disputed areas in, and cut them out of everyone else ─────────
  //
  // Both halves are needed. Adding them to China makes the area paint and
  // resolve as CN; subtracting them from the countries that also claim them is
  // what stops point-in-polygon (and therefore a click) from answering for the
  // other side first, which is the bug the operator hit after the first pass.
  const bundlePath = assetPath('admin0');
  const bundle = JSON.parse(zlib.gunzipSync(fs.readFileSync(bundlePath)).toString('utf8'));
  const disputed = (bundle.features ?? []).filter(isDisputedToChina);
  console.log(`[china-override] absorbing ${disputed.length} disputed area(s): ${disputed.map((f) => f.properties?.NAME).join(', ')}`);

  if (disputed.length === 0) {
    console.warn('[china-override] no disputed-area features matched — is the admin0 asset built?');
  }
  const disputedPolys = disputed.flatMap((f) => geometryToCleanPolys(f.geometry));

  if (disputedPolys.length > 0) {
    merged = polygonClipping.union(merged, ...disputedPolys);
  }

  // The clipper answers in full precision; re-round so the outline matches the
  // precision of every other country's geometry and the file stays small.
  merged = quantizePolys(merged, COUNTRY_DECIMALS);

  const country = { type: 'MultiPolygon', coordinates: merged };

  // The subtrahend used for trimming other countries. Started at full detail and
  // coarsened only if the clipper refuses — see decimatePolys for why the full
  // outline can defeat it.
  const subtrahendLadder = [merged, decimatePolys(merged, 2), decimatePolys(merged, 4)];

  // Every OTHER country loses whatever overlaps China's final outline. Taken
  // from the merged result rather than from the disputed list alone, so a
  // second claimant of the same ground is handled even if its feature name was
  // not in the list above.
  const subtractFrom = (bundle.features ?? [])
    .filter((f) => {
      const a2 = String(f?.properties?.ISO_A2 ?? '').toUpperCase();
      return a2 && a2 !== '-99' && a2 !== 'CN' && !isDisputedToChina(f) && f.geometry;
    })
    .map((f) => ({ code: String(f.properties.ISO_A2).toUpperCase(), name: f.properties?.NAME, polys: geometryToCleanPolys(f.geometry) }));

  const trimmed = [];
  const reported = [];
  for (const c of subtractFrom) {
    // Compare PER PART, not by the country's overall box. France, the UK and the
    // US all have overseas territories, so their overall bounding box spans the
    // globe and a whole-country test would clip all of them. Only a part that
    // actually reaches China's box can overlap it.
    const nearParts = c.polys.filter((p) => boxesOverlap(boundsOf([p]), CHINA_BOX));
    if (nearParts.length === 0) continue;
    // Everything else this country owns, carried through untouched. Dropping
    // these was a real bug: Russia's parts east of 180° were discarded, so
    // Provideniya stopped resolving to RU at all.
    const farParts = c.polys.filter((p) => !boxesOverlap(boundsOf([p]), CHINA_BOX));

    // Try the full-detail outline first, then progressively coarser ones. The
    // clipper can refuse the exact outline on a long shared border (India,
    // Mongolia) and accept a slightly coarsened one; a country that clips no
    // matter what is left untouched rather than dropped.
    let done = false;
    for (const [attempt, sub] of subtrahendLadder.entries()) {
      try {
        // difference() takes one subject geometry and any number of subtrahends;
        // a MultiPolygon is an array of polygons, which is exactly that shape.
        const result = polygonClipping.difference(nearParts, sub);
        reported.push(attempt === 0 ? (c.name ?? c.code) : `${c.name ?? c.code} (coarsened ×${2 ** attempt})`);
        // Both halves quantized to the same precision, so the output is uniform and
        // stays small. farParts arrive at the bundled precision, which is already
        // finer than 2 decimals, so rounding them is purely a size optimization.
        trimmed.push({
          code: c.code,
          polys: [...quantizePolys(result, COUNTRY_DECIMALS), ...quantizePolys(farParts, COUNTRY_DECIMALS)],
        });
        done = true;
        break;
      } catch {
        /* try the next coarsening */
      }
    }
    if (!done) {
      // Left as it came rather than dropped — losing a whole country over one
      // bad ring would be far worse than a border that is not trimmed.
      console.warn(`[china-override] could not subtract China from ${c.name ?? c.code} at any detail — left untrimmed`);
    }
  }
  console.log(`[china-override] trimmed China's claim out of: ${reported.join(', ') || '(nothing overlapped)'}`);

  const out = {
    country,
    regions,
    // Exported for the server to patch the admin0 bundle's other countries, so
    // the map and the geocoder agree. Keyed by ISO alpha-2.
    trimmedCountries: Object.fromEntries(
      trimmed.filter((t) => t.polys.length > 0).map((t) => [t.code, { type: 'MultiPolygon', coordinates: t.polys }]),
    ),
  };

  fs.writeFileSync(OUT, JSON.stringify(out));
  const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
  console.log(`[china-override] wrote ${path.relative(path.join(__dirname, '..'), OUT)} — ${merged.length} country parts, ${regions.length} regions, ${kb} KB`);
}

main();
