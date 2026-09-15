import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock stores to avoid localStorage access during module initialization
vi.mock('../../store/settingsStore', () => ({
  useSettingsStore: vi.fn(() => ({
    language: 'en',
    temperature_unit: 'celsius',
    distance_unit: 'metric',
  })),
}));

// Mock Leaflet before importing the component to prevent window access errors
vi.mock('leaflet', () => ({
  default: {},
  map: vi.fn(),
  marker: vi.fn(),
  tileLayer: vi.fn(),
}));

// Mock MapView (Leaflet fallback) to prevent it from being used
vi.mock('./MapView', () => ({
  MapView: vi.fn(() => null),
}));

import { MapViewAMap } from './MapViewAMap';

const mockAMap = () => {
  const overlays: any[] = [];
  const listeners = new Map<string, ((e: any) => void)[]>();

  const map = {
    destroy: vi.fn(),
    setZoomAndCenter: vi.fn(),
    setFitView: vi.fn(),
    getZoom: vi.fn(() => 10),
    setCenter: vi.fn(),
    on: vi.fn((event: string, handler: (e: any) => void) => {
      const handlers = listeners.get(event) || [];
      handlers.push(handler);
      listeners.set(event, handlers);
    }),
    off: vi.fn((event: string, handler: (e: any) => void) => {
      const handlers = listeners.get(event) || [];
      listeners.set(
        event,
        handlers.filter((h) => h !== handler)
      );
    }),
    trigger: (event: string, payload: any) => {
      const handlers = listeners.get(event) || [];
      handlers.forEach((h) => h(payload));
    },
  };

  // Create real constructor functions, not arrow functions
  function MockMap(_container: HTMLElement, _options?: any) {
    return map;
  }

  function MockMarker(opts: any) {
    const marker = {
      options: opts,
      setMap: vi.fn((m: any) => {
        if (m) overlays.push(marker);
        else overlays.splice(overlays.indexOf(marker), 1);
      }),
      on: vi.fn(),
      setPosition: vi.fn(),
      getElement: vi.fn(() => {
        if (typeof document !== 'undefined') {
          return document.createElement('div');
        }
        return null;
      }),
    };
    return marker;
  }

  function MockPolyline(opts: any) {
    const line = { options: opts, setMap: vi.fn(), on: vi.fn() };
    return line;
  }

  function MockCircle(opts: any) {
    const circle = { options: opts, setMap: vi.fn(), on: vi.fn() };
    return circle;
  }

  function MockPolygon(opts: any) {
    const polygon = { options: opts, setMap: vi.fn(), on: vi.fn() };
    return polygon;
  }

  function MockInfoWindow() {
    return { open: vi.fn(), close: vi.fn(), setContent: vi.fn() };
  }

  function MockLngLat(lng: number, lat: number) {
    return { getLng: () => lng, getLat: () => lat };
  }

  const AMap = {
    Map: vi.fn(MockMap),
    Marker: vi.fn(MockMarker),
    Polyline: vi.fn(MockPolyline),
    Circle: vi.fn(MockCircle),
    Polygon: vi.fn(MockPolygon),
    InfoWindow: vi.fn(MockInfoWindow),
    LngLat: vi.fn(MockLngLat),
  };

  return { map, AMap, overlays, listeners };
};

// Store the current mock instance globally so tests can access it
let currentMockInstance: ReturnType<typeof mockAMap> | null = null;

vi.mock('./engines/amap', () => {
  return {
    loadAmap: vi.fn(async () => {
      // Add a small delay to allow React to attach the ref
      await new Promise((resolve) => setTimeout(resolve, 50));
      currentMockInstance = mockAMap();
      return currentMockInstance.AMap;
    }),
    wgs84ToGcj02: vi.fn((lng: number, lat: number) => {
      return { lng: lng + 0.006, lat: lat + 0.006 };
    }),
    gcj02ToWgs84: vi.fn((lng: number, lat: number) => ({ lng: lng - 0.006, lat: lat - 0.006 })),
  };
});

vi.mock('../../hooks/useGeolocation', () => ({
  useGeolocation: vi.fn(() => ({ position: null, mode: null })),
}));

vi.mock('../../api/client', () => ({
  pluginsApi: {
    mapMarkers: vi.fn(() => Promise.resolve({ markers: [] })),
    mapLayers: vi.fn(() => Promise.resolve({ layers: [] })),
  },
  mapsApi: {
    // Add any mapsApi methods if needed
  },
}));

vi.mock('./amapOverlays', () => ({
  ReservationAMapOverlay: vi.fn(function ReservationAMapOverlay(_map: any, _AMap: any) {
    return {
      update: vi.fn(),
      destroy: vi.fn(),
    };
  }),
  attachLocationAMapOverlay: vi.fn(() => ({
    update: vi.fn(),
    destroy: vi.fn(),
  })),
}));

describe('MapViewAMap clustering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentMockInstance = null;
  });

  it('FE-COMP-MAPVIEWAMAP-001: clusters nearby places at zoom 10', async () => {
    const { loadAmap } = await import('./engines/amap');
    const { container } = render(
      <MapViewAMap
        places={[
          { id: 1, lat: 39.908, lng: 116.397, name: 'A' },
          { id: 2, lat: 39.9081, lng: 116.3971, name: 'B' },
        ]}
        zoom={10}
        center={[39.908, 116.397]}
      />
    );

    // Wait for component to fully render and ref to be attached
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify loadAmap was called
    await waitFor(() => expect(loadAmap).toHaveBeenCalled(), { timeout: 3000 });

    // Verify mock instance was created
    await waitFor(() => expect(currentMockInstance).toBeTruthy(), { timeout: 3000 });

    // Wait for Map to be constructed
    await waitFor(
      () => {
        expect(currentMockInstance!.AMap.Map).toHaveBeenCalled();
      },
      { timeout: 3000 }
    );

    const AMap = currentMockInstance!.AMap;

    // Wait for markers to be created
    await waitFor(
      () => {
        const markerCalls = AMap.Marker.mock.calls;
        expect(markerCalls.length).toBeGreaterThan(0);
      },
      { timeout: 3000 }
    );

    const markerCalls = AMap.Marker.mock.calls;
    // Find the cluster marker - it should have "2 places" in the title
    const clusterMarker = markerCalls.find(
      (call: any) => call[0]?.title?.includes('places') || call[0]?.content?.includes('places')
    );
    expect(clusterMarker).toBeTruthy();
    expect(clusterMarker[0].title).toBe('2 places');
  });

  it('FE-COMP-MAPVIEWAMAP-002: dissolves clusters at zoom 11', async () => {
    const { loadAmap } = await import('./engines/amap');
    const { rerender } = render(
      <MapViewAMap
        places={[
          { id: 1, lat: 39.908, lng: 116.397, name: 'A' },
          { id: 2, lat: 39.9081, lng: 116.3971, name: 'B' },
        ]}
        zoom={11}
        center={[39.908, 116.397]}
      />
    );

    await waitFor(() => expect(loadAmap).toHaveBeenCalled());
    await waitFor(() => expect(currentMockInstance).toBeTruthy());
    const AMap = currentMockInstance!.AMap;

    rerender(
      <MapViewAMap
        places={[
          { id: 1, lat: 39.908, lng: 116.397, name: 'A' },
          { id: 2, lat: 39.9081, lng: 116.3971, name: 'B' },
        ]}
        zoom={11}
        center={[39.908, 116.397]}
      />
    );

    await waitFor(() => {
      const markerCalls = AMap.Marker.mock.calls;
      const clusterMarkers = markerCalls.filter((call: any) => call[0].content?.includes('places'));
      expect(clusterMarkers.length).toBe(0);
    });
  });
});

describe('MapViewAMap event priority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentMockInstance = null;
  });

  it('FE-COMP-MAPVIEWAMAP-003: marker click suppresses map click', async () => {
    const { loadAmap } = await import('./engines/amap');
    const onMapClick = vi.fn();
    const onMarkerClick = vi.fn();

    render(
      <MapViewAMap
        places={[{ id: 1, lat: 39.908, lng: 116.397, name: 'A' }]}
        zoom={12}
        center={[39.908, 116.397]}
        onMapClick={onMapClick}
        onMarkerClick={onMarkerClick}
      />
    );

    await waitFor(() => expect(loadAmap).toHaveBeenCalled());
    await waitFor(() => expect(currentMockInstance).toBeTruthy());
    const { AMap, map } = currentMockInstance!;

    // Wait for marker to be created
    await waitFor(
      () => {
        expect(AMap.Marker.mock.results.length).toBeGreaterThan(0);
      },
      { timeout: 3000 }
    );

    const marker = AMap.Marker.mock.results[0].value;

    // Verify marker.on was called with 'click'
    await waitFor(() => {
      const clickCall = marker.on.mock.calls.find((call: any) => call[0] === 'click');
      expect(clickCall).toBeTruthy();
    });

    const clickCall = marker.on.mock.calls.find((call: any) => call[0] === 'click');
    const markerClickHandler = clickCall![1];

    // Trigger marker click - this sets suppressMapClickRef to true
    markerClickHandler();

    // Immediately trigger map click (before microtask runs)
    // This should be suppressed
    map.trigger('click', { lnglat: { getLng: () => 116.397, getLat: () => 39.908 } });

    // onMarkerClick should be called with place id (1)
    expect(onMarkerClick).toHaveBeenCalledWith(1);

    // Map click should be suppressed because marker was clicked
    expect(onMapClick).not.toHaveBeenCalled();
  });

  it('FE-COMP-MAPVIEWAMAP-004: GPX track click suppresses map click', async () => {
    const { loadAmap } = await import('./engines/amap');
    const onMapClick = vi.fn();
    const onMarkerClick = vi.fn();

    render(
      <MapViewAMap
        places={[
          {
            id: 1,
            lat: 39.908,
            lng: 116.397,
            name: 'A',
            route_geometry: JSON.stringify([
              [39.908, 116.397],
              [39.909, 116.398],
            ]),
          },
        ]}
        zoom={12}
        center={[39.908, 116.397]}
        onMapClick={onMapClick}
        onMarkerClick={onMarkerClick}
      />
    );

    await waitFor(() => expect(loadAmap).toHaveBeenCalled());
    await waitFor(() => expect(currentMockInstance).toBeTruthy());
    const { AMap, map } = currentMockInstance!;

    // Wait for polylines to be created
    await waitFor(
      () => {
        expect(AMap.Polyline.mock.results.length).toBeGreaterThan(0);
      },
      { timeout: 3000 }
    );

    const hitLine = AMap.Polyline.mock.results.find((r: any) => r.value.options.strokeOpacity === 0)?.value;
    expect(hitLine).toBeTruthy();

    const hitClickHandler = hitLine?.on.mock.calls.find((call: any) => call[0] === 'click')?.[1];
    expect(hitClickHandler).toBeTruthy();

    // Trigger GPX track click - this sets suppressMapClickRef to true
    hitClickHandler?.();

    // Immediately trigger map click (before microtask runs)
    // This should be suppressed
    map.trigger('click', { lnglat: { getLng: () => 116.397, getLat: () => 39.908 } });

    expect(onMarkerClick).toHaveBeenCalledWith(1);
    expect(onMapClick).not.toHaveBeenCalled();
  });
});

describe('MapViewAMap lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentMockInstance = null;
  });

  it('FE-COMP-MAPVIEWAMAP-005: cleans up event listeners on unmount', async () => {
    const { loadAmap } = await import('./engines/amap');
    const { unmount } = render(<MapViewAMap zoom={10} center={[39.908, 116.397]} />);

    await waitFor(() => expect(loadAmap).toHaveBeenCalled());
    await waitFor(() => expect(currentMockInstance).toBeTruthy());
    const { map } = currentMockInstance!;

    unmount();

    expect(map.off).toHaveBeenCalledWith('click', expect.any(Function));
    expect(map.off).toHaveBeenCalledWith('contextmenu', expect.any(Function));
    expect(map.off).toHaveBeenCalledWith('zoomend', expect.any(Function));
    expect(map.destroy).toHaveBeenCalled();
  });

  it('FE-COMP-MAPVIEWAMAP-006: reuses reservation overlay on props update', async () => {
    const { loadAmap } = await import('./engines/amap');
    const { ReservationAMapOverlay } = await import('./amapOverlays');

    const { rerender } = render(<MapViewAMap reservations={[]} zoom={10} center={[39.908, 116.397]} />);

    await waitFor(() => expect(loadAmap).toHaveBeenCalled(), { timeout: 3000 });
    await waitFor(() => expect(currentMockInstance).toBeTruthy(), { timeout: 3000 });

    const { map } = currentMockInstance!;

    // Wait for map event listeners to be attached (this means ready state is true)
    await waitFor(
      () => {
        expect(map.on).toHaveBeenCalledWith('click', expect.any(Function));
        expect(map.on).toHaveBeenCalledWith('zoomend', expect.any(Function));
      },
      { timeout: 3000 }
    );

    // Wait for the overlay to be created
    await waitFor(
      () => {
        expect(ReservationAMapOverlay).toHaveBeenCalled();
      },
      { timeout: 3000 }
    );

    const firstInstance = (ReservationAMapOverlay as any).mock.results[0]?.value;
    expect(firstInstance).toBeTruthy();

    // Wait for initial update call
    await waitFor(
      () => {
        expect(firstInstance.update).toHaveBeenCalled();
      },
      { timeout: 3000 }
    );

    // Clear the update mock calls
    firstInstance.update.mockClear();

    // Rerender with new reservations
    rerender(
      <MapViewAMap
        reservations={[{ id: 1, trip_id: 1, title: 'Test', status: 'confirmed', type: 'flight', endpoints: [] }]}
        zoom={10}
        center={[39.908, 116.397]}
      />
    );

    // Wait for update to be called again with new reservations
    await waitFor(
      () => {
        expect(firstInstance.update).toHaveBeenCalled();
      },
      { timeout: 3000 }
    );

    // Verify that destroy was NOT called (overlay is reused)
    expect(firstInstance.destroy).not.toHaveBeenCalled();

    // Verify ReservationAMapOverlay was only constructed once
    expect(ReservationAMapOverlay).toHaveBeenCalledTimes(1);
  });
});
