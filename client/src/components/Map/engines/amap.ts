export type AMapModule = {
  Map: new (container: HTMLElement, options?: Record<string, unknown>) => AMapMap;
  Marker: new (options?: Record<string, unknown>) => AMapMarker;
  Polyline: new (options?: Record<string, unknown>) => AMapPolyline;
  InfoWindow: new (options?: Record<string, unknown>) => AMapInfoWindow;
  Polygon?: new (options?: Record<string, unknown>) => AMapOverlay;
  Circle?: new (options?: Record<string, unknown>) => AMapOverlay;
  Buildings?: new (options?: Record<string, unknown>) => AMapOverlay;
  LngLat: new (lng: number, lat: number) => AMapLngLat;
};

type AMapLngLat = { getLng: () => number; getLat: () => number };
export type AMapOverlay = {
  setMap: (map: AMapMap | null) => void;
  on?: (event: string, handler: (event: any) => void) => void;
  setPosition?: (position: [number, number]) => void;
  setPath?: (path: [number, number][]) => void;
};
export type AMapMarker = AMapOverlay & {
  setContent?: (content: string | HTMLElement) => void;
  setOffset?: (offset: [number, number]) => void;
  setZIndex?: (zIndex: number) => void;
};
export type AMapPolyline = AMapOverlay;
export type AMapInfoWindow = {
  open: (map: AMapMap, position: [number, number]) => void;
  close: () => void;
  setContent: (content: string | HTMLElement) => void;
  setPosition?: (position: [number, number]) => void;
};
export type AMapMap = {
  destroy: () => void;
  resize?: () => void;
  setZoomAndCenter: (zoom: number, center: [number, number]) => void;
  setCenter?: (center: [number, number]) => void;
  setZoom?: (zoom: number) => void;
  setFitView: (overlays?: AMapOverlay[], immediately?: boolean, avoid?: number[]) => void;
  getCenter?: () => AMapLngLat;
  getZoom?: () => number;
  getBounds?: () => { getSouthWest: () => AMapLngLat; getNorthEast: () => AMapLngLat };
  easeTo?: (options: { center: [number, number]; zoom: number; duration?: number }) => void;
  on: (event: string, handler: (event: any) => void) => void;
  off?: (event: string, handler: (event: any) => void) => void;
};

type AMapWindow = Window & { AMap?: AMapModule };

let loading: { key: string; promise: Promise<AMapModule> } | null = null;

export function loadAmap(apiKey?: string): Promise<AMapModule> {
  const key = apiKey?.trim() || (window as any).__TREK_AMAP_JS_KEY__ || '';
  if ((window as AMapWindow).AMap && (!loading || loading.key === key))
    return Promise.resolve((window as AMapWindow).AMap as AMapModule);
  if (loading?.key === key) return loading.promise;
  const promise = new Promise<AMapModule>((resolve, reject) => {
    const existing = document.querySelector('script[data-trek-amap]') as HTMLScriptElement | null;
    const script = existing ?? document.createElement('script');
    script.dataset.trekAmap = 'true';
    script.src = 'https://webapi.amap.com/maps?v=2.0&key=' + encodeURIComponent(key) + '&lang=zh_cn';
    script.async = true;
    script.onload = () => {
      const api = (window as AMapWindow).AMap;
      api ? resolve(api) : reject(new Error('AMap SDK did not expose AMap'));
    };
    script.onerror = () => reject(new Error('AMap SDK failed to load'));
    if (!existing) document.head.appendChild(script);
  });
  loading = { key, promise };
  return promise;
}

/**
 * The Krasovsky-ellipsoid GCJ-02 transform — the full standard series, matching
 * server/src/nest/geo/gcj02.ts term for term.
 *
 * The sine terms below are not decoration. Dropping them (as this once did) still
 * produces a "plausible" offset and still round-trips, so nothing failed, but it
 * lands 170–330 m from where AMap puts the same point. Verified against AMap's
 * own conversion of 116.478346,39.997361 → 116.484444,39.998649: this
 * implementation agrees within 0.06 m, the truncated one was 273 m out.
 */
function outOfChina(lng: number, lat: number): boolean {
  return !(lng > 73.66 && lng < 135.05 && lat > 3.86 && lat < 53.55);
}

function transformLat(x: number, y: number): number {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin((y / 3.0) * Math.PI)) * 2.0) / 3.0;
  ret += ((160.0 * Math.sin((y / 12.0) * Math.PI) + 320 * Math.sin((y * Math.PI) / 30.0)) * 2.0) / 3.0;
  return ret;
}

function transformLng(x: number, y: number): number {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin((x / 3.0) * Math.PI)) * 2.0) / 3.0;
  ret += ((150.0 * Math.sin((x / 12.0) * Math.PI) + 300.0 * Math.sin((x / 30.0) * Math.PI)) * 2.0) / 3.0;
  return ret;
}

export function wgs84ToGcj02(lng: number, lat: number): { lng: number; lat: number } {
  if (outOfChina(lng, lat)) return { lng, lat };
  const PI = Math.PI,
    A = 6378245.0,
    EE = 0.006693421622965943;
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

export function gcj02ToWgs84(lng: number, lat: number): { lng: number; lat: number } {
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
