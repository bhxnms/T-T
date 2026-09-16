import { Box, Check, ChevronDown, Globe2, Layers, Map, Save } from 'lucide-react';
import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '../../i18n';
import { useSettingsStore } from '../../store/settingsStore';
import { MapView } from '../Map/MapView';
import CustomSelect from '../shared/CustomSelect';
import { useToast } from '../shared/Toast';
// The preview loads on demand, and paired with a single engine — a Leaflet-only
// install pays for neither, and a GL install pays for one instead of both.
import { useAuthStore } from '../../store/authStore';
import type { Place } from '../../types';
import { withTileApiKey } from '../../utils/tileUrl';
import { GlMapPreviewMapbox, GlMapPreviewMaplibre } from '../Map/glLazy';
import {
  MAPBOX_DEFAULT_STYLE,
  defaultStyleForProvider,
  getStylePresets,
  isOpenFreeMapStyle,
  normalizeStyleForProvider,
  type GlMapProvider,
} from '../Map/glProviders';
import ErrorBoundary from '../shared/ErrorBoundary';
import Section from './Section';
import ToggleSwitch from './ToggleSwitch';

interface MapPreset {
  name: string;
  url: string;
}

const MAP_PRESETS: MapPreset[] = [
  { name: 'OpenStreetMap', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' },
  { name: 'OpenStreetMap DE', url: 'https://tile.openstreetmap.de/{z}/{x}/{y}.png' },
  // The app default, and a vector style rather than a {z}/{x}/{y} template: no
  // key, no registration, no request limits.
  { name: 'OpenFreeMap Positron', url: 'https://tiles.openfreemap.org/styles/positron' },
  { name: 'OpenFreeMap Bright', url: 'https://tiles.openfreemap.org/styles/bright' },
  // CARTO watermarks keyless tiles since 26.08.2026 and issues keys by mail, so
  // these two need one; without it the map falls back to the default (#2054).
  { name: 'CartoDB Light', url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png' },
  { name: 'CartoDB Dark', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' },
  { name: 'Stadia Smooth', url: 'https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png' },
];

// Tag → chip color mapping. Keeps the dropdown readable at a glance so a
// user scanning the list can spot 3D / Satellite / Apple-like styles.
const TAG_STYLES: Record<string, string> = {
  '3D': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
  '2D': 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  Satellite: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  'Apple-like': 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  Modern: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  Dark: 'bg-zinc-800 text-zinc-100 dark:bg-zinc-900 dark:text-zinc-300',
  Minimal: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  Hillshading: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  Terrain: 'bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-300',
  Realistic: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
  Navigation: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  Classic: 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
  Hybrid: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300',
  'No labels': 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
  OpenFreeMap: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
};

function TagChip({ tag }: { tag: string }) {
  const cls = TAG_STYLES[tag] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  return (
    <span className={`rounded px-1.5 py-[3px] text-[9px] font-semibold uppercase leading-none tracking-wide ${cls}`}>
      {tag}
    </span>
  );
}

function StyleDropdown({
  value,
  provider,
  onChange,
}: {
  value: string;
  provider: GlMapProvider;
  onChange: (v: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const presets = getStylePresets(provider);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const selected = presets.find((p) => p.url === value);
  const placeholder =
    provider === 'maplibre-gl' ? t('settings.mapOpenFreeMapStylePlaceholder') : t('settings.mapStylePlaceholder');

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:border-slate-400 focus:border-transparent focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-900"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-slate-900 dark:text-white">{selected ? selected.name : placeholder}</span>
          {selected && (
            <span className="flex flex-shrink-0 items-center gap-1">
              {(selected.tags || []).map((t) => (
                <TagChip key={t} tag={t} />
              ))}
            </span>
          )}
        </span>
        <ChevronDown size={14} className="flex-shrink-0 text-slate-400" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {presets.map((preset) => {
            const isActive = preset.url === value;
            return (
              <button
                key={preset.url}
                type="button"
                onClick={() => {
                  onChange(preset.url);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 ${isActive ? 'bg-slate-50 dark:bg-slate-800' : ''}`}
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-900 dark:text-white">{preset.name}</span>
                  {(preset.tags || []).map((t) => (
                    <TagChip key={t} tag={t} />
                  ))}
                </span>
                {isActive && <Check size={14} className="flex-shrink-0 text-slate-900 dark:text-white" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

type Provider = 'leaflet' | GlMapProvider | 'amap';

function normalizeProvider(value: unknown): Provider {
  return value === 'mapbox-gl' || value === 'maplibre-gl' || value === 'amap' ? value : 'leaflet';
}

function styleForProvider(provider: Provider, style?: string | null): string {
  if (provider === 'amap') return '';
  if (provider === 'leaflet') return style || MAPBOX_DEFAULT_STYLE;
  if (provider === 'mapbox-gl' && isOpenFreeMapStyle(style)) return MAPBOX_DEFAULT_STYLE;
  return normalizeStyleForProvider(provider, style);
}

// Each GL provider has its own style slot, so toggling providers never clobbers the
// other one's style. Leaflet/Mapbox use mapbox_style; MapLibre uses maplibre_style.
function slotStyle(provider: Provider, s: { mapbox_style?: string; maplibre_style?: string }): string | undefined {
  return provider === 'maplibre-gl' ? s.maplibre_style : s.mapbox_style;
}

/**
 * Somewhere recognisable for the style preview to render. A city shows off label density,
 * 3D buildings and satellite texture in a way open ocean cannot — it is not a user setting,
 * and no map opens here: each map frames itself on its own places.
 */
const PREVIEW_CENTER: [number, number] = [48.8566, 2.3522];
const PREVIEW_ZOOM = 16;

export default function MapSettingsTab(): React.ReactElement {
  const { settings, updateSettings } = useSettingsStore();
  const { t } = useTranslation();
  const toast = useToast();
  const initialProvider = normalizeProvider(settings.map_provider);
  const [saving, setSaving] = useState(false);
  const [provider, setProvider] = useState<Provider>(initialProvider);
  const [mapTileUrl, setMapTileUrl] = useState<string>(settings.map_tile_url || '');
  const managed = useAuthStore((s) => s.managed);
  const [mapboxToken, setMapboxToken] = useState<string>(settings.mapbox_access_token || '');
  const [cartoKey, setCartoKey] = useState<string>(settings.carto_api_key || '');
  const [amapKey, setAmapKey] = useState<string>(settings.amap_js_api_key || '');
  const [mapboxStyle, setMapboxStyle] = useState<string>(
    styleForProvider(initialProvider, slotStyle(initialProvider, settings))
  );
  const [mapbox3d, setMapbox3d] = useState<boolean>(settings.mapbox_3d_enabled !== false);
  const [mapboxQuality, setMapboxQuality] = useState<boolean>(settings.mapbox_quality_mode === true);
  // One chunk per engine — see components/Map/glLazy.tsx.
  const GlMapPreview = provider === 'maplibre-gl' ? GlMapPreviewMaplibre : GlMapPreviewMapbox;

  useEffect(() => {
    const nextProvider = normalizeProvider(settings.map_provider);
    setProvider(nextProvider);
    setMapTileUrl(settings.map_tile_url || '');
    setMapboxToken(settings.mapbox_access_token || '');
    setCartoKey(settings.carto_api_key || '');
    setAmapKey(settings.amap_js_api_key || '');
    setMapboxStyle(styleForProvider(nextProvider, slotStyle(nextProvider, settings)));
    setMapbox3d(settings.mapbox_3d_enabled !== false);
    setMapboxQuality(settings.mapbox_quality_mode === true);
  }, [settings]);

  const previewPlaces = useMemo(
    (): Place[] => [
      {
        id: 1,
        trip_id: 1,
        name: 'Preview',
        description: '',
        lat: PREVIEW_CENTER[0],
        lng: PREVIEW_CENTER[1],
        address: '',
        category_id: 0,
        price: null,
        image_url: null,
        google_place_id: null,
        osm_id: null,
        route_geometry: null,
        place_time: null,
        end_time: null,
        created_at: String(new Date()),
      },
    ],
    []
  );

  const saveMapSettings = async (): Promise<void> => {
    setSaving(true);
    try {
      const glStyle =
        provider === 'leaflet' ? mapboxStyle : normalizeStyleForProvider(provider as GlMapProvider, mapboxStyle);
      // Save into the active provider's own slot so the other provider's style survives.
      const stylePatch =
        provider === 'maplibre-gl' ? { maplibre_style: glStyle } : provider === 'amap' ? {} : { mapbox_style: glStyle };
      await updateSettings({
        map_provider: provider,
        map_tile_url: mapTileUrl,
        mapbox_access_token: mapboxToken,
        carto_api_key: cartoKey,
        amap_js_api_key: amapKey,
        ...stylePatch,
        mapbox_3d_enabled: mapbox3d,
        mapbox_quality_mode: mapboxQuality,
      });
      // Only mirror the normalized style into the form once it is actually persisted.
      setMapboxStyle(glStyle);
      toast.success(t('settings.toast.mapSaved'));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  // 3D is available on every style now — pure satellite uses the
  // mapbox-streets-v8 tileset as a fallback building source.
  const supports3d = true;
  const changeProvider = (nextProvider: Provider) => {
    setProvider(nextProvider);
    if (nextProvider === 'mapbox-gl' || nextProvider === 'maplibre-gl')
      setMapboxStyle(styleForProvider(nextProvider, mapboxStyle));
  };
  // Only CARTO burns a watermark into keyless tiles, so the nudge is scoped to its hosts.
  const cartoNeedsKey = mapTileUrl.includes('basemaps.cartocdn.com') && !cartoKey.trim();

  return (
    <Section title={t('settings.map')} icon={Map}>
      {/* Provider picker — big cards so the choice is obvious */}
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">{t('settings.mapProvider')}</label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <button
            type="button"
            onClick={() => changeProvider('leaflet')}
            className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
              provider === 'leaflet'
                ? 'border-slate-900 bg-slate-50 dark:border-slate-200 dark:bg-slate-800'
                : 'border-slate-200 hover:border-slate-400 dark:border-slate-700'
            }`}
          >
            <Layers size={18} className="mt-0.5 flex-shrink-0 text-slate-700 dark:text-slate-300" />
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-white">Leaflet</div>
              <div className="mt-0.5 hidden text-xs text-slate-500 sm:block">{t('settings.mapLeafletSubtitle')}</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => changeProvider('maplibre-gl')}
            className={`relative flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
              provider === 'maplibre-gl'
                ? 'border-slate-900 bg-slate-50 dark:border-slate-200 dark:bg-slate-800'
                : 'border-slate-200 hover:border-slate-400 dark:border-slate-700'
            }`}
          >
            <Globe2 size={18} className="mt-0.5 flex-shrink-0 text-slate-700 dark:text-slate-300" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-900 dark:text-white">
                <span className="sm:hidden">MapLibre</span>
                <span className="hidden sm:inline">MapLibre GL</span>
              </div>
              <div className="mt-0.5 hidden text-xs text-slate-500 sm:block">{t('settings.mapMaplibreSubtitle')}</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => changeProvider('mapbox-gl')}
            className={`relative flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
              provider === 'mapbox-gl'
                ? 'border-slate-900 bg-slate-50 dark:border-slate-200 dark:bg-slate-800'
                : 'border-slate-200 hover:border-slate-400 dark:border-slate-700'
            }`}
          >
            <Box size={18} className="mt-0.5 flex-shrink-0 text-slate-700 dark:text-slate-300" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-900 dark:text-white">Mapbox GL</div>
              <div className="mt-0.5 hidden text-xs text-slate-500 sm:block">{t('settings.mapMapboxSubtitle')}</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => changeProvider('amap')}
            className={`relative flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
              provider === 'amap'
                ? 'border-slate-900 bg-slate-50 dark:border-slate-200 dark:bg-slate-800'
                : 'border-slate-200 hover:border-slate-400 dark:border-slate-700'
            }`}
          >
            <Map size={18} className="mt-0.5 flex-shrink-0 text-slate-700 dark:text-slate-300" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-900 dark:text-white">高德地图</div>
              <div className="mt-0.5 hidden text-xs text-slate-500 sm:block">简体中文 · 在线地图</div>
            </div>
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-400">{t('settings.mapProviderHint')}</p>
      </div>

      {/* Leaflet settings */}
      {provider === 'leaflet' && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">{t('settings.mapTemplate')}</label>
          <CustomSelect
            value={mapTileUrl}
            onChange={(value: string) => {
              if (value) setMapTileUrl(value);
            }}
            placeholder={t('settings.mapTemplatePlaceholder.select')}
            options={MAP_PRESETS.map((p) => ({ value: p.url, label: p.name }))}
            size="sm"
            style={{ marginBottom: 8 }}
          />
          <input
            type="text"
            value={mapTileUrl}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMapTileUrl(e.target.value)}
            placeholder="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-slate-400"
          />
          <p className="mt-1 text-xs text-slate-400">{t('settings.mapDefaultHint')}</p>
        </div>
      )}

      {/* Same deal as the Mapbox token: a managed install brings its own key. */}
      {provider === 'leaflet' && !managed && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">{t('settings.mapCartoKey')}</label>
          <input
            type="text"
            value={cartoKey}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCartoKey(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-transparent focus:ring-2 focus:ring-slate-400"
          />
          <p className="mt-1 text-xs text-slate-400">
            {t('settings.mapCartoKeyHint')}{' '}
            <a href="https://carto.com/basemaps/apikey/" target="_blank" rel="noreferrer" className="underline">
              {t('settings.mapCartoKeyLink')}
            </a>
          </p>
          {cartoNeedsKey && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{t('settings.mapCartoKeyMissing')}</p>
          )}
        </div>
      )}

      {/* AMap settings */}
      {provider === 'amap' && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">高德地图 Web JS API Key</label>
          <input
            type="text"
            value={amapKey}
            onChange={(e) => setAmapKey(e.target.value)}
            placeholder="请输入高德地图 API Key"
            spellCheck={false}
            autoComplete="off"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-transparent focus:ring-2 focus:ring-slate-400"
          />
          <p className="mt-1 text-xs text-slate-400">
            需要在高德开放平台申请 Web JS API Key。{' '}
            <a href="https://console.amap.com/dev/key/app" target="_blank" rel="noreferrer" className="underline">
              获取 API Key
            </a>
          </p>
        </div>
      )}

      {/* GL settings */}
      {(provider === 'mapbox-gl' || provider === 'maplibre-gl') && (
        <div className="space-y-3">
          {/* The token comes with the instance on a managed install, injected when the
              settings are read. A field here would only let somebody save a worse one. */}
          {provider === 'mapbox-gl' && !managed && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">{t('settings.mapMapboxToken')}</label>
              <input
                type="text"
                value={mapboxToken}
                onChange={(e) => setMapboxToken(e.target.value)}
                placeholder="pk.eyJ1Ijoi..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-transparent focus:ring-2 focus:ring-slate-400"
              />
              <p className="mt-1 text-xs text-slate-400">
                {t('settings.mapMapboxTokenHint')}{' '}
                <a
                  href="https://account.mapbox.com/access-tokens/"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  {t('settings.mapMapboxTokenLink')}
                </a>
              </p>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">{t('settings.mapStyle')}</label>
            <div className="mb-2">
              <StyleDropdown value={mapboxStyle} provider={provider} onChange={setMapboxStyle} />
            </div>
            <input
              type="text"
              value={mapboxStyle}
              onChange={(e) => setMapboxStyle(e.target.value)}
              placeholder={defaultStyleForProvider(provider)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-transparent focus:ring-2 focus:ring-slate-400"
            />
            <p className="mt-1 text-xs text-slate-400">
              {provider === 'maplibre-gl' ? t('settings.mapOpenFreeMapStyleHint') : t('settings.mapStyleHint')}
            </p>
          </div>

          {provider === 'mapbox-gl' && (
            <>
              <div
                className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                  supports3d
                    ? 'border-slate-200 dark:border-slate-700'
                    : 'border-slate-200 opacity-60 dark:border-slate-700'
                }`}
              >
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-900 dark:text-white">
                    {t('settings.map3dBuildings')}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">{t('settings.map3dHint')}</div>
                </div>
                <ToggleSwitch
                  on={mapbox3d && supports3d}
                  onToggle={() => {
                    if (supports3d) setMapbox3d(!mapbox3d);
                  }}
                />
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex-1">
                  <div className="flex flex-col items-start gap-1 text-sm font-medium text-slate-900 dark:text-white sm:flex-row sm:items-center sm:gap-2">
                    <span className="order-2 sm:order-1">{t('settings.mapHighQuality')}</span>
                    <span className="order-1 rounded bg-amber-100 px-1.5 py-[3px] text-[9px] font-semibold uppercase leading-none tracking-wide text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 sm:order-2">
                      {t('settings.mapExperimental')}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {t('settings.mapHighQualityHint')}{' '}
                    <span className="text-amber-600 dark:text-amber-400">{t('settings.mapHighQualityWarning')}</span>
                  </div>
                </div>
                <ToggleSwitch on={mapboxQuality} onToggle={() => setMapboxQuality(!mapboxQuality)} />
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-400 dark:border-slate-700 dark:bg-slate-800">
                <strong className="text-slate-600 dark:text-slate-300">{t('settings.mapTipLabel')}</strong>{' '}
                {t('settings.mapTip')}
              </div>
            </>
          )}
        </div>
      )}

      <div>
        <div style={{ position: 'relative', inset: 0, height: '200px', width: '100%' }}>
          {provider === 'mapbox-gl' || provider === 'maplibre-gl' ? (
            /* A net of its own: the preview is the one place a user flips providers
               live, so it is the likeliest chunk to fail — and a broken preview must
               not take the rest of the settings tab with it. */
            <ErrorBoundary
              boundaryId="settings:map-preview"
              resetKeys={[provider]}
              fallback={<div className="h-full w-full bg-surface-secondary" />}
            >
              <Suspense fallback={<div className="h-full w-full animate-pulse bg-surface-secondary" />}>
                <GlMapPreview
                  provider={provider}
                  token={mapboxToken}
                  style={mapboxStyle}
                  lat={PREVIEW_CENTER[0]}
                  lng={PREVIEW_CENTER[1]}
                  // Zoom in close so the style's character (3D buildings,
                  // satellite texture, label density) is immediately visible.
                  zoom={PREVIEW_ZOOM}
                  enable3d={provider === 'mapbox-gl' && mapbox3d && supports3d}
                  quality={provider === 'mapbox-gl' && mapboxQuality}
                />
              </Suspense>
            </ErrorBoundary>
          ) : (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            React.createElement(MapView as any, {
              places: previewPlaces,
              dayPlaces: [],
              route: null,
              routeSegments: null,
              selectedPlaceId: null,
              onMarkerClick: null,
              onMapClick: null,
              onMapContextMenu: null,
              // With the key on it, or the preview resolves the template as a
              // keyless CARTO one and quietly shows the app default instead of
              // the basemap being configured. The fields hold what the user is
              // editing rather than what useTileUrl already resolved, so the key
              // has to be put back on here.
              tileUrl: withTileApiKey(mapTileUrl, cartoKey),
              fitKey: null,
              dayOrderMap: [],
              leftWidth: 0,
              rightWidth: 0,
              hasInspector: false,
            })
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={saveMapSettings}
        disabled={saving}
        className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:bg-slate-400"
      >
        {saving ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        {t('settings.saveMap')}
      </button>
    </Section>
  );
}
