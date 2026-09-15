import { Suspense, useImperativeHandle, useRef, type Ref } from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import ErrorBoundary from '../shared/ErrorBoundary';
import JourneyMap, { type JourneyMapHandle } from './JourneyMap';
import JourneyMapAMap from './JourneyMapAMap';
import type { JourneyMapGLHandle } from './JourneyMapGL';

import type { JourneyTrack } from '@trek/shared';
import { JourneyMapGLMapbox, JourneyMapGLMaplibre } from '../Map/glLazy';

// Unified handle — both providers expose the same three methods.
export type JourneyMapAutoHandle = JourneyMapHandle;

interface MapEntry {
  id: string;
  lat: number;
  lng: number;
  title?: string | null;
  location_name?: string | null;
  mood?: string | null;
  entry_date: string;
  dayColor?: string;
  dayLabel?: number;
}

interface Props {
  ref?: Ref<JourneyMapAutoHandle>;
  checkins: unknown[];
  entries: MapEntry[];
  photos?: { id: string; lat: number; lng: number; thumbUrl: string }[];
  onPhotoClick?: (photoIds: string[]) => void;
  cartoApiKey?: string;
  trail?: { lat: number; lng: number }[];
  tracks?: JourneyTrack[];
  height?: number;
  dark?: boolean;
  activeMarkerId?: string | null;
  onMarkerClick?: (id: string, type?: string) => void;
  fullScreen?: boolean;
  paddingBottom?: number;
}

function JourneyMapAuto({ ref, ...props }: Props) {
  const provider = useSettingsStore((s) => s.settings.map_provider);
  const token = useSettingsStore((s) => s.settings.mapbox_access_token);
  const leafletRef = useRef<JourneyMapHandle>(null);
  const glRef = useRef<JourneyMapGLHandle>(null);
  const amapRef = useRef<JourneyMapHandle>(null);

  // Fall back to Leaflet when the user selected Mapbox GL but hasn't
  // supplied a token yet. MapLibre/OpenFreeMap is tokenless.
  const useAMap = provider === 'amap';
  const useGL = !useAMap && (provider === 'maplibre-gl' || (provider === 'mapbox-gl' && !!token));
  const glProvider = provider === 'maplibre-gl' ? 'maplibre-gl' : 'mapbox-gl';

  useImperativeHandle(
    ref,
    () => ({
      highlightMarker: (id) =>
        (useAMap ? amapRef.current : useGL ? glRef.current : leafletRef.current)?.highlightMarker(id),
      focusMarker: (id) => (useAMap ? amapRef.current : useGL ? glRef.current : leafletRef.current)?.focusMarker(id),
      invalidateSize: () => (useAMap ? amapRef.current : useGL ? glRef.current : leafletRef.current)?.invalidateSize(),
    }),
    [useAMap, useGL]
  );

  if (useAMap) {
    return (
      <ErrorBoundary
        boundaryId="journey-map:amap"
        resetKeys={['amap']}
        fallback={<JourneyMap ref={leafletRef} {...(props as any)} />}
      >
        <JourneyMapAMap ref={amapRef} {...(props as any)} />
      </ErrorBoundary>
    );
  }

  const JourneyMapGL = glProvider === 'maplibre-gl' ? JourneyMapGLMaplibre : JourneyMapGLMapbox;
  if (useGL) {
    return (
      // See MapViewAuto: the boundary has to sit outside the Suspense to catch a
      // chunk that never arrives.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <ErrorBoundary
        boundaryId="journey-map:gl"
        resetKeys={[glProvider]}
        fallback={<JourneyMap ref={leafletRef} {...(props as any)} />}
      >
        <Suspense fallback={null}>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <JourneyMapGL ref={glRef} {...(props as any)} glProvider={glProvider} />
        </Suspense>
      </ErrorBoundary>
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <JourneyMap ref={leafletRef} {...(props as any)} />;
}

export default JourneyMapAuto;
