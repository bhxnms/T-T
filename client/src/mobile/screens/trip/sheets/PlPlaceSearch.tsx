import { ImageOff, Loader2, Search, Star } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { mapsApi } from '../../../../api/client';
import {
  extractAmapPoiId,
  extractAmapUrl,
  isAmapShareInput,
  isGoogleMapsUrl,
} from '../../../../components/Planner/PlaceFormModal.helpers';
import { getApiErrorMessage } from '../../../../utils/apiError';
import { PlacesSession } from '../../../../utils/placesSession';
import type { TripPlanner } from '../MTripShell';
import { FIELD_CLS } from './PlSheetChrome';

/** Fields a search pick can contribute to the place form. */
export interface PlSearchPick {
  name?: string;
  address?: string;
  lat?: string;
  lng?: string;
  google_place_id?: string;
  google_ftid?: string;
  osm_id?: string;
  amap_id?: string;
  website?: string;
  phone?: string;
  /** Hero image from the picked place, when the provider supplied one. */
  image_url?: string;
}

interface Suggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
}

type MapsPlace = Record<string, unknown>;

interface PlPlaceSearchProps {
  planner: TripPlanner;
  /** Search bias derived from the trip's existing places (trip centre). */
  locationBias?: { low: { lat: number; lng: number }; high: { lat: number; lng: number } };
  onPick: (pick: PlSearchPick) => void;
  /** True while a suggestion's details are being resolved (name spinner). */
  onResolvingChange?: (resolving: boolean) => void;
  /** Search provider for this sheet — toggled in the row below the input. */
  provider?: 'amap' | 'native';
  /** Fires when the user flips the provider toggle; undefined hides the toggle. */
  onProviderChange?: (provider: 'amap' | 'native') => void;
}

/** "48.8566, 2.3522" (also ; or whitespace separated) → direct coordinates. */
const COORD_RE = /^(-?\d+(?:\.\d*)?)(?:\s*[,;]\s*|\s+)(-?\d+(?:\.\d*)?)$/;

/** First AMap result photo, with a neutral placeholder for AMap rows that have none. */
function AmapResultThumb({ photo, name }: { photo?: string; name?: string }): React.ReactElement {
  const [broken, setBroken] = useState(false);
  if (!photo || broken) {
    return (
      <div className="flex h-11 w-11 flex-none items-center justify-center rounded-[9px] bg-[color:var(--m-rowbr)] text-m-muted">
        <ImageOff size={14} aria-hidden="true" />
      </div>
    );
  }
  return (
    <img
      src={photo}
      alt={name || ''}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className="h-11 w-11 flex-none rounded-[9px] object-cover"
    />
  );
}

function placeToPick(place: MapsPlace): PlSearchPick {
  const s = (v: unknown) => (v == null ? undefined : String(v));
  return {
    name: s(place.name),
    address: s(place.address),
    lat: s(place.lat),
    lng: s(place.lng),
    google_place_id: s(place.google_place_id),
    google_ftid: s(place.google_ftid),
    osm_id: s(place.osm_id),
    amap_id: s(place.amap_id),
    website: s(place.website),
    phone: s(place.phone),
  };
}

/**
 * Search row of the place form: Google/OSM text search biased on the trip
 * centre, autocomplete dropdown, plus Google-Maps-URL and "lat, lng" paste
 * detection — the mobile counterpart of PlaceFormModal's search block.
 */
export default function PlPlaceSearch({
  planner,
  locationBias,
  onPick,
  onResolvingChange,
  provider,
  onProviderChange,
}: PlPlaceSearchProps) {
  const { t, language, toast } = planner;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MapsPlace[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // One Google billing session per search (see utils/placesSession).
  const placesSessionRef = useRef(new PlacesSession());

  const setResolving = useCallback(
    (v: boolean) => {
      setSearching(v);
      onResolvingChange?.(v);
    },
    [onResolvingChange]
  );

  const fetchSuggestions = useCallback(
    async (input: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const result = await mapsApi.autocomplete(
          input,
          language,
          locationBias,
          controller.signal,
          placesSessionRef.current.current(),
          provider
        );
        setSuggestions(result.suggestions || []);
      } catch (err: unknown) {
        // Superseded request — axios rejects an aborted call with CanceledError.
        if (err instanceof Error && err.name === 'CanceledError') return;
        setSuggestions([]);
      }
    },
    [language, locationBias, provider]
  );

  // Debounced autocomplete — URLs and coordinate pastes go to the search button.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (trimmed.length < 2 || isGoogleMapsUrl(trimmed) || COORD_RE.test(trimmed)) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(() => fetchSuggestions(trimmed), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchSuggestions]);

  const applyPlace = (place: MapsPlace) => {
    onPick(placeToPick(place));
    setResults([]);
    setSuggestions([]);
    setQuery('');
  };

  const handleSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setSuggestions([]);

    // "lat, lng" paste → straight to coordinates, no lookup needed.
    const coords = trimmed.match(COORD_RE);
    if (coords) {
      onPick({ lat: coords[1], lng: coords[2] });
      setQuery('');
      return;
    }

    setResolving(true);
    try {
      if (isGoogleMapsUrl(trimmed)) {
        const resolved = await mapsApi.resolveUrl(trimmed);
        if (resolved.lat && resolved.lng) {
          onPick({
            name: resolved.name || undefined,
            address: resolved.address || undefined,
            lat: String(resolved.lat),
            lng: String(resolved.lng),
            google_ftid: resolved.google_ftid || undefined,
          });
          setQuery('');
          toast.success(t('places.urlResolved'));
          return;
        }
      }
      // AMap share links/text resolve by POI id, so they never go to keyword search.
      if (!isGoogleMapsUrl(trimmed) && isAmapShareInput(trimmed)) {
        const amapUrl = extractAmapUrl(trimmed) ?? extractAmapPoiId(trimmed);
        if (amapUrl) {
          const resolved = await mapsApi.resolveUrl(amapUrl);
          if (resolved.lat && resolved.lng) {
            onPick({
              name: resolved.name || undefined,
              address: resolved.address || undefined,
              lat: String(resolved.lat),
              lng: String(resolved.lng),
              amap_id: resolved.amap_id || undefined,
              image_url: resolved.photos?.[0],
            });
            setQuery('');
            toast.success(t('places.urlResolved'));
            return;
          }
        }
        toast.error(t('places.amapImportFailed'));
        return;
      }
      const result = await mapsApi.search(trimmed, language, provider);
      setResults(result.places || []);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, t('places.mapsSearchError')));
    } finally {
      setResolving(false);
      placesSessionRef.current.end();
    }
  };

  const handleSelectSuggestion = async (suggestion: Suggestion) => {
    setSuggestions([]);
    const previousQuery = query;
    setQuery('');
    onPick({ name: suggestion.mainText });
    setResolving(true);
    try {
      // Details are a fragile second hop (kill-switch, Overpass load) — fall
      // back to the text-search path so suggestions never dead-end. (#1192)
      let place: MapsPlace | null = null;
      try {
        // Spends the session the suggestions opened.
        const result = await mapsApi.details(suggestion.placeId, language, placesSessionRef.current.peek());
        if (result.place && result.place.lat != null && result.place.lng != null) place = result.place;
      } catch {
        // fall through to text search
      }
      if (!place) {
        const fullQuery = [suggestion.mainText, suggestion.secondaryText].filter(Boolean).join(', ');
        const search = await mapsApi.search(fullQuery, language, provider);
        place = (search.places?.[0] as MapsPlace | undefined) ?? null;
      }
      if (place) {
        applyPlace(place);
      } else {
        setQuery(previousQuery);
        toast.error(t('places.mapsSearchError'));
      }
    } catch (err: unknown) {
      setQuery(previousQuery);
      toast.error(getApiErrorMessage(err, t('places.mapsSearchError')));
    } finally {
      setResolving(false);
      placesSessionRef.current.end();
    }
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSearch();
            }
          }}
          onBlur={() => setTimeout(() => setSuggestions([]), 150)}
          placeholder={t('places.mapsSearchPlaceholder')}
          className={`${FIELD_CLS} flex-1`}
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={searching}
          aria-label={t('common.search')}
          className="flex h-10 w-10 flex-none items-center justify-center rounded-[12px] bg-m-act text-m-actfg disabled:opacity-60"
        >
          {searching ? (
            <Loader2 size={16} strokeWidth={2.2} className="animate-spin" />
          ) : (
            <Search size={16} strokeWidth={2.2} />
          )}
        </button>
      </div>

      {onProviderChange && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[0.6875rem] text-m-muted">
          <span>{t('places.searchProvider')}</span>
          <button
            type="button"
            onClick={() => onProviderChange('amap')}
            className={`rounded-full px-2 py-[2px] ${provider === 'amap' ? 'bg-m-act text-m-actfg' : 'bg-[color:var(--m-ic)]'}`}
          >
            {t('places.searchProviderAmap')}
          </button>
          <button
            type="button"
            onClick={() => onProviderChange('native')}
            className={`rounded-full px-2 py-[2px] ${provider === 'native' ? 'bg-m-act text-m-actfg' : 'bg-[color:var(--m-ic)]'}`}
          >
            {t('places.searchProviderNative')}
          </button>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="absolute left-0 right-12 top-[calc(100%+6px)] z-10 max-h-[210px] overflow-y-auto rounded-[14px] border border-[color:var(--m-rowbr)] bg-[color:var(--m-sheetop)] shadow-[0_20px_44px_-18px_rgba(0,0,0,.45)]">
          {suggestions.map((s) => (
            <button
              key={s.placeId}
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => handleSelectSuggestion(s)}
              className="block w-full border-t border-[color:var(--m-rowbr)] px-[13px] py-[10px] text-left first:border-t-0"
            >
              <div className="truncate text-[0.8125rem] font-semibold text-m-ink">{s.mainText}</div>
              {s.secondaryText && (
                <div className="truncate font-geist text-[0.65625rem] text-m-muted">{s.secondaryText}</div>
              )}
            </button>
          ))}
        </div>
      )}

      {results.length > 0 && (
        <div className="mt-2 max-h-60 overflow-y-auto rounded-[14px] border border-[color:var(--m-rowbr)] bg-[color:var(--m-ic)]">
          {results.map((result, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => applyPlace(result)}
              className="flex w-full gap-2.5 border-t border-[color:var(--m-rowbr)] px-[13px] py-[10px] text-left first:border-t-0"
            >
              <AmapResultThumb photo={(result.photos as string[] | undefined)?.[0]} name={String(result.name ?? '')} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[0.8125rem] font-semibold text-m-ink">
                    {String(result.name ?? '')}
                  </span>
                  {result.source === 'amap' && (
                    <span className="flex-none rounded bg-[color:var(--m-ic)] px-1 py-[1px] text-[10px] text-m-muted">
                      高德
                    </span>
                  )}
                </div>
                <div className="truncate font-geist text-[0.65625rem] text-m-muted">{String(result.address ?? '')}</div>
                {result.source === 'amap' && (
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-geist text-[0.65625rem] text-m-muted">
                    {result.rating != null && (
                      <span className="flex items-center gap-0.5 text-amber-500">
                        <Star size={10} className="fill-current" aria-hidden="true" />
                        {Number(result.rating).toFixed(1)}
                        {result.rating_count ? (
                          <span className="text-m-muted">({Number(result.rating_count).toLocaleString()})</span>
                        ) : null}
                      </span>
                    )}
                    {result.amap_type && <span className="truncate">{String(result.amap_type).split(';')[0]}</span>}
                    {result.open_time && <span className="truncate">{String(result.open_time)}</span>}
                    {result.phone && <span className="truncate">{String(result.phone)}</span>}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
