import { useEffect, useMemo, useRef, useState } from 'react';
import { pluginsApi, type PluginMapLayer, type PluginMapMarker } from '../../api/client';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useSettingsStore } from '../../store/settingsStore';
import type { RouteVia } from '../../types';
import ErrorBoundary from '../shared/ErrorBoundary';
import { MapView } from './MapView';
import { clusterAMapPoints, type AMapPlaceCluster } from './amapClusters';
import { ReservationAMapOverlay, attachLocationAMapOverlay } from './amapOverlays';
import { gcj02ToWgs84, loadAmap, wgs84ToGcj02, type AMapMap, type AMapModule, type AMapOverlay } from './engines/amap';
import { hasManualTrackColor, resolveTrackColor } from './trackColors';

const TONES: Record<string, string> = { default: '#4F46E5', success: '#10b981', warn: '#f59e0b', danger: '#ef4444' };
const valid = (lat: unknown, lng: unknown) => Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
const gcjPath = (points: [number, number][]) =>
  points
    .filter((p) => valid(p[0], p[1]))
    .map(([lat, lng]) => {
      const c = wgs84ToGcj02(lng, lat);
      return [c.lng, c.lat] as [number, number];
    });
const point = (p: any) => (valid(p?.lat, p?.lng) ? wgs84ToGcj02(Number(p.lng), Number(p.lat)) : null);
function html(value: unknown) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  );
}
function dwell(seconds: number) {
  const m = Math.round(seconds / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
}

export function MapViewAMap(props: any) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<AMapMap | null>(null);
  const amapRef = useRef<AMapModule | null>(null);
  const overlaysRef = useRef<AMapOverlay[]>([]);
  const infoRef = useRef<any>(null);
  const reservationOverlayRef = useRef<ReservationAMapOverlay | null>(null);
  const locationOverlayRef = useRef<ReturnType<typeof attachLocationAMapOverlay> | null>(null);
  const suppressMapClickRef = useRef(false);
  const callbacksRef = useRef({ onMapClick: props.onMapClick, onMapContextMenu: props.onMapContextMenu });
  callbacksRef.current = { onMapClick: props.onMapClick, onMapContextMenu: props.onMapContextMenu };
  const suppressMapClick = () => {
    suppressMapClickRef.current = true;
    queueMicrotask(() => {
      suppressMapClickRef.current = false;
    });
  };
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [pluginMarkers, setPluginMarkers] = useState<PluginMapMarker[]>([]);
  const [pluginLayers, setPluginLayers] = useState<PluginMapLayer[]>([]);
  const [pluginVersion, setPluginVersion] = useState(0);
  const [mapZoom, setMapZoom] = useState<number | null>(null);
  const places = props.places || [];
  const dayPlaces = props.dayPlaces || [];
  const selected = props.selectedPlaceId;
  const { position, mode } = useGeolocation();
  const settingsKey = useSettingsStore((s) => s.settings.amap_js_api_key);
  const points = useMemo(() => places.filter((p: any) => valid(p.lat, p.lng)), [places]);

  useEffect(() => {
    let cancelled = false;
    let onMapClick: ((event: any) => void) | null = null;
    let onContextMenu: ((event: any) => void) | null = null;
    let onZoomEnd: (() => void) | null = null;
    loadAmap(settingsKey)
      .then((AMap) => {
        if (cancelled || !hostRef.current) return;
        amapRef.current = AMap;
        const center = props.center || [0, 0];
        const c = wgs84ToGcj02(Number(center[1]), Number(center[0]));
        const is3d = props.amapViewMode === '3D';
        const map = new AMap.Map(hostRef.current, {
          zoom: Number(props.zoom ?? 5),
          center: [c.lng, c.lat],
          lang: 'zh_cn',
          viewMode: is3d ? '3D' : '2D',
          pitch: is3d ? Number(props.amapPitch ?? 45) : 0,
          rotation: Number(props.amapRotation ?? 0),
          showBuildingBlock: is3d,
          resizeEnable: true,
        });
        mapRef.current = map;
        onMapClick = (event: any) => {
          if (suppressMapClickRef.current) {
            suppressMapClickRef.current = false;
            return;
          }
          const ll = event.lnglat;
          const w = gcj02ToWgs84(Number(ll.getLng()), Number(ll.getLat()));
          callbacksRef.current.onMapClick?.({ lat: w.lat, lng: w.lng, latlng: w });
        };
        onContextMenu = (event: any) => {
          const ll = event.lnglat;
          const w = gcj02ToWgs84(Number(ll.getLng()), Number(ll.getLat()));
          callbacksRef.current.onMapContextMenu?.({
            latlng: w,
            originalEvent: event.originEvent || event.originalEvent,
          });
        };
        onZoomEnd = () => setMapZoom(Number(map.getZoom?.() ?? props.zoom ?? 5));
        map.on('click', onMapClick);
        map.on('contextmenu', onContextMenu);
        map.on('zoomend', onZoomEnd);
        setMapZoom(Number(map.getZoom?.() ?? props.zoom ?? 5));
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      overlaysRef.current.forEach((o) => o.setMap(null));
      overlaysRef.current = [];
      infoRef.current?.close?.();
      const map = mapRef.current;
      if (map?.off) {
        if (onMapClick) map.off('click', onMapClick);
        if (onContextMenu) map.off('contextmenu', onContextMenu);
        if (onZoomEnd) map.off('zoomend', onZoomEnd);
      }
      reservationOverlayRef.current?.destroy();
      reservationOverlayRef.current = null;
      locationOverlayRef.current?.destroy();
      locationOverlayRef.current = null;
      mapRef.current?.destroy();
      mapRef.current = null;
      setReady(false);
    };
  }, [settingsKey]); // map lifecycle is intentionally mount-only

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const center = props.center || [0, 0];
    const c = wgs84ToGcj02(Number(center[1]), Number(center[0]));
    map.setZoomAndCenter(Number(props.zoom ?? 5), [c.lng, c.lat]);
  }, [props.center?.[0], props.center?.[1], props.zoom, ready]);

  // Core place markers, POIs, via points, plugin markers and InfoWindow interactions.
  useEffect(() => {
    const map = mapRef.current;
    const AMap = amapRef.current;
    if (!map || !AMap || !ready) return;
    const old = overlaysRef.current;
    old.forEach((o) => o.setMap(null));
    overlaysRef.current = [];
    const info =
      infoRef.current || (AMap.InfoWindow ? new AMap.InfoWindow({ offset: [0, -8], isCustom: false }) : null);
    infoRef.current = info;
    const addMarker = (spec: any, click?: () => void, hoverText?: string) => {
      const marker = new AMap.Marker({
        position: spec.position,
        title: spec.title || '',
        content: spec.content,
        draggable: !!spec.draggable,
        zIndex: spec.zIndex || 100,
      });
      marker.setMap(map);
      marker.on?.('click', () => {
        suppressMapClick();
        click?.();
      });
      if (hoverText) {
        marker.on?.('mouseover', () => info?.setContent(hoverText) && info.open(map, spec.position));
        marker.on?.('mouseout', () => info?.close());
      }
      overlaysRef.current.push(marker);
      return marker;
    };
    const clusters = clusterAMapPoints(
      points.map((place: any) => ({ item: place, lat: Number(place.lat), lng: Number(place.lng) })),
      mapZoom ?? Number(map.getZoom?.() ?? props.zoom ?? 5)
    );
    const expandCluster = (cluster: AMapPlaceCluster<any>) => {
      const c = wgs84ToGcj02(cluster.lng, cluster.lat);
      const nextZoom = Math.min(11, Number(map.getZoom?.() ?? props.zoom ?? 5) + 2);
      map.setZoomAndCenter(nextZoom, [c.lng, c.lat]);
    };
    for (const cluster of clusters) {
      if (cluster.members.length > 1) {
        const c = wgs84ToGcj02(cluster.lng, cluster.lat);
        const count = cluster.members.length;
        addMarker(
          {
            position: [c.lng, c.lat],
            title: `${count} places`,
            content: `<div style="min-width:36px;height:36px;padding:0 8px;display:flex;align-items:center;justify-content:center;border-radius:999px;background:#111827;color:#fff;border:2px solid rgba(255,255,255,.9);box-shadow:0 1px 5px #555;font:600 12px/1 sans-serif">${count}</div>`,
            zIndex: 900,
          },
          () => expandCluster(cluster)
        );
        continue;
      }
      const place = cluster.members[0] as any;
      const c = point(place)!;
      const isSelected = place.id === selected;
      const color = place.category_color || '#2563eb';
      const content = `<div style="width:${isSelected ? 22 : 18}px;height:${isSelected ? 22 : 18}px;border-radius:50%;background:${html(color)};border:3px solid ${isSelected ? '#111827' : '#fff'};box-shadow:0 1px 5px #555"></div>`;
      const marker = addMarker(
        {
          position: [c.lng, c.lat],
          title: place.name,
          content,
          draggable: !!props.onMarkerDrag,
          zIndex: isSelected ? 1000 : 100,
        },
        () => props.onMarkerClick?.(place.id),
        place.name ? `<b>${html(place.name)}</b><br/>${html(place.address || '')}` : undefined
      );
      marker.on?.('dragend', (e: any) => {
        const ll = e.lnglat;
        props.onMarkerDrag?.(place, gcj02ToWgs84(Number(ll.getLng()), Number(ll.getLat())));
      });
    }
    for (const poi of props.pois || []) {
      const c = point(poi);
      if (!c) continue;
      addMarker(
        {
          position: [c.lng, c.lat],
          title: poi.name,
          content: `<div style="width:18px;height:18px;border-radius:50%;background:#f59e0b;border:2px solid white"></div>`,
          zIndex: 500,
        },
        () => props.onPoiClick?.(poi),
        poi.name
      );
    }
    for (const via of (props.routeVias || []) as RouteVia[]) {
      const c = point(via);
      if (!c) continue;
      const color = TONES[via.tone] || TONES.default;
      addMarker(
        {
          position: [c.lng, c.lat],
          content: `<div style="width:13px;height:13px;border-radius:50%;background:#fff;border:3px solid ${color}"></div>`,
          zIndex: 700,
        },
        () => {
          if (via.label || via.dwellSeconds != null) {
            info?.setContent(
              html([via.label, via.dwellSeconds != null ? dwell(via.dwellSeconds) : ''].filter(Boolean).join(' · '))
            );
            info?.open(map, [c.lng, c.lat]);
          }
        }
      );
    }
    for (const layer of pluginLayers) {
      for (const feature of layer.features || []) {
        const color = TONES[feature.tone] || TONES.default;
        if (feature.type === 'circle' && AMap.Circle && feature.center && feature.radiusM) {
          const c = wgs84ToGcj02(feature.center[1], feature.center[0]);
          const shape = new AMap.Circle({
            center: [c.lng, c.lat],
            radius: feature.radiusM,
            strokeColor: color,
            strokeWeight: feature.width,
            strokeOpacity: feature.opacity,
            fillColor: color,
            fillOpacity: feature.fill ? feature.opacity * 0.25 : 0,
          });
          shape.setMap(map);
          overlaysRef.current.push(shape);
        } else if (feature.points) {
          const path = gcjPath(feature.points);
          const Ctor = feature.type === 'polygon' ? AMap.Polygon : AMap.Polyline;
          if (!Ctor) continue;
          const shape = new Ctor({
            path,
            strokeColor: color,
            strokeWeight: feature.width,
            strokeOpacity: feature.opacity,
            strokeStyle: feature.dash === 'solid' ? 'solid' : 'dashed',
            fillColor: color,
            fillOpacity: feature.fill ? feature.opacity * 0.25 : 0,
          });
          shape.setMap(map);
          overlaysRef.current.push(shape);
        }
      }
    }
    return () => {
      overlaysRef.current.forEach((o) => o.setMap(null));
      overlaysRef.current = [];
    };
  }, [
    points,
    props.pois,
    props.routeVias,
    props.tripId,
    selected,
    props.onMarkerClick,
    props.onMarkerDrag,
    props.onPoiClick,
    pluginVersion,
    pluginLayers,
    mapZoom,
    ready,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    const AMap = amapRef.current;
    if (!map || !AMap || !ready) return;
    const lines: AMapOverlay[] = [];
    const addLine = (path: [number, number][], options: any) => {
      if (path.length < 2) return;
      const line = new AMap.Polyline({ path, ...options });
      line.setMap(map);
      lines.push(line);
    };
    const route = props.route || [];
    for (const seg of route)
      addLine(gcjPath(seg), { strokeColor: '#fff', strokeWeight: 9, strokeOpacity: 0.95, zIndex: 20 });
    for (const seg of route)
      addLine(gcjPath(seg), { strokeColor: '#2563eb', strokeWeight: 5, strokeOpacity: 0.85, zIndex: 21 });
    for (const place of places) {
      if (!place.route_geometry) continue;
      try {
        const coords = JSON.parse(place.route_geometry) as [number, number][];
        const path = gcjPath(coords);
        const color = resolveTrackColor(place);
        addLine(path, {
          strokeColor: '#fff',
          strokeWeight: hasManualTrackColor(place) ? 7 : 6,
          strokeOpacity: 0.95,
          zIndex: 10,
        });
        addLine(path, {
          strokeColor: color,
          strokeWeight: hasManualTrackColor(place) ? 4 : 3,
          strokeOpacity: 0.9,
          zIndex: 11,
        });
        const hit = new AMap.Polyline({
          path,
          strokeColor: 'transparent',
          strokeWeight: 18,
          strokeOpacity: 0,
          zIndex: 12,
        });
        hit.setMap(map);
        hit.on?.('click', () => {
          suppressMapClick();
          props.onMarkerClick?.(place.id);
        });
        lines.push(hit);
      } catch {
        /* invalid GPX is safely ignored */
      }
    }
    return () => lines.forEach((l) => l.setMap(null));
  }, [places, props.route, ready, props.onMarkerClick]);

  useEffect(() => {
    if (props.tripId == null) {
      setPluginMarkers([]);
      setPluginLayers([]);
      return;
    }
    let alive = true;
    Promise.all([pluginsApi.mapMarkers(props.tripId), pluginsApi.mapLayers(props.tripId)])
      .then(([m, l]) => {
        if (!alive) return;
        setPluginMarkers(m.markers || []);
        setPluginLayers(l.layers || []);
        setPluginVersion((version) => version + 1);
      })
      .catch(() => {
        if (!alive) return;
        setPluginMarkers([]);
        setPluginLayers([]);
        setPluginVersion((version) => version + 1);
      });
    return () => {
      alive = false;
    };
  }, [props.tripId]);

  useEffect(() => {
    const map = mapRef.current;
    const AMap = amapRef.current;
    if (!map || !AMap || !ready) return;
    const extras: AMapOverlay[] = [];
    for (const mk of pluginMarkers) {
      const c = point(mk);
      if (!c) continue;
      const marker = new AMap.Marker({
        position: [c.lng, c.lat],
        content: `<div style="width:16px;height:16px;border-radius:50%;background:${TONES[mk.tone] || TONES.default};border:2px solid #fff"></div>`,
      });
      marker.setMap(map);
      marker.on?.('click', () => {
        suppressMapClick();
        infoRef.current?.setContent(
          `<b>${html(mk.label)}</b><br/>${html(mk.popupText)}${mk.url ? `<br/><a href="${html(mk.url)}" target="_blank">${html(mk.url)}</a>` : ''}`
        );
        infoRef.current?.open(map, [c.lng, c.lat]);
      });
      extras.push(marker);
    }
    return () => extras.forEach((x) => x.setMap(null));
  }, [pluginMarkers, pluginVersion, ready]);

  useEffect(() => {
    const map = mapRef.current;
    const AMap = amapRef.current;
    if (!map || !AMap || !ready) return;
    if (!reservationOverlayRef.current) reservationOverlayRef.current = new ReservationAMapOverlay(map, AMap);
    const reservations = props.reservations || [];
    reservationOverlayRef.current.update(reservations, {
      showConnections: props.showTransitRoutes !== false,
      showEndpointLabels: !!props.showReservationStats,
      onEndpointClick: (reservationId: number) => {
        suppressMapClick();
        props.onReservationClick?.(reservationId);
      },
    });
  }, [props.reservations, props.showTransitRoutes, props.showReservationStats, props.onReservationClick, ready]);

  useEffect(() => {
    const map = mapRef.current;
    const AMap = amapRef.current;
    if (!map || !AMap || !ready) return;
    if (!locationOverlayRef.current) locationOverlayRef.current = attachLocationAMapOverlay(map, AMap);
    locationOverlayRef.current.update(position, { follow: mode === 'follow' });
  }, [position, mode, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || props.fitKey == null) return;
    const target = (dayPlaces.length ? dayPlaces : places).filter((p: any) => valid(p.lat, p.lng));
    if (!target.length) return;
    const overlays = target
      .map((p: any) => {
        const c = point(p)!;
        const m = amapRef.current?.Marker ? new amapRef.current.Marker({ position: [c.lng, c.lat] }) : null;
        m?.setMap(map);
        return m;
      })
      .filter(Boolean) as AMapOverlay[];
    map.setFitView(overlays, false, [60, 60, 60, 60]);
    overlays.forEach((o) => o.setMap(null));
  }, [props.fitKey, dayPlaces, places, ready]);

  if (failed) return <MapView {...props} />;
  return <div ref={hostRef} style={{ width: '100%', height: '100%', minHeight: 240 }} aria-label="高德地图" />;
}

export function AMapFallbackBoundary(props: any) {
  return (
    <ErrorBoundary boundaryId="map:amap" resetKeys={['amap']} fallback={<MapView {...props} />}>
      <MapViewAMap {...props} />
    </ErrorBoundary>
  );
}
