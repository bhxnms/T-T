import { continentForCountry, escapeHtml, type VisitStatus } from '@trek/shared';
import L from 'leaflet';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import apiClient, { mapsApi, pluginsApi, type PluginAtlasLayer } from '../../api/client';
import { attachVectorBasemap, hideLabelLayers, type GlLeafletLayer } from '../../components/Map/VectorBasemap';
import { useToast } from '../../components/shared/Toast';
import { OFM_DARK, OFM_POSITRON } from '../../constants/mapDefaults';
import { getAllLandmarks, getProvinceNameByEnglish } from '../../data/chinaProvinces';
import { useTileUrl } from '../../hooks/useTileUrl';
import { getIntlLanguage, getLocaleForLanguage, useTranslation } from '../../i18n';
import { useSettingsStore } from '../../store/settingsStore';
import type { GeoJsonFeatureCollection } from '../../types';
import { getApiErrorMessage } from '../../types';
import { getCheckedPlaces } from '../../utils/checkinStorage';
import { CHINA_CENTER, getLastLocation, getUserLocation, saveLastLocation } from '../../utils/geolocation';
import { getLandmarkColor } from '../../utils/landmarkIcons';
import { getVisitedLandmarks, toggleLandmarkVisit } from '../../utils/landmarkStorage';
import { isVectorStyle } from '../../utils/tileUrl';
import {
  A2_TO_A3,
  bucketTooltipNeedsScroll,
  bucketTooltipPlacement,
  bucketTooltipWidth,
  boundsIntersect,
  countryColor,
  countryDisplayName,
  countryStatus,
  findBucketDuplicate,
  isBucketDuplicateError,
  isCountryVisible,
  mergeCountryBounds,
  normalizeRegionName,
  normalizeCountryCode,
  REGION_CACHE_MAX,
  regionCacheEvictions,
  wishlistA3Codes,
  withCountryMarkedVisited,
  type AtlasData,
  type AtlasPlaceHit,
  type Bounds,
  type BucketItem,
  type CountryDetail,
} from './atlasModel';

const PLANNED_KEY = 'trek_atlas_show_planned';

/**
 * Landmarks render as plain colored dots (12px, white ring, visited ones gain a
 * soft glow of their own color) — the old per-type pictograms read busy at
 * China-landmark density. The color still encodes the landmark type via
 * getLandmarkColor; the popup carries the icon.
 */
function landmarkDotHtml(color: string, isVisited: boolean): string {
  const glow = isVisited
    ? ` box-shadow:0 0 0 2px rgba(255,255,255,.85), 0 0 0 4px ${hexToRgba(color, 0.4)}, 0 0 10px ${hexToRgba(color, 0.75)};`
    : '';
  return `<span class="tt-landmark-dot${isVisited ? ' visited' : ''}" style="background:${color};${glow}"></span>`;
}

/** Trip places the user checked in — one emerald dot, visually distinct from the type-colored landmark dots. */
function checkinDotHtml(): string {
  return '<span class="tt-landmark-dot tt-checkin-dot" style="background:#10b981"></span>';
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = Number.parseInt(clean.substring(0, 2), 16);
  const g = Number.parseInt(clean.substring(2, 4), 16);
  const b = Number.parseInt(clean.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Diagonal-stripe CanvasPattern for the wishlist country fill, in that
// country's own "if visited" color — built once per render pass so it
// survives Leaflet's Canvas renderer (ctx.fillStyle accepts a CanvasPattern
// object same as a color string). Returns null in environments without a
// real 2D canvas context (e.g. jsdom in tests), so callers must fall back to
// a plain color.
function createWishlistPattern(color: string, dark: boolean): CanvasPattern | null {
  try {
    const size = 8;
    const patternCanvas = document.createElement('canvas');
    patternCanvas.width = size;
    patternCanvas.height = size;
    const ctx = patternCanvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = hexToRgba(color, dark ? 0.14 : 0.2);
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-1, size + 1);
    ctx.lineTo(size + 1, -1);
    ctx.moveTo(-1, 1);
    ctx.lineTo(1, -1);
    ctx.moveTo(size - 1, size + 1);
    ctx.lineTo(size + 1, size - 1);
    ctx.stroke();
    return ctx.createPattern(patternCanvas, 'repeat');
  } catch {
    return null;
  }
}

function useCountryNames(language: string): (code: string) => string {
  const [resolver, setResolver] = useState<(code: string) => string>(() => (code: string) => code);
  useEffect(() => {
    try {
      const dn = new Intl.DisplayNames([getIntlLanguage(language)], { type: 'region' });
      setResolver(() => (code: string) => {
        try {
          return dn.of(code) || code;
        } catch {
          return code;
        }
      });
    } catch {
      /* */
    }
  }, [language]);
  return resolver;
}

/**
 * Atlas page logic — the whole interactive globe lives here: atlas/bucket-list
 * loading, the Leaflet map lifecycle (country + sub-national region layers,
 * bucket markers, viewport-driven region fetching), country/region mark/unmark
 * flows and the country search. AtlasPage stays a wiring container that renders
 * the returned state via its presentational SidebarContent helper.
 * Behaviour is identical to the previous in-component logic.
 */
/** Escapes text interpolated into Leaflet tooltip HTML. */
const escapeTooltipHtml = (value: unknown) =>
  String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char
  );

export function useAtlas() {
  const { t, language } = useTranslation();
  const { settings } = useSettingsStore();
  const navigate = useNavigate();
  const toast = useToast();
  const resolveName = useCountryNames(language);
  const dm = settings.dark_mode;
  const dark =
    dm === true || dm === 'dark' || (dm === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  // Label-free tiles on purpose (the country fills carry the names here), so the
  // user's own template is deliberately not read, only their CARTO key.
  const tileUrl = useTileUrl(dark ? OFM_DARK : OFM_POSITRON, true);
  // The template is read through a ref inside the map effect so a template change —
  // the CARTO key arriving after the first render is the usual one — retiles the
  // layers below instead of tearing the whole map down and building it again (#2097).
  const tileUrlRef = useRef(tileUrl);
  tileUrlRef.current = tileUrl;
  const tileLayersRef = useRef<L.TileLayer[]>([]);
  const glLayerRef = useRef<GlLeafletLayer | null>(null);
  // The vector basemap loads async; a map torn down before it lands must not get one.
  const cancelledRef = useRef(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const geoLayerRef = useRef<L.GeoJSON | null>(null);
  // One renderer per map, not one per redraw: Leaflet registers a renderer as a layer
  // of its own and leaves its container in the pane when the GeoJSON layer is removed,
  // so building a fresh one on every rebuild left an orphaned canvas/svg behind that
  // kept redrawing itself on every pan for the rest of the session (#1950).
  const countryRendererRef = useRef<L.Canvas | null>(null);
  const regionRendererRef = useRef<L.SVG | null>(null);
  const glareRef = useRef<HTMLDivElement>(null);
  const borderGlareRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const country_layer_by_a2_ref = useRef<Record<string, any>>({});
  // Merged bounds per country code. Two admin-0 features can carry the same code
  // once Taiwan is folded into China (its ISO_A2 is rewritten to CN), and a plain
  // `ref[code] = layer` assignment let the LAST one win — so CN's entry ended up
  // holding Taiwan's tiny polygon. Every consumer of that ref asks for bounds
  // (viewport culling, search fitBounds), so the culling then measured Taiwan
  // against a view of Xinjiang, concluded China was off screen, and dropped the
  // region layer: Chinese provinces stopped highlighting unless Taiwan happened
  // to be in view too. Bounds are unioned here instead of overwritten.
  const country_bounds_by_a2_ref = useRef<Record<string, Bounds>>({});

  /** Register a country feature's bounds, unioning when the code repeats.
   *
   *  Every read is guarded and a missing/unusable bound is simply not recorded:
   *  countryInView fails open for an unrecorded code, so a layer whose bounds
   *  cannot be read stays in view rather than vanishing from the map. */
  const registerCountryBounds = (code: string, layer: any): void => {
    if (!code) return;
    try {
      const b = layer?.getBounds?.();
      if (!b || typeof b.getSouth !== 'function') return;
      // Cloned, not extended in place: Leaflet caches the bounds object on the layer
      // and hands back the same instance, so extending it would grow the layer's own
      // reported extent. The union itself lives in atlasModel.mergeCountryBounds.
      mergeCountryBounds(country_bounds_by_a2_ref.current, code, {
        south: b.getSouth(),
        west: b.getWest(),
        north: b.getNorth(),
        east: b.getEast(),
      });
    } catch {
      /* fail open — see above */
    }
  };

  const handlePanelMouseMove = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (!panelRef.current || !glareRef.current || !borderGlareRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // Subtle inner glow
    glareRef.current.style.background = `radial-gradient(circle 300px at ${x}px ${y}px, ${dark ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.25)'} 0%, transparent 70%)`;
    glareRef.current.style.opacity = '1';
    // Border glow that follows cursor
    borderGlareRef.current.style.opacity = '1';
    borderGlareRef.current.style.maskImage = `radial-gradient(circle 150px at ${x}px ${y}px, black 0%, transparent 100%)`;
    borderGlareRef.current.style.webkitMaskImage = `radial-gradient(circle 150px at ${x}px ${y}px, black 0%, transparent 100%)`;
  };
  const handlePanelMouseLeave = () => {
    if (glareRef.current) glareRef.current.style.opacity = '0';
    if (borderGlareRef.current) borderGlareRef.current.style.opacity = '0';
  };

  const [data, setData] = useState<AtlasData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [countryDetail, setCountryDetail] = useState<CountryDetail | null>(null);
  const [geoData, setGeoData] = useState<GeoJsonFeatureCollection | null>(null);
  const [visitedRegions, setVisitedRegions] = useState<
    Record<string, { code: string; name: string; placeCount: number; manuallyMarked?: boolean; status?: VisitStatus }[]>
  >({});
  const [pluginLayers, setPluginLayers] = useState<PluginAtlasLayer[]>([]);
  const pluginLayerRef = useRef<L.GeoJSON | null>(null);
  const regionLayerRef = useRef<L.GeoJSON | null>(null);
  const regionGeoCache = useRef<Record<string, GeoJsonFeatureCollection>>({});
  // Landmark layer for China provinces
  const landmarkLayerRef = useRef<L.LayerGroup | null>(null);
  // Checked-in trip places (已打卡 in the planner) drawn on the world map
  const checkinLayerRef = useRef<L.LayerGroup | null>(null);
  const [selectedCheckin, setSelectedCheckin] = useState<number | null>(null);
  // The pending "zoom settled" timer: while zooming the landmark layer is off
  // the map, and it only comes back once this fires (see the zoom handlers).
  const landmarkShowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedLandmark, setSelectedLandmark] = useState<any>(null);
  const [showLandmarks, setShowLandmarks] = useState<boolean>(() => {
    try {
      return localStorage.getItem('tt_atlas_show_landmarks') !== '0';
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('tt_atlas_show_landmarks', showLandmarks ? '1' : '0');
    } catch {
      /* storage may be unavailable */
    }
  }, [showLandmarks]);
  // The zoom handlers are registered once per map; they read the toggle through
  // this ref so a layer toggle after mount isn't lost to the stale closure.
  const showLandmarksRef = useRef(showLandmarks);
  useEffect(() => {
    showLandmarksRef.current = showLandmarks;
  }, [showLandmarks]);
  const [landmarkRefreshTrigger, setLandmarkRefreshTrigger] = useState<number>(0);
  // Cached countries, least recently in view first, capped at REGION_CACHE_MAX.
  const regionCacheOrder = useRef<string[]>([]);
  // Countries whose /regions/geo answer is still on the way. They must not be asked
  // for twice while a pan fires moveend over and over, and must not be evicted before
  // their own response lands.
  const pendingRegionCodes = useRef<Set<string>>(new Set());
  // Which countries the drawn layer was built from, so panning inside the same set of
  // countries costs nothing.
  const renderedRegionSigRef = useRef<string>('');
  const rebuildRegionLayerRef = useRef<(force?: boolean) => void>(() => {});
  const [showRegions, setShowRegions] = useState(false);
  // Countries you only plan to visit stay off the map until asked for — the atlas is a
  // record of where you have been, not of where you booked a flight to (#1048).
  const [showPlanned, setShowPlanned] = useState<boolean>(() => {
    try {
      return localStorage.getItem(PLANNED_KEY) === '1';
    } catch {
      return false;
    }
  });
  const togglePlanned = () =>
    setShowPlanned((v) => {
      const next = !v;
      try {
        localStorage.setItem(PLANNED_KEY, next ? '1' : '0');
      } catch {
        /* private mode — keep the toggle working anyway */
      }
      return next;
    });
  const [regionGeoLoaded, setRegionGeoLoaded] = useState(0);
  const regionTooltipRef = useRef<HTMLDivElement>(null);
  const loadCountryDetailRef = useRef<(code: string) => void>(() => {});
  const handleMarkCountryRef = useRef<(code: string, name: string) => void>(() => {});
  const setConfirmActionRef = useRef<typeof setConfirmAction>(() => {});
  const [confirmAction, setConfirmAction] = useState<{
    type: 'mark' | 'unmark' | 'choose' | 'bucket' | 'choose-region' | 'unmark-region';
    code: string;
    name: string;
    regionCode?: string;
    countryName?: string;
  } | null>(null);
  const [bucketMonth, setBucketMonth] = useState(0);
  const [bucketYear, setBucketYear] = useState(0);

  // Bucket list
  const [bucketList, setBucketList] = useState<BucketItem[]>([]);
  const [showBucketAdd, setShowBucketAdd] = useState(false);
  const [bucketForm, setBucketForm] = useState({ name: '', notes: '', lat: '', lng: '', target_date: '' });
  const [bucketSearch, setBucketSearch] = useState('');
  const [bucketSearchResults, setBucketSearchResults] = useState<any[]>([]);
  const [bucketSearching, setBucketSearching] = useState(false);
  const [bucketPoiMonth, setBucketPoiMonth] = useState(0);
  const [bucketPoiYear, setBucketPoiYear] = useState(0);
  const [bucketTab, setBucketTab] = useState<'stats' | 'bucket' | 'checkins'>('stats');
  const bucketMarkersRef = useRef<any>(null);

  const [atlas_country_search, set_atlas_country_search] = useState('');
  const [atlas_country_results, set_atlas_country_results] = useState<{ code: string; label: string }[]>([]);
  const [atlas_country_open, set_atlas_country_open] = useState(false);
  // Geocoded places beside the local country matches (#1115): searching for Milan
  // should not require knowing it sits in Lombardy. Kept in its own list so the
  // instant offline country filter never waits on a network round trip.
  const [atlas_place_results, set_atlas_place_results] = useState<AtlasPlaceHit[]>([]);
  const [atlas_places_loading, set_atlas_places_loading] = useState(false);
  const placeSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const placeSearchSeqRef = useRef(0);

  // visitedCountries drives the colour palette and every "how many" number;
  // visibleCountries drives what the map paints and what stays clickable.
  const visitedCountries = useMemo(() => (data?.countries ?? []).filter((c) => countryStatus(c) === 'visited'), [data]);
  const visibleCountries = useMemo(
    () => (data?.countries ?? []).filter((c) => isCountryVisible(c, showPlanned)),
    [data, showPlanned]
  );

  const atlas_country_options = useMemo(() => {
    if (!geoData) return [];
    // Precompute A3 → A2 reverse lookup once per geoData change instead of
    // scanning A2_TO_A3 for every feature that needs the fallback.
    const a3ToA2 = new Map<string, string>();
    for (const [a2Key, a3Val] of Object.entries(A2_TO_A3)) a3ToA2.set(a3Val, a2Key);

    const opts: { code: string; label: string }[] = [];
    const seen = new Set<string>();
    for (const f of (geoData as any).features || []) {
      const rawA2 = f?.properties?.ISO_A2;
      let resolvedA2: string | null = typeof rawA2 === 'string' && rawA2.length === 2 && rawA2 !== '-99' ? rawA2 : null;
      if (!resolvedA2) {
        const a3 = f?.properties?.ADM0_A3 || f?.properties?.ISO_A3 || f?.properties?.['ISO3166-1-Alpha-3'] || null;
        if (a3 && a3 !== '-99') resolvedA2 = a3ToA2.get(a3) ?? null;
      }
      // Fold Taiwan into China so the search list offers one China entry, not a
      // separate Taiwan one (the loader already rewrote the feature codes).
      resolvedA2 = normalizeCountryCode(resolvedA2);
      if (!resolvedA2 || seen.has(resolvedA2)) continue;
      seen.add(resolvedA2);
      const label = String(countryDisplayName(resolvedA2, resolveName) || f?.properties?.NAME || f?.properties?.ADMIN || resolvedA2);
      opts.push({ code: resolvedA2, label });
    }
    opts.sort((a, b) => a.label.localeCompare(b.label));
    return opts;
  }, [geoData, resolveName]);

  const [loadError, setLoadError] = useState<string | null>(null);
  const atlasRequestActive = useRef(true);

  useEffect(
    () => () => {
      atlasRequestActive.current = false;
    },
    []
  );

  // Load atlas data + bucket list
  useEffect(() => {
    atlasRequestActive.current = true;
    Promise.all([apiClient.get('/addons/atlas/stats'), apiClient.get('/addons/atlas/bucket-list')])
      .then(([statsRes, bucketRes]) => {
        if (!atlasRequestActive.current) return;
        setData(statsRes.data);
        setBucketList(bucketRes.data.items || []);
        setLoading(false);
      })
      .catch((err) => {
        if (!atlasRequestActive.current) return;
        setLoadError(getApiErrorMessage(err, t('common.error')));
        setLoading(false);
        toast.error(getApiErrorMessage(err, t('common.error')));
      });
  }, []);

  // Load country-border GeoJSON from our API (geoBoundaries, served server-side —
  // no third-party fetch from the browser). Even gzipped the payload is a few MB, so
  // it gets a longer timeout than the global 8s default to survive slow links and
  // reverse-proxy / Cloudflare-Tunnel setups instead of aborting and leaving the map
  // with no countries (#1254).
  useEffect(() => {
    apiClient
      .get('/addons/atlas/countries/geo', { timeout: 30000 })
      .then((res) => {
        const geo = res.data;
        // Fold Taiwan's admin-0 feature into China as the data loads, so the
        // country layer, the search list and every click handler downstream see
        // one country instead of a separate clickable "TW" polygon. Rewriting
        // the feature's own codes (rather than only the display) is what makes
        // the click open China's card.
        for (const f of geo.features) {
          const a2 = f.properties?.ISO_A2;
          const a3 = f.properties?.ADM0_A3 || f.properties?.ISO_A3;
          const normA2 = normalizeCountryCode(a2);
          if (normA2 && normA2 !== a2) f.properties.ISO_A2 = normA2;
          const normA3 = normalizeCountryCode(a3);
          if (normA3 && normA3 !== a3) {
            if (f.properties.ADM0_A3) f.properties.ADM0_A3 = 'CHN';
            if (f.properties.ISO_A3) f.properties.ISO_A3 = 'CHN';
          }
        }
        // Dynamically build A2→A3 mapping from GeoJSON
        for (const f of geo.features) {
          const a2 = f.properties?.ISO_A2;
          const a3 = f.properties?.ADM0_A3 || f.properties?.ISO_A3;
          // Only accept clean 2-letter ISO codes and never overwrite an existing
          // mapping: some datasets carry subdivision-style values like "CN-TW" for
          // Taiwan, which would clobber the legitimate TWN->TW entry (#1049).
          if (a2 && a3 && a2.length === 2 && a2 !== '-99' && a3 !== '-99' && !A2_TO_A3[a2]) {
            A2_TO_A3[a2] = a3;
          }
        }
        setGeoData(geo);
      })
      .catch((err) => {
        if (!atlasRequestActive.current) return;
        toast.error(getApiErrorMessage(err, t('common.error')));
      });
  }, []);

  // Load visited regions (geocoded from places/trips) — once on mount
  useEffect(() => {
    let cancelled = false;
    apiClient
      .get(`/addons/atlas/regions?_t=${Date.now()}`)
      .then((r) => {
        if (!cancelled) setVisitedRegions(r.data?.regions || {});
      })
      .catch((err) => {
        if (!cancelled) console.error('Failed to load Atlas regions:', err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load plugin tint layers (atlasLayerProvider hook) — once on mount. Fail-safe:
  // an error just means no plugin overlay, the core map is untouched.
  useEffect(() => {
    let cancelled = false;
    pluginsApi
      .atlasLayers()
      .then((r) => {
        if (!cancelled) setPluginLayers(r.layers || []);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to load Atlas plugin layers:', err);
          setPluginLayers([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** The view the map currently shows, or null while there is no map to ask. */
  const viewportBounds = (): L.LatLngBounds | null => {
    try {
      return mapInstance.current?.getBounds() ?? null;
    } catch {
      return null;
    }
  };

  /** Does this country's outline touch the given view? Fail open: a country we hold no
   *  outline for, or one whose bounds throw, counts as in view, because dropping it
   *  would blank regions the user can see.
   *
   *  Reads the MERGED bounds, not the layer: a code can be carried by more than one
   *  admin-0 feature (Taiwan's is folded into CN), and taking whichever feature was
   *  registered last made China's extent look like Taiwan's — see
   *  country_bounds_by_a2_ref. */
  const countryInView = (code: string, bounds: L.LatLngBounds | null): boolean => {
    if (!bounds) return true;
    const countryBounds = country_bounds_by_a2_ref.current[code];
    if (!countryBounds) return true;
    try {
      return boundsIntersect(
        { south: bounds.getSouth(), west: bounds.getWest(), north: bounds.getNorth(), east: bounds.getEast() },
        countryBounds
      );
    } catch {
      return true;
    }
  };

  const touchRegionCode = (code: string): void => {
    const order = regionCacheOrder.current;
    const at = order.indexOf(code);
    if (at !== -1) order.splice(at, 1);
    order.push(code);
  };

  /** Drop the countries nobody is looking at once the cache outgrows its cap. A country
   *  still in view, or one still waiting for its response, is never dropped, or panning
   *  across a wide country would fetch it, evict it and fetch it again. */
  const evictRegionCache = (): void => {
    const bounds = viewportBounds();
    const keep = new Set<string>(pendingRegionCodes.current);
    for (const code of regionCacheOrder.current) {
      if (!keep.has(code) && countryInView(code, bounds)) keep.add(code);
    }
    for (const code of regionCacheEvictions(regionCacheOrder.current, keep, REGION_CACHE_MAX)) {
      delete regionGeoCache.current[code];
      const at = regionCacheOrder.current.indexOf(code);
      if (at !== -1) regionCacheOrder.current.splice(at, 1);
    }
  };

  // Load admin-1 GeoJSON for countries visible in the current viewport
  const loadRegionsForViewportRef = useRef<() => void>(() => {});
  const loadRegionsForViewport = (): void => {
    if (!mapInstance.current) return;
    const bounds = mapInstance.current.getBounds();
    const toLoad: string[] = [];
    for (const code of Object.keys(country_layer_by_a2_ref.current)) {
      if (regionGeoCache.current[code]) {
        // Recency means recency of being on screen. Touching every cached country wrote
        // the order back into GeoJSON feature order on every moveend, so the eviction
        // picked its victim by position in the dataset instead of by what the view had
        // just left, and panning back to that country paid for a refetch.
        if (countryInView(code, bounds)) touchRegionCode(code);
        continue;
      }
      if (pendingRegionCodes.current.has(code)) continue;
      // countryInView, not a direct layer.getBounds(): the same merged-bounds reason as
      // above. Testing the raw layer here meant China's regions were never even
      // REQUESTED while the view sat over Xinjiang or Tibet — the provinces were not
      // merely culled from the layer, their geometry had never been fetched.
      if (countryInView(code, bounds)) toLoad.push(code);
    }
    if (!toLoad.length) return;
    for (const code of toLoad) pendingRegionCodes.current.add(code);
    apiClient
      .get(`/addons/atlas/regions/geo?countries=${toLoad.join(',')}`)
      .then((geoRes) => {
        const geo = geoRes.data;
        if (!geo?.features) return;
        let added = false;
        for (const c of toLoad) {
          // Compare on the normalized code: the server serves Taiwan's regions in
          // the CN bucket, but each feature still carries its original iso_a2, so
          // a raw === 'CN' filter would drop them.
          const features = geo.features.filter((f: any) => normalizeCountryCode(f.properties?.iso_a2) === c);
          if (features.length > 0) {
            regionGeoCache.current[c] = { type: 'FeatureCollection', features };
            touchRegionCode(c);
            added = true;
          }
        }
        if (added) {
          evictRegionCache();
          setRegionGeoLoaded((v) => v + 1);
        }
      })
      .catch((err) => {
        console.error('Failed to load Atlas viewport regions:', err);
      })
      .finally(() => {
        for (const code of toLoad) pendingRegionCodes.current.delete(code);
      });
  };
  loadRegionsForViewportRef.current = loadRegionsForViewport;

  // Initialize map — runs after loading is done and mapRef is available
  useEffect(() => {
    if (loading || !mapRef.current) return;
    if (mapInstance.current) {
      mapInstance.current.remove();
      mapInstance.current = null;
    }

    // Determine initial map center based on user location
    const initialCenter: [number, number] = [25, 0]; // Default global view
    const initialZoom = 3;

    // Try to get user's location for better initial view
    (async () => {
      // First try cached location
      let userLoc = getLastLocation();

      // If no cache, request new location (async, non-blocking)
      if (!userLoc) {
        userLoc = await getUserLocation();
        if (userLoc) {
          saveLastLocation(userLoc);
        }
      }

      // If we have user location and map is still mounted
      if (userLoc && mapInstance.current) {
        // Check if user is in China (rough bounds)
        const isInChina = userLoc.lat >= 18 && userLoc.lat <= 54 && userLoc.lng >= 73 && userLoc.lng <= 135;

        if (isInChina) {
          // Center on user's location in China
          mapInstance.current.setView([userLoc.lat, userLoc.lng], 5, { animate: true });
        } else {
          // For Chinese users outside China, show China map
          mapInstance.current.setView([CHINA_CENTER.lat, CHINA_CENTER.lng], 4, { animate: true });
        }
      }
    })();

    const map = L.map(mapRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      minZoom: 3,
      maxZoom: 10,
      zoomControl: false,
      attributionControl: false,
      maxBounds: [
        [-90, -220],
        [90, 220],
      ],
      maxBoundsViscosity: 1.0,
      fadeAnimation: false,
      preferCanvas: true,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // One layer, not two. The second raster layer existed to warm the HTTP cache
    // of neighbouring zoom levels; a vector basemap scales what it already has, so
    // a second one would only cost a second WebGL context and a second copy of the
    // tiles. Labels are hidden because the country fills carry the names here.
    if (isVectorStyle(tileUrlRef.current)) {
      cancelledRef.current = false;
      void attachVectorBasemap(map, tileUrlRef.current, glLayerRef, () => cancelledRef.current, { hideLabels: true });
    } else {
      const baseTiles = L.tileLayer(tileUrlRef.current, {
        maxZoom: 10,
        keepBuffer: 25,
        updateWhenZooming: true,
        updateWhenIdle: false,
        tileSize: 256,
        zoomOffset: 0,
        crossOrigin: true,
        referrerPolicy: 'strict-origin-when-cross-origin',
      } as any);
      baseTiles.addTo(map);
      tileLayersRef.current = [baseTiles];
    }

    // Custom pane for region layer — above overlay (z-index 400).
    // index.css forces `.leaflet-pane { z-index: 0 !important }` trek-wide, which
    // flattens every pane to DOM order; an inline !important is the only style
    // that outranks it, so these two can layer at all. Keep both in sync.
    // (The unit-test double hands us a plain-object style, hence the fallback.)
    const setPaneZ = (pane: HTMLElement, value: string): void => {
      if (typeof pane.style.setProperty === 'function') pane.style.setProperty('z-index', value, 'important');
      else pane.style.zIndex = value;
    };
    map.createPane('regionPane');
    const regionPane = map.getPane('regionPane')!;
    setPaneZ(regionPane, '401');
    // Allow clicks to pass through to landmarks below
    regionPane.style.pointerEvents = 'none';

    // Custom pane for landmarks — above everything (z-index 650)
    map.createPane('landmarkPane');
    const landmarkPane = map.getPane('landmarkPane')!;
    setPaneZ(landmarkPane, '650');
    landmarkPane.style.pointerEvents = 'auto';

    mapInstance.current = map;
    // Both renderers live as long as the map does (see the note on the refs); map.remove()
    // disposes them along with every other layer it holds.
    countryRendererRef.current = L.canvas({ padding: 0.5, tolerance: 5 });
    regionRendererRef.current = L.svg({ pane: 'regionPane' });

    // Zoom-based region switching
    map.on('zoomend', () => {
      const z = map.getZoom();
      const shouldShow = z >= 5;
      setShowRegions(shouldShow);
      const overlayPane = map.getPane('overlayPane');
      if (overlayPane) {
        overlayPane.style.opacity = shouldShow ? '0.35' : '1';
        overlayPane.style.pointerEvents = shouldShow ? 'none' : 'auto';
      }
      if (shouldShow) {
        // Re-add region layer if it was removed while zoomed out
        if (regionLayerRef.current && !map.hasLayer(regionLayerRef.current)) {
          regionLayerRef.current.addTo(map);
        }
        loadRegionsForViewportRef.current();
        rebuildRegionLayerRef.current();
      } else {
        // Physically remove region layer so its SVG paths can't intercept events
        if (regionTooltipRef.current) regionTooltipRef.current.style.display = 'none';
        if (regionLayerRef.current && map.hasLayer(regionLayerRef.current)) {
          regionLayerRef.current.resetStyle();
          regionLayerRef.current.removeFrom(map);
        }
      }
    });

    map.on('moveend', () => {
      if (map.getZoom() < 6) return;
      loadRegionsForViewportRef.current();
      // A pan that stays over the same countries changes nothing, and the rebuild
      // notices that for itself, cheaper than working it out here.
      rebuildRegionLayerRef.current();
    });

    // Create landmark layer for China provinces
    const createLandmarkLayer = () => {
      if (landmarkLayerRef.current) {
        landmarkLayerRef.current.clearLayers();
      } else {
        landmarkLayerRef.current = L.layerGroup();
      }

      const allLandmarks = getAllLandmarks();
      const visitedLandmarks = getVisitedLandmarks();

      allLandmarks.forEach((landmark) => {
        const color = getLandmarkColor(landmark.type);
        const isVisited = visitedLandmarks.has(`${landmark.provinceCode}:${landmark.name}`);

        // Colored dot icon; the layer as a whole fades in via the pane class
        // (tt-pane-appear), replayed whenever the zoom settles.
        const icon = L.divIcon({
          html: landmarkDotHtml(color, isVisited),
          className: 'landmark-marker',
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });

        const marker = L.marker([landmark.lat, landmark.lng], {
          icon,
          interactive: true,
          bubblingMouseEvents: false,
          zIndexOffset: 10000,
          pane: 'landmarkPane',
        });

        // Add click handler with stopPropagation
        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          setSelectedLandmark(landmark);
        });

        // Add to layer group
        marker.addTo(landmarkLayerRef.current!);
      });

      // Only show landmarks when zoomed in to China region (zoom >= 4)
      if (map.getZoom() >= 4 && showLandmarksRef.current) {
        landmarkLayerRef.current.addTo(map);
      }
    };

    // Landmark visibility: hidden for the whole duration of a zoom, and only
    // brought back ~280ms after the last zoomend — continuous wheel/pinch zoom
    // re-fires zoomstart, which cancels the pending show, so the dots reappear
    // once, as one faded layer, after the user actually stops zooming.
    const showLandmarkLayer = () => {
      const layer = landmarkLayerRef.current;
      if (!layer || !showLandmarksRef.current) return;
      if (!map.hasLayer(layer)) layer.addTo(map);
      // Replay the unified fade: re-adding the animation class after a reflow
      // restarts it, so every dot in the pane appears together.
      const pane = map.getPane('landmarkPane') as HTMLElement | undefined;
      if (pane && typeof pane.classList?.add === 'function') {
        pane.classList.remove('tt-pane-appear');
        void pane.offsetWidth;
        pane.classList.add('tt-pane-appear');
      }
    };
    map.on('zoomstart', () => {
      if (landmarkShowTimerRef.current) {
        clearTimeout(landmarkShowTimerRef.current);
        landmarkShowTimerRef.current = null;
      }
      const layer = landmarkLayerRef.current;
      if (layer && map.hasLayer(layer)) layer.removeFrom(map);
    });
    map.on('zoomend', () => {
      const z = map.getZoom();
      if (landmarkLayerRef.current) {
        if (z >= 4 && showLandmarksRef.current) {
          if (landmarkShowTimerRef.current) clearTimeout(landmarkShowTimerRef.current);
          landmarkShowTimerRef.current = setTimeout(() => {
            landmarkShowTimerRef.current = null;
            showLandmarkLayer();
          }, 280);
        } else {
          if (landmarkShowTimerRef.current) {
            clearTimeout(landmarkShowTimerRef.current);
            landmarkShowTimerRef.current = null;
          }
          if (map.hasLayer(landmarkLayerRef.current)) {
            landmarkLayerRef.current.removeFrom(map);
          }
        }
      }
    });

    // Initialize landmarks
    createLandmarkLayer();

    // Check-in markers (trip places marked 已打卡 in the planner). Few of them,
    // so they stay on the map through zooms — only landmark dots hide. Rebuilt
    // in place when the planner toggles one (same-tab event) or another tab
    // syncs (storage event).
    const rebuildCheckinLayer = () => {
      if (!checkinLayerRef.current) checkinLayerRef.current = L.layerGroup();
      else checkinLayerRef.current.clearLayers();
      for (const place of getCheckedPlaces()) {
        if (place.lat == null || place.lng == null) continue;
        const marker = L.marker([place.lat, place.lng], {
          icon: L.divIcon({
            html: checkinDotHtml(),
            className: 'landmark-marker',
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          }),
          interactive: true,
          bubblingMouseEvents: false,
          zIndexOffset: 9000,
          pane: 'landmarkPane',
        });
        marker.bindTooltip(escapeHtml(place.name), { direction: 'top', offset: [0, -8] });
        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          setSelectedCheckin(place.id);
        });
        marker.addTo(checkinLayerRef.current);
      }
    };
    rebuildCheckinLayer();
    checkinLayerRef.current.addTo(map);
    window.addEventListener('tt-checkins-changed', rebuildCheckinLayer);
    window.addEventListener('storage', rebuildCheckinLayer);

    return () => {
      window.removeEventListener('tt-checkins-changed', rebuildCheckinLayer);
      window.removeEventListener('storage', rebuildCheckinLayer);
      if (landmarkShowTimerRef.current) {
        clearTimeout(landmarkShowTimerRef.current);
        landmarkShowTimerRef.current = null;
      }
      map.remove();
      mapInstance.current = null;
      countryRendererRef.current = null;
      regionRendererRef.current = null;
      // The layer belongs to the map that just went away. Without this the next map's
      // zoomend would re-attach it, and Leaflet would revive the old renderer by
      // appending a second container to the pane.
      regionLayerRef.current = null;
      renderedRegionSigRef.current = '';
      // The registry is deliberately NOT cleared here either. A map rebuild (theme
      // toggle, etc.) constructs the new map and re-registers every country, but the
      // handlers that ask for regions run on zoomend/moveend — and those can fire
      // before the country effect has re-registered. Keeping the entries means such a
      // handler still sees the country it is over instead of an empty registry, which
      // is what left the map showing country outlines with no regions.
      //
      // Re-registration unions identical bounds, so surviving entries are harmless.
      tileLayersRef.current = [];
      cancelledRef.current = true;
      glLayerRef.current?.remove();
      glLayerRef.current = null;
    };
  }, [dark, loading]);

  // Refresh landmark layer when visit status changes
  useEffect(() => {
    if (!mapInstance.current || !landmarkLayerRef.current) return;

    // Clear and recreate landmarks with updated visit status
    landmarkLayerRef.current.clearLayers();

    const allLandmarks = getAllLandmarks();
    const visitedLandmarks = getVisitedLandmarks();

    allLandmarks.forEach((landmark) => {
      const color = getLandmarkColor(landmark.type);
      const isVisited = visitedLandmarks.has(`${landmark.provinceCode}:${landmark.name}`);

      const icon = L.divIcon({
        html: landmarkDotHtml(color, isVisited),
        className: 'landmark-marker',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      const marker = L.marker([landmark.lat, landmark.lng], {
        icon,
        interactive: true,
        bubblingMouseEvents: false,
        zIndexOffset: 10000,
        pane: 'landmarkPane',
      });

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        setSelectedLandmark(landmark);
      });
      marker.addTo(landmarkLayerRef.current!);
    });
  }, [landmarkRefreshTrigger]);

  // Retile in place. A rebuild would drop every layer the effects below hold a ref
  // to — the country layer is only re-rendered when its own data changes, so the map
  // would come back bare — and Leaflet keeps redrawing the torn-down canvas renderer
  // for a frame after the map goes (#2097).
  useEffect(() => {
    if (isVectorStyle(tileUrl)) {
      const layer = glLayerRef.current;
      if (!layer) return;
      layer.getMaplibreMap()?.setStyle(tileUrl);
      // setStyle drops the layer list, and style.load fires again with the new
      // one, so the label rule has to be re-armed rather than assumed.
      hideLabelLayers(layer);
      return;
    }
    for (const layer of tileLayersRef.current) layer.setUrl(tileUrl);
  }, [tileUrl]);

  // Render GeoJSON countries
  useEffect(() => {
    if (!mapInstance.current || !geoData || !data || !countryRendererRef.current) return;

    const visitedA3 = new Set(visibleCountries.map((c) => A2_TO_A3[c.code]).filter(Boolean));
    const plannedA3 = new Set(
      visibleCountries
        .filter((c) => countryStatus(c) !== 'visited')
        .map((c) => A2_TO_A3[c.code])
        .filter(Boolean)
    );
    const countryMap = {};
    visibleCountries.forEach((c) => {
      if (A2_TO_A3[c.code]) countryMap[A2_TO_A3[c.code]] = c;
    });
    const wishlistA3 = wishlistA3Codes(bucketList, visitedA3);

    // Preserve current map view
    const currentCenter = mapInstance.current.getCenter();
    const currentZoom = mapInstance.current.getZoom();

    if (geoLayerRef.current) {
      mapInstance.current.removeLayer(geoLayerRef.current);
    }
    // The registry is deliberately NOT cleared here. Every entry is re-derived from
    // the same country bundle on each rebuild, so a stale code simply gets its bounds
    // unioned with identical values. Clearing it instead threw away entries that
    // handlers already registered on the map (zoomend/moveend) still needed: the
    // region layer is loaded from those, and an empty registry made them fetch
    // nothing until the user panned or zoomed again.

    // Color per country code, hashed from the code itself (countryColor in atlasModel) —
    // stable forever, regardless of visit order or how many countries are visited/planned/
    // wishlisted. Also used by the region layer below, so both stay in sync.
    const colorForCode = countryColor;
    const wishlistPatternCache = new Map<string, CanvasPattern | null>();

    const canvasRenderer = countryRendererRef.current;

    geoLayerRef.current = L.geoJSON(geoData, {
      renderer: canvasRenderer,
      interactive: true,
      bubblingMouseEvents: false,
      style: (feature) => {
        const a3 =
          feature.properties?.ADM0_A3 ||
          feature.properties?.ISO_A3 ||
          feature.properties?.['ISO3166-1-Alpha-3'] ||
          feature.id;
        // Planned countries read as an outline rather than a fill: dashed border, muted
        // wash. Deliberately not one of the VISITED_COLORS, so "been there" stays distinct.
        if (plannedA3.has(a3)) {
          return {
            fillColor: dark ? '#818cf8' : '#4f46e5',
            fillOpacity: 0.38,
            color: dark ? '#818cf8' : '#4f46e5',
            weight: 1,
            dashArray: '6 4',
          };
        }
        const visited = visitedA3.has(a3);
        if (!visited && wishlistA3.has(a3)) {
          const wishlistColor = colorForCode(a3);
          if (!wishlistPatternCache.has(wishlistColor)) {
            wishlistPatternCache.set(wishlistColor, createWishlistPattern(wishlistColor, dark));
          }
          const pattern = wishlistPatternCache.get(wishlistColor);
          return {
            fillColor: (pattern || wishlistColor) as unknown as string,
            fillOpacity: pattern ? 1 : 0.4,
            color: wishlistColor,
            weight: 1,
            dashArray: '3 2',
          };
        }
        return {
          fillColor: visited ? colorForCode(a3) : dark ? '#1e1e2e' : '#e2e8f0',
          fillOpacity: visited ? 0.7 : 0.3,
          color: dark ? '#333' : '#cbd5e1',
          weight: 0.5,
        };
      },
      onEachFeature: (feature, layer) => {
        const a3 =
          feature.properties?.ADM0_A3 ||
          feature.properties?.ISO_A3 ||
          feature.properties?.['ISO3166-1-Alpha-3'] ||
          feature.id;
        const c = countryMap[a3];
        if (c) {
          country_layer_by_a2_ref.current[c.code] = layer;
          registerCountryBounds(c.code, layer);
          const name = countryDisplayName(c.code, resolveName);
          const formatDate = (d) => {
            if (!d) return '—';
            const dt = new Date(d);
            return dt.toLocaleDateString(getLocaleForLanguage(language), { month: 'short', year: 'numeric' });
          };
          // "First trip / Last trip" is simply wrong for a country you haven't reached yet —
          // a planned one gets a single departure date instead.
          const planned = countryStatus(c) !== 'visited';
          const datesHtml = planned
            ? `<div style="flex:1;display:flex;flex-direction:column;gap:2px">
                  <span style="font-size:9px;text-transform:uppercase;letter-spacing:0.08em;opacity:0.4">${t('atlas.plannedFor')}</span>
                  <span style="font-size:12px;font-weight:700">${formatDate(c.firstVisit)}</span>
                </div>`
            : `<div style="flex:1;display:flex;flex-direction:column;gap:2px">
                  <span style="font-size:9px;text-transform:uppercase;letter-spacing:0.08em;opacity:0.4">${t('atlas.firstVisit')}</span>
                  <span style="font-size:12px;font-weight:700">${formatDate(c.firstVisit)}</span>
                </div>
                <div style="flex:1;display:flex;flex-direction:column;gap:2px">
                  <span style="font-size:9px;text-transform:uppercase;letter-spacing:0.08em;opacity:0.4">${t('atlas.lastVisitLabel')}</span>
                  <span style="font-size:12px;font-weight:700">${formatDate(c.lastVisit)}</span>
                </div>`;
          const escapeTooltip = (value: unknown) =>
            String(value).replace(
              /[&<>"']/g,
              (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char
            );
          const safeName = escapeTooltipHtml(name);
          const tooltipHtml = `
            <div style="display:flex;flex-direction:column;gap:8px;min-width:160px">
              <div style="font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;padding-bottom:6px;border-bottom:1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}">${safeName}${planned ? ` <span style="font-size:9px;font-weight:700;opacity:0.55;letter-spacing:0.06em">· ${escapeTooltipHtml(t('atlas.planned'))}</span>` : ''}</div>
              <div style="display:flex;gap:14px">
                <div><span style="font-size:16px;font-weight:800">${c.tripCount}</span> <span style="font-size:10px;opacity:0.5;text-transform:uppercase;letter-spacing:0.05em">${escapeTooltipHtml(c.tripCount === 1 ? t('atlas.tripSingular') : t('atlas.tripPlural'))}</span></div>
                <div><span style="font-size:16px;font-weight:800">${c.placeCount}</span> <span style="font-size:10px;opacity:0.5;text-transform:uppercase;letter-spacing:0.05em">${escapeTooltipHtml(c.placeCount === 1 ? t('atlas.placeVisited') : t('atlas.placesVisited'))}</span></div>
              </div>
              <div style="display:flex;gap:2px;border-top:1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'};padding-top:8px">
                ${datesHtml}
              </div>
            </div>`;
          layer.bindTooltip(tooltipHtml, {
            // sticky so the tooltip tracks the cursor; non-sticky anchors it at the feature's
            // bounds centre, which for countries with overseas territories (e.g. France) lands
            // far out in the ocean instead of over the area being hovered.
            sticky: true,
            permanent: false,
            className: 'atlas-tooltip',
            direction: 'top',
            offset: [0, -10],
            opacity: 1,
          });
          layer.on('click', () => {
            if (c.placeCount === 0 && c.tripCount === 0) {
              handleUnmarkCountry(c.code);
            }
          });
          layer.on('mouseover', (e) => {
            e.target.setStyle({ fillOpacity: 0.9, weight: 2, color: dark ? '#818cf8' : '#4f46e5' });
          });
          layer.on('mouseout', (e) => {
            geoLayerRef.current.resetStyle(e.target);
          });
        } else {
          // Unvisited country — allow clicking to mark as visited
          // Reverse lookup: find A2 code from A3, or use A3 directly
          const a3ToA2Entry = Object.entries(A2_TO_A3).find(([, v]) => v === a3);
          const isoA2 = feature.properties?.ISO_A2;
          const countryCode = normalizeCountryCode(a3ToA2Entry ? a3ToA2Entry[0] : isoA2 && isoA2 !== '-99' ? isoA2 : null);
          if (countryCode && countryCode !== '-99') {
            country_layer_by_a2_ref.current[countryCode] = layer;
            registerCountryBounds(countryCode, layer);
            const name =
              countryDisplayName(countryCode, resolveName) || feature.properties?.NAME || feature.properties?.ADMIN || countryCode;
            layer.bindTooltip(`<div style="font-size:12px;font-weight:600">${escapeTooltipHtml(name)}</div>`, {
              sticky: true,
              className: 'atlas-tooltip',
              direction: 'top',
              offset: [0, -10],
              opacity: 1,
            });
            layer.on('click', () => handleMarkCountry(countryCode, name));
            layer.on('mouseover', (e) => {
              e.target.setStyle({ fillOpacity: 0.5, weight: 1.5, color: dark ? '#555' : '#94a3b8' });
            });
            layer.on('mouseout', (e) => {
              geoLayerRef.current.resetStyle(e.target);
            });
          }
        }
      },
    } as L.GeoJSONOptions & { renderer?: L.Renderer }).addTo(mapInstance.current);

    // Restore map view after re-render
    mapInstance.current.setView(currentCenter, currentZoom, { animate: false });
  }, [geoData, data, dark, visibleCountries, visitedCountries, bucketList]);

  // Render plugin tint layers (atlasLayerProvider hook) — a dashed wash over the
  // countries a plugin flagged, in its own non-interactive pane above the country
  // fills. pointer-events stay off so clicks/hovers fall through to the country
  // layer and the mark/unmark flows are untouched.
  useEffect(() => {
    if (!mapInstance.current) return;
    if (pluginLayerRef.current) {
      mapInstance.current.removeLayer(pluginLayerRef.current);
      pluginLayerRef.current = null;
    }
    if (!geoData || pluginLayers.length === 0) return;

    // Same tone palette as the plugin map markers; the last layer naming a country wins.
    const TONE_COLORS: Record<string, string> = {
      default: '#4F46E5',
      success: '#10b981',
      warn: '#f59e0b',
      danger: '#ef4444',
    };
    const toneByA3: Record<string, string> = {};
    for (const layer of pluginLayers) {
      for (const c of layer.countries) {
        const a3 = A2_TO_A3[c.code];
        if (a3) toneByA3[a3] = c.tone || 'default';
      }
    }
    const featureA3 = (f: any) =>
      f?.properties?.ADM0_A3 || f?.properties?.ISO_A3 || f?.properties?.['ISO3166-1-Alpha-3'] || f?.id;
    const features = ((geoData as any).features || []).filter((f: any) => toneByA3[featureA3(f)] !== undefined);
    if (features.length === 0) return;

    if (!mapInstance.current.getPane('atlasPluginPane')) {
      mapInstance.current.createPane('atlasPluginPane');
      const pane = mapInstance.current.getPane('atlasPluginPane')!;
      pane.style.zIndex = '402';
      pane.style.pointerEvents = 'none';
    }
    pluginLayerRef.current = L.geoJSON(
      { type: 'FeatureCollection', features } as any,
      {
        pane: 'atlasPluginPane',
        interactive: false,
        style: (feature) => {
          const color = TONE_COLORS[toneByA3[featureA3(feature)]] || TONE_COLORS.default;
          return { fillColor: color, fillOpacity: 0.18, color, weight: 1.4, dashArray: '4 3' };
        },
      } as L.GeoJSONOptions
    ).addTo(mapInstance.current);
    // `loading` is a dep because the map itself is created once loading flips —
    // layers fetched before that would otherwise never get drawn.
  }, [geoData, pluginLayers, dark, loading]);

  // Render sub-national region layer (zoom >= 5). `force` is for the changes that alter
  // how the regions look (theme, visits, the planned toggle); the map's own zoom/pan
  // handlers pass nothing and get a rebuild only when the countries in view changed.
  const rebuildRegionLayer = (force = false): void => {
    if (!mapInstance.current || !regionRendererRef.current) return;
    // Below zoom 6 a rebuild can only do harm: it drops the layer that is on the map and
    // the add at the end of this function starts at 6, so the regions would go and stay
    // gone. At zoom 5 they are the only clickable layer left (the country layer is dimmed
    // and pointer-events off), so the layer built further in has to survive the zoom out.
    if (!force && mapInstance.current.getZoom() < 6) return;
    const regionRenderer = regionRendererRef.current;

    // Draw only the countries that are actually on screen. The cache deliberately
    // outlives the viewport so panning back is free, but merging all of it into one
    // layer meant a continent's worth of admin-1 polygons stayed in the DOM, and every
    // newly loaded country tore the whole thing down and built it again (#1950).
    const bounds = viewportBounds();
    const inViewCodes = Object.keys(regionGeoCache.current)
      .filter((code) => countryInView(code, bounds))
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const sig = inViewCodes.join('|');
    if (!force && sig === renderedRegionSigRef.current) return;

    // Remove existing region layer
    if (regionLayerRef.current) {
      mapInstance.current.removeLayer(regionLayerRef.current);
      regionLayerRef.current = null;
    }
    renderedRegionSigRef.current = sig;

    if (inViewCodes.length === 0) return;

    // Build set of visited region codes and per-country name sets. Regions follow their
    // country's status, so zooming into a planned country can't reveal "visited" regions.
    const visitedRegionCodes = new Set<string>();
    const plannedRegionCodes = new Set<string>();
    const visitedRegionNamesByCountry = new Map<string, Set<string>>();
    const plannedRegionNamesByCountry = new Map<string, Set<string>>();
    const regionPlaceCounts: Record<string, number> = {};
    for (const [countryCode, regions] of Object.entries(visitedRegions)) {
      const names = new Set<string>();
      const plannedNames = new Set<string>();
      for (const r of regions) {
        const planned = (r.status ?? 'visited') !== 'visited';
        if (planned && !showPlanned) continue;
        if (planned) {
          plannedRegionCodes.add(r.code);
          plannedNames.add(normalizeRegionName(r.name));
        } else {
          visitedRegionCodes.add(r.code);
          names.add(normalizeRegionName(r.name));
        }
        regionPlaceCounts[r.code] = r.placeCount;
        regionPlaceCounts[`${countryCode}:${normalizeRegionName(r.name)}`] = r.placeCount;
      }
      visitedRegionNamesByCountry.set(countryCode, names);
      plannedRegionNamesByCountry.set(countryCode, plannedNames);
    }

    // Match feature by ISO code OR region name scoped to the feature's country. Names are
    // normalized (diacritics/dash variants folded) since the geocoder's cached region_name
    // and the bundled boundaries' name don't always agree on accenting (e.g. a cached
    // "Ile-de-France" must still match the bundle's "Île-de-France") (#atlas-region-match).
    const matchesRegions = (f: any, codes: Set<string>, namesByCountry: Map<string, Set<string>>) => {
      if (codes.has(f.properties?.iso_3166_2)) return true;
      // Normalized so Taiwan's regions (served under CN) match the CN-keyed
      // visited/planned sets the server reports.
      const countryA2 = normalizeCountryCode(f.properties?.iso_a2) || '';
      const countryNames = namesByCountry.get(countryA2);
      if (!countryNames) return false;
      const name = normalizeRegionName(f.properties?.name || '');
      if (countryNames.has(name)) return true;
      const nameEn = normalizeRegionName(f.properties?.name_en || '');
      if (nameEn && countryNames.has(nameEn)) return true;
      return false;
    };
    const isVisitedFeature = (f: any) => matchesRegions(f, visitedRegionCodes, visitedRegionNamesByCountry);
    const isPlannedFeature = (f: any) => matchesRegions(f, plannedRegionCodes, plannedRegionNamesByCountry);

    // Include every region feature of the countries in view: visited ones get colored
    // fill, unvisited get outline only (clicking one is how a region gets marked)
    const allFeatures: any[] = [];
    for (const code of inViewCodes) {
      for (const f of regionGeoCache.current[code].features) {
        allFeatures.push(f);
      }
    }
    if (allFeatures.length === 0) return;

    // Same palette as the country layer — countryColor is a pure hash of the code, so
    // both layers always agree on a country's color without needing to share state.
    const a2ColorMap: Record<string, string> = {};
    visitedCountries.forEach((c) => {
      if (A2_TO_A3[c.code]) a2ColorMap[c.code] = countryColor(A2_TO_A3[c.code]);
    });

    const mergedGeo = { type: 'FeatureCollection', features: allFeatures };

    regionLayerRef.current = L.geoJSON(
      mergedGeo as any,
      {
        renderer: regionRenderer,
        interactive: true,
        pane: 'regionPane',
        style: (feature) => {
          const countryA2 = normalizeCountryCode(feature?.properties?.iso_a2) || '';
          if (isPlannedFeature(feature)) {
            return {
              fillColor: dark ? '#818cf8' : '#4f46e5',
              fillOpacity: 0.4,
              color: dark ? '#818cf8' : '#4f46e5',
              weight: 1,
              dashArray: '6 4',
            };
          }
          const visited = isVisitedFeature(feature);
          return visited
            ? {
                fillColor: a2ColorMap[countryA2] || '#6366f1',
                fillOpacity: 0.85,
                color: dark ? '#888' : '#64748b',
                weight: 1.2,
              }
            : {
                fillColor: dark ? '#ffffff' : '#000000',
                fillOpacity: 0.03,
                color: dark ? '#555' : '#94a3b8',
                weight: 1,
              };
        },
        onEachFeature: (feature, layer) => {
          const regionName = feature?.properties?.name || '';
          const regionNameEn = feature?.properties?.name_en || '';
          const countryName = feature?.properties?.admin || '';
          const regionCode = feature?.properties?.iso_3166_2 || '';
          const countryA2 = normalizeCountryCode(feature?.properties?.iso_a2) || '';
          const visited = isVisitedFeature(feature);
          const count =
            regionPlaceCounts[regionCode] ||
            regionPlaceCounts[`${countryA2}:${normalizeRegionName(regionName)}`] ||
            regionPlaceCounts[`${countryA2}:${normalizeRegionName(regionNameEn)}`] ||
            0;

          // Taiwan's admin-1 features are its counties/cities, but the Atlas treats
          // the island as one Chinese province, so they are labelled 台湾省 rather
          // than surfaced under their own country. Everything else in China keeps
          // the province-name lookup.
          const isTaiwanRegion =
            normalizeCountryCode(feature?.properties?.iso_a2) === 'CN' &&
            (feature?.properties?.iso_a2 || '').toUpperCase() === 'TW';
          let displayName = regionName;
          if (isTaiwanRegion) {
            displayName = '台湾省';
          } else if (countryA2 === 'CN') {
            displayName = getProvinceNameByEnglish(regionNameEn) || getProvinceNameByEnglish(regionName) || regionName;
          }
          layer.on('click', () => {
            if (!countryA2) return;
            if (visited) {
              // Any visited region can be hidden now, not just a manually-marked one — a
              // region derived from a real place (e.g. one a border-simplification gap
              // misassigned) is exactly the case that needs it. Country details remain
              // reachable via the country search/sidebar.
              setConfirmActionRef.current({
                type: 'unmark-region',
                code: countryA2,
                // displayName, not regionName: Chinese provinces are labelled in
                // Chinese, and the tooltip already uses that spelling — passing the
                // raw GeoJSON name here made the popup disagree with the hover.
                name: displayName,
                regionCode,
                countryName,
              });
            } else {
              setConfirmActionRef.current({
                type: 'choose-region',
                code: countryA2, // country A2 code — used for flag display
                name: displayName, // region name — shown as heading
                regionCode,
                countryName,
              });
            }
          });
          layer.on('mouseover', (e: any) => {
            e.target.setStyle(
              visited
                ? { fillOpacity: 0.95, weight: 2, color: dark ? '#818cf8' : '#4f46e5' }
                : {
                    fillOpacity: 0.15,
                    fillColor: dark ? '#818cf8' : '#4f46e5',
                    weight: 1.5,
                    color: dark ? '#818cf8' : '#4f46e5',
                  }
            );
            const tt = regionTooltipRef.current;
            if (tt) {
              tt.style.display = 'block';
              tt.style.left = e.originalEvent.clientX + 12 + 'px';
              tt.style.top = e.originalEvent.clientY - 10 + 'px';
              const escapeHtml = (value: unknown) =>
                String(value).replace(
                  /[&<>"']/g,
                  (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char
                );
              const safeDisplayName = escapeHtml(displayName);
              const safeCountryName = escapeHtml(countryName);
              tt.innerHTML = visited
                ? `<div style="font-weight:600;margin-bottom:3px">${safeDisplayName}</div><div style="opacity:0.5;font-size:10px">${safeCountryName}</div><div style="margin-top:5px;font-size:11px"><b>${count}</b> ${count === 1 ? 'place' : 'places'}</div>`
                : `<div style="font-weight:600;margin-bottom:3px">${safeDisplayName}</div><div style="opacity:0.5;font-size:10px">${safeCountryName}</div>`;
            }
          });
          layer.on('mousemove', (e: any) => {
            const tt = regionTooltipRef.current;
            if (tt) {
              tt.style.left = e.originalEvent.clientX + 12 + 'px';
              tt.style.top = e.originalEvent.clientY - 10 + 'px';
            }
          });
          layer.on('mouseout', (e: any) => {
            regionLayerRef.current?.resetStyle(e.target);
            const tt = regionTooltipRef.current;
            if (tt) tt.style.display = 'none';
          });
        },
      } as L.GeoJSONOptions & { renderer?: L.Renderer }
    );
    // Only add to map if currently in region mode — otherwise hold it ready for when user zooms in
    if (mapInstance.current.getZoom() >= 6) {
      regionLayerRef.current.addTo(mapInstance.current);
    }
  };
  // Reassigned every render so the map handlers always call a closure that sees the
  // current visits, theme and toggle state, same pattern as loadRegionsForViewport.
  rebuildRegionLayerRef.current = rebuildRegionLayer;

  useEffect(() => {
    // Anything in the deps changes how the regions look rather than which are on screen,
    // so it has to redraw even when the countries in view are the same ones.
    // visitedCountries belongs here: the region colours are derived from it, and without
    // the dep this effect kept painting regions from a stale country list.
    rebuildRegionLayerRef.current(true);
  }, [regionGeoLoaded, visitedRegions, dark, t, visitedCountries, showPlanned]);

  const handleMarkCountry = (code: string, name: string): void => {
    setConfirmAction({ type: 'choose', code, name });
  };
  handleMarkCountryRef.current = handleMarkCountry;
  setConfirmActionRef.current = setConfirmAction;

  const handleUnmarkCountry = (code: string): void => {
    setConfirmAction({ type: 'unmark', code, name: countryDisplayName(code, resolveName) });
  };

  /** Debounced forward geocode for the atlas search box. Runs through the same
   *  /maps/search everything else uses, so it follows the configured provider. */
  const search_places = (raw: string): void => {
    const query = raw.trim();
    if (placeSearchTimerRef.current) clearTimeout(placeSearchTimerRef.current);
    if (query.length < 3) {
      set_atlas_place_results([]);
      set_atlas_places_loading(false);
      return;
    }
    set_atlas_places_loading(true);
    // Sequence guard: a slow answer for an earlier query must not overwrite a
    // newer one the user has already typed past.
    const seq = ++placeSearchSeqRef.current;
    placeSearchTimerRef.current = setTimeout(() => {
      mapsApi
        .search(query, language)
        .then((result) => {
          if (seq !== placeSearchSeqRef.current) return;
          // The provider blob is deliberately open (Google and OSM disagree on
          // fields), so narrow rather than cast.
          const hits: AtlasPlaceHit[] = [];
          for (const raw of result.places || []) {
            const p = raw as Record<string, unknown>;
            if (typeof p.lat !== 'number' || typeof p.lng !== 'number') continue;
            hits.push({
              name: typeof p.name === 'string' && p.name ? p.name : query,
              address: typeof p.address === 'string' && p.address ? p.address : null,
              lat: p.lat,
              lng: p.lng,
            });
            if (hits.length === 5) break;
          }
          set_atlas_place_results(hits);
        })
        .catch(() => {
          if (seq === placeSearchSeqRef.current) set_atlas_place_results([]);
        })
        .finally(() => {
          if (seq === placeSearchSeqRef.current) set_atlas_places_loading(false);
        });
    }, 350);
  };

  /**
   * Picking a geocoded place: fly there, then ask the server which country and admin1
   * region the coordinate falls in and offer the same dialog a click on that region
   * would. Zoom 7 because the region layer only loads from zoom 5 up, so landing
   * closer means the highlighted region is actually on screen.
   */
  const select_place_from_search = async (hit: AtlasPlaceHit): Promise<void> => {
    set_atlas_country_search(hit.name);
    set_atlas_country_open(false);
    set_atlas_country_results([]);
    set_atlas_place_results([]);

    try {
      mapInstance.current?.setView([hit.lat, hit.lng], 7, { animate: true });
    } catch (e) {
      console.error('Error flying to place', e);
    }

    let info: { country_code: string | null; region_code: string | null; region_name: string | null };
    try {
      const requestId = ++placeLocateRequest.current;
      info = (await apiClient.get('/addons/atlas/locate', { params: { lat: hit.lat, lng: hit.lng } })).data;
      if (requestId !== placeLocateRequest.current) return;
    } catch {
      return; // The map already moved; a failed lookup just means no dialog.
    }
    if (!info.country_code) return;

    // No admin1 coverage for this country: fall back to the country flow, which is
    // what the search did before it knew about places at all.
    if (!info.region_code || !info.region_name) {
      select_country_from_search(info.country_code);
      return;
    }

      const countryName = countryDisplayName(info.country_code, resolveName);
    const alreadyVisited = (visitedRegions[info.country_code] || []).some((r) => r.code === info.region_code);
    setConfirmAction({
      type: alreadyVisited ? 'unmark-region' : 'choose-region',
      code: info.country_code,
      name: info.region_name,
      regionCode: info.region_code,
      countryName,
    });
  };

  const select_country_from_search = (country_code: string): void => {
    const country_label = countryDisplayName(country_code, resolveName);
    set_atlas_country_search(country_label);
    set_atlas_country_open(false);
    set_atlas_country_results([]);

    // Merged bounds, so searching "China" frames the mainland rather than Taiwan.
    const countryBounds = country_bounds_by_a2_ref.current[country_code];
    try {
      if (countryBounds && mapInstance.current) {
        mapInstance.current.fitBounds(
          L.latLngBounds([countryBounds.south, countryBounds.west], [countryBounds.north, countryBounds.east]),
          { padding: [24, 24], animate: true, maxZoom: 6 }
        );
      }
    } catch (e) {
      console.error('Error fitting bounds', e);
    }

    // Mirror the map-click behaviour so an already-visited country can be removed
    // straight from search. Tiny countries (Vatican City, Singapore) are hard to
    // hit on the map, so search was the only way in — but it always opened the
    // "Mark / Bucket" dialog with no Remove option.
    const visited = data?.countries.find((c) => c.code === country_code);
    if (visited) {
      if (visited.placeCount === 0 && visited.tripCount === 0) {
        handleUnmarkCountry(country_code);
      } else {
        loadCountryDetailRef.current(country_code);
      }
      return;
    }
    setConfirmAction({ type: 'choose', code: country_code, name: country_label });
  };

  const executeConfirmAction = async (): Promise<void> => {
    if (!confirmAction) return;
    const { type, code } = confirmAction;
    setConfirmAction(null);

    // Update local state immediately (no API reload = no map re-render flash)
    if (type === 'mark') {
      apiClient.post(`/addons/atlas/country/${code}/mark`).catch(() => {});
      setData((prev) => (prev ? withCountryMarkedVisited(prev, code) : prev));
    } else {
      apiClient.delete(`/addons/atlas/country/${code}/mark`).catch(() => {});
      setSelectedCountry(null);
      setCountryDetail(null);
      setData((prev) => {
        if (!prev) return prev;
        const c = prev.countries.find((c) => c.code === code);
        if (!c || c.placeCount > 0 || c.tripCount > 0) return prev;
        const cont = continentForCountry(code);
        return {
          ...prev,
          countries: prev.countries.filter((c) => c.code !== code),
          stats: { ...prev.stats, totalCountries: Math.max(0, prev.stats.totalCountries - 1) },
          continents: { ...prev.continents, [cont]: Math.max(0, (prev.continents?.[cont] || 0) - 1) },
        };
      });
      setVisitedRegions((prev) => {
        if (!prev[code]) return prev;
        const next = { ...prev };
        delete next[code];
        return next;
      });
    }
  };

  const handleAddBucketItem = async (): Promise<void> => {
    if (!bucketForm.name.trim()) return;
    const hasCoords = !!(bucketForm.lat && bucketForm.lng);
    const lat = hasCoords ? Number.parseFloat(bucketForm.lat) : null;
    const lng = hasCoords ? Number.parseFloat(bucketForm.lng) : null;
    const targetDate =
      bucketForm.target_date ||
      (bucketPoiMonth > 0 && bucketPoiYear > 0 ? `${bucketPoiYear}-${String(bucketPoiMonth).padStart(2, '0')}` : null);
    // #1898: this form never sends a country code, so the entry it would create
    // is identified by name, date and coordinates alone. Keep the form filled so
    // the user can just pick another date.
    if (
      findBucketDuplicate(bucketList, { name: bucketForm.name, country_code: null, target_date: targetDate, lat, lng })
    ) {
      toast.error(t('atlas.bucketDuplicate'));
      return;
    }
    try {
      const data: Record<string, unknown> = { name: bucketForm.name.trim() };
      if (bucketForm.notes.trim()) data.notes = bucketForm.notes.trim();
      if (hasCoords) {
        data.lat = lat;
        data.lng = lng;
      }
      if (targetDate) data.target_date = targetDate;
      const r = await apiClient.post('/addons/atlas/bucket-list', data);
      setBucketList((prev) => [r.data.item, ...prev]);
      setBucketForm({ name: '', notes: '', lat: '', lng: '', target_date: '' });
      setBucketSearch('');
      setBucketSearchResults([]);
      setBucketPoiMonth(0);
      setBucketPoiYear(0);
      setShowBucketAdd(false);
    } catch (err) {
      // The 409 used to vanish into a silent catch, leaving the button looking broken.
      toast.error(
        isBucketDuplicateError(err) ? t('atlas.bucketDuplicate') : getApiErrorMessage(err, t('common.error'))
      );
    }
  };

  const handleDeleteBucketItem = async (id: number): Promise<void> => {
    try {
      await apiClient.delete(`/addons/atlas/bucket-list/${id}`);
      setBucketList((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      toast.error(getApiErrorMessage(err, t('common.error')));
    }
  };

  const handleBucketPoiSearch = async () => {
    if (!bucketSearch.trim()) return;
    setBucketSearching(true);
    try {
      const result = await mapsApi.search(bucketSearch, language);
      setBucketSearchResults(result.places || []);
    } catch (err) {
      console.error('Bucket-list place search failed:', err);
    } finally {
      setBucketSearching(false);
    }
  };

  const handleSelectBucketPoi = (result: any) => {
    const targetDate =
      bucketPoiMonth > 0 && bucketPoiYear > 0 ? `${bucketPoiYear}-${String(bucketPoiMonth).padStart(2, '0')}` : null;
    setBucketForm({
      name: result.name || bucketSearch,
      notes: '',
      lat: String(result.lat || ''),
      lng: String(result.lng || ''),
      target_date: targetDate || '',
    });
    setBucketSearchResults([]);
    setBucketSearch('');
  };

  // Render bucket list markers on map
  useEffect(() => {
    if (!mapInstance.current) return;
    if (bucketMarkersRef.current) {
      mapInstance.current.removeLayer(bucketMarkersRef.current);
    }
    if (bucketList.length === 0) return;
    const markers = bucketList
      .filter((b) => b.lat && b.lng)
      .map((b) => {
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:28px;height:28px;border-radius:50%;background:rgba(251,191,36,0.9);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);border:2px solid white"><svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
        const marker = L.marker([b.lat!, b.lng!], { icon });
        // Registered before bindTooltip, so this runs ahead of Leaflet's own
        // mouseover handler and lets it read the corrected direction/offset on open.
        marker.on('mouseover', () => {
          const map = mapInstance.current;
          const tooltip = marker.getTooltip();
          if (!map || !tooltip) return;
          const containerRect = map.getContainer().getBoundingClientRect();
          const point = map.latLngToContainerPoint(marker.getLatLng());
          const screenX = containerRect.left + point.x;
          const screenY = containerRect.top + point.y;
          const placement = bucketTooltipPlacement(
            { x: screenX, y: screenY },
            { width: window.innerWidth, height: window.innerHeight },
            bucketTooltipWidth(window.innerWidth)
          );
          tooltip.options.direction = placement.direction;
          tooltip.options.offset = placement.offset;
        });
        marker.bindTooltip(
          `<div class="atlas-tooltip-scroll-inner"><div style="font-size:12px;font-weight:600">${escapeHtml(b.name)}</div>${b.notes ? `<div style="font-size:10px;opacity:0.7;margin-top:2px">${escapeHtml(b.notes)}</div>` : ''}</div>`,
          { className: 'atlas-tooltip atlas-tooltip-scrollable', direction: 'top', offset: [0, -14], interactive: true }
        );
        // Leaflet closes the tooltip the instant the pointer leaves the marker's tiny
        // hit area — replace that with a delayed close, cancelled while hovering the
        // tooltip itself, so the pointer has a path from marker to tooltip to scroll it.
        let closeTimer: ReturnType<typeof setTimeout> | null = null;
        const cancelClose = () => {
          if (closeTimer) {
            clearTimeout(closeTimer);
            closeTimer = null;
          }
        };
        const scheduleClose = () => {
          closeTimer = setTimeout(() => marker.closeTooltip(), 200);
        };
        marker.off('mouseout', marker.closeTooltip, marker);
        marker.on('mouseout', scheduleClose);
        // The way back from the tooltip onto the marker fires the tooltip's mouseleave
        // first, so the close it just scheduled has to be taken back here.
        marker.on('mouseover', cancelClose);
        marker.on('tooltipopen', () => {
          const el = marker.getTooltip()?.getElement();
          if (!el) return;
          el.addEventListener('mouseenter', cancelClose);
          el.addEventListener('mouseleave', scheduleClose);
          // The tooltip pane lives inside the map container, where Leaflet cancels both
          // gestures before they reach the note: the wheel would zoom the map and a touch
          // swipe would pan it instead of scrolling.
          L.DomEvent.disableScrollPropagation(el);
          L.DomEvent.disableClickPropagation(el);
          const inner = el.querySelector<HTMLElement>('.atlas-tooltip-scroll-inner');
          if (inner)
            inner.style.overflowY = bucketTooltipNeedsScroll(inner.scrollHeight, inner.clientHeight)
              ? 'auto'
              : 'hidden';
        });
        return marker;
      });
    bucketMarkersRef.current = L.layerGroup(markers).addTo(mapInstance.current);
  }, [bucketList]);

  const countryDetailRequest = useRef(0);
  const placeLocateRequest = useRef(0);

  const loadCountryDetail = async (code: string): Promise<void> => {
    const requestId = ++countryDetailRequest.current;
    setSelectedCountry(code);
    try {
      const r = await apiClient.get(`/addons/atlas/country/${code}`);
      if (requestId === countryDetailRequest.current) setCountryDetail(r.data);
    } catch {
      if (requestId === countryDetailRequest.current) setCountryDetail(null);
    }
  };
  loadCountryDetailRef.current = loadCountryDetail;

  const stats = data?.stats || { totalTrips: 0, totalPlaces: 0, totalCountries: 0, totalDays: 0 };
  const countries = data?.countries || [];

  return {
    t,
    language,
    navigate,
    resolveName,
    dark,
    loading,
    mapRef,
    regionTooltipRef,
    panelRef,
    glareRef,
    borderGlareRef,
    handlePanelMouseMove,
    handlePanelMouseLeave,
    data,
    setData,
    stats,
    countries,
    selectedCountry,
    countryDetail,
    visitedCountries,
    visibleCountries,
    showPlanned,
    togglePlanned,
    loadCountryDetail,
    handleUnmarkCountry,
    select_country_from_search,
    visitedRegions,
    setVisitedRegions,
    atlas_country_search,
    set_atlas_country_search,
    atlas_country_results,
    set_atlas_country_results,
    atlas_country_open,
    set_atlas_country_open,
    atlas_country_options,
    atlas_place_results,
    atlas_places_loading,
    search_places,
    select_place_from_search,
    confirmAction,
    setConfirmAction,
    executeConfirmAction,
    bucketMonth,
    setBucketMonth,
    bucketYear,
    setBucketYear,
    bucketList,
    setBucketList,
    bucketTab,
    setBucketTab,
    showBucketAdd,
    setShowBucketAdd,
    bucketForm,
    setBucketForm,
    handleAddBucketItem,
    handleDeleteBucketItem,
    handleBucketPoiSearch,
    handleSelectBucketPoi,
    bucketSearchResults,
    setBucketSearchResults,
    bucketPoiMonth,
    setBucketPoiMonth,
    bucketPoiYear,
    setBucketPoiYear,
    bucketSearching,
    bucketSearch,
    setBucketSearch,
    // Landmark features
    selectedLandmark,
    setSelectedLandmark,
    showLandmarks,
    setShowLandmarks,
    selectedCheckin,
    setSelectedCheckin,
    toggleLandmarkVisit: (provinceCode: string, landmarkName: string) => {
      toggleLandmarkVisit(provinceCode, landmarkName);
      setLandmarkRefreshTrigger((v) => v + 1);
    },
  };
}
