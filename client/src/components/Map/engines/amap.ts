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

export function wgs84ToGcj02(lng: number, lat: number): { lng: number; lat: number } {
  // Same Krasovsky transform as the server adapter, kept in a browser-safe
  // module so markers, routes and click coordinates share one contract.
  if (!(lng > 73.66 && lng < 135.05 && lat > 3.86 && lat < 53.55)) return { lng, lat };
  const PI = Math.PI,
    A = 6378245,
    EE = 0.006693421622965943;
  const tLat = -100 + 2 * (lng - 105) + 3 * (lat - 35) + 0.2 * (lat - 35) ** 2;
  const tLng = 300 + (lng - 105) + 2 * (lat - 35) + 0.1 * (lng - 105) ** 2;
  const r = (lat * PI) / 180,
    m = 1 - EE * Math.sin(r) ** 2,
    s = Math.sqrt(m);
  return {
    lng: lng + (tLng * 180) / ((A / s) * Math.cos(r) * PI),
    lat: lat + (tLat * 180) / (((A * (1 - EE)) / (m * s)) * PI),
  };
}

export function gcj02ToWgs84(lng: number, lat: number): { lng: number; lat: number } {
  if (!(lng > 73.66 && lng < 135.05 && lat > 3.86 && lat < 53.55)) return { lng, lat };
  const target = { lng, lat };
  let guess = { lng, lat };
  for (let i = 0; i < 3; i++) {
    const g = wgs84ToGcj02(guess.lng, guess.lat);
    guess = { lng: guess.lng + target.lng - g.lng, lat: guess.lat + target.lat - g.lat };
  }
  return guess;
}
