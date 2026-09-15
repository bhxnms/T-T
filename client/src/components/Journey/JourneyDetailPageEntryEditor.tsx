import { Camera, Check, Image, Locate, MapPin, Minus, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { addonsApi, journeyApi, mapsApi, memoriesApi } from '../../api/client';
import { getCurrentPositionOnce } from '../../hooks/useGeolocation';
import { useTranslation } from '../../i18n';
import { MOOD_CONFIG, WEATHER_CONFIG } from '../../pages/journeyDetail/JourneyDetailPage.constants';
import { geoOnceErrorKey, isValidGeoPoint, photoUrl } from '../../pages/journeyDetail/JourneyDetailPage.helpers';
import type { GalleryPhoto, JourneyEntry, JourneyPhoto, JourneyTrip } from '../../store/journeyStore';
import { getApiErrorMessage } from '../../types';
import { normalizeImageFiles } from '../../utils/convertHeic';
import { localIsoDate } from '../../utils/localDate';
import { type ResilientResult, type UploadProgress } from '../../utils/uploadQueue';
import ToggleSwitch from '../Settings/ToggleSwitch';
import CustomTimePicker from '../shared/CustomTimePicker';
import { useToast } from '../shared/Toast';
import { DatePicker } from './JourneyDetailPageDatePicker';
import { ProviderPicker, type ProviderPhotoGroup } from './JourneyDetailPageProviderPicker';
import MarkdownToolbar from './MarkdownToolbar';

type PendingProviderGroup = ProviderPhotoGroup & { provider: string };

export function EntryEditor({
  entry,
  journeyId,
  tripDates,
  galleryPhotos,
  trips,
  userId = 0,
  onClose,
  onSave,
  onUploadPhotos,
  onAddProviderPhotos,
  onDone,
}: {
  entry: JourneyEntry;
  journeyId: number;
  tripDates: Set<string>;
  galleryPhotos: GalleryPhoto[];
  trips: JourneyTrip[];
  userId?: number;
  onClose: () => void;
  onSave: (data: Record<string, unknown>, existingEntryId?: number) => Promise<number>;
  onUploadPhotos: (
    entryId: number,
    files: File[],
    cbs?: { onProgress?: (p: UploadProgress) => void }
  ) => Promise<ResilientResult<JourneyPhoto>>;
  onAddProviderPhotos?: (entryId: number, group: PendingProviderGroup) => Promise<void>;
  onDone: () => void;
}) {
  const { t, language } = useTranslation();
  const toast = useToast();
  const [title, setTitle] = useState(entry.title || '');
  const [story, setStory] = useState(entry.story || '');
  const [entryDate, setEntryDate] = useState(entry.entry_date || localIsoDate());
  const [entryTime, setEntryTime] = useState(entry.entry_time?.slice(0, 5) || '');
  const [locationName, setLocationName] = useState(entry.location_name || '');
  const [locationLat, setLocationLat] = useState<number | null>(entry.location_lat ?? null);
  const [locationLng, setLocationLng] = useState<number | null>(entry.location_lng ?? null);
  const [locationQuery, setLocationQuery] = useState('');
  const [locationResults, setLocationResults] = useState<
    { name: string; address?: string; lat: number; lng: number }[]
  >([]);
  const [locationSearching, setLocationSearching] = useState(false);
  const [showLocationResults, setShowLocationResults] = useState(false);
  const [locating, setLocating] = useState(false);
  const locationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mood, setMood] = useState(entry.mood || '');
  const [weather, setWeather] = useState(entry.weather || '');
  const [statsExcluded, setStatsExcluded] = useState(entry.stats_excluded ?? false);
  const [pros, setPros] = useState<string[]>(entry.pros_cons?.pros?.length ? entry.pros_cons.pros : ['']);
  const [cons, setCons] = useState<string[]>(entry.pros_cons?.cons?.length ? entry.pros_cons.cons : ['']);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [photos, setPhotos] = useState<(JourneyPhoto | GalleryPhoto)[]>(entry.photos || []);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  // Minting the preview URL inline in the JSX would hand out a fresh blob on
  // every keystroke in the story field and never give one back.
  const pendingUrls = useMemo(() => pendingFiles.map((f) => URL.createObjectURL(f)), [pendingFiles]);
  useEffect(
    () => () => {
      pendingUrls.forEach((u) => URL.revokeObjectURL(u));
    },
    [pendingUrls]
  );
  const [pendingLinkIds, setPendingLinkIds] = useState<number[]>([]);
  const [showGalleryPick, setShowGalleryPick] = useState(false);
  const [photoTab, setPhotoTab] = useState<'upload' | 'gallery' | 'external'>('upload');
  const [availableProviders, setAvailableProviders] = useState<{ id: string; name: string }[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [externalProvider, setExternalProvider] = useState<string | null>(null);
  const [pendingProviderGroups, setPendingProviderGroups] = useState<PendingProviderGroup[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  // Own input: putting `capture` on the picker above would take the photo library
  // away on a phone, which is the more common way in. This one only ever opens the
  // camera, so tablets and laptops get the same route the phone sheet already has.
  const cameraRef = useRef<HTMLInputElement>(null);
  const storyRef = useRef<HTMLTextAreaElement>(null);
  const persistedEntryIdRef = useRef<number | null>(entry.id > 0 ? entry.id : null);

  // Track which fields differ from the entry we started editing so we can
  // warn before discarding on close/cancel.
  const originalPros = (entry.pros_cons?.pros ?? []).join('\n');
  const originalCons = (entry.pros_cons?.cons ?? []).join('\n');
  const isDirty =
    title !== (entry.title || '') ||
    story !== (entry.story || '') ||
    entryDate !== (entry.entry_date || localIsoDate()) ||
    entryTime !== (entry.entry_time?.slice(0, 5) || '') ||
    locationName !== (entry.location_name || '') ||
    (locationLat ?? null) !== (entry.location_lat ?? null) ||
    (locationLng ?? null) !== (entry.location_lng ?? null) ||
    mood !== (entry.mood || '') ||
    weather !== (entry.weather || '') ||
    statsExcluded !== (entry.stats_excluded ?? false) ||
    pros.filter((p) => p.trim()).join('\n') !== originalPros ||
    cons.filter((c) => c.trim()).join('\n') !== originalCons ||
    pendingFiles.length > 0 ||
    pendingLinkIds.length > 0 ||
    pendingProviderGroups.length > 0;

  const availableGalleryPhotos = galleryPhotos.filter((gp) => !photos.some((p) => p.id === gp.id));

  useEffect(() => {
    if (photoTab !== 'external' || availableProviders.length > 0 || providersLoading) return;
    setProvidersLoading(true);
    // The discovery is not tied to the open tab, so the result is applied even if
    // the user left the tab meanwhile — dropping it would leave providersLoading
    // stuck and block every later run of this effect.
    (async () => {
      try {
        const addonsData = await addonsApi.enabled();
        const enabled = (addonsData.addons || []).filter((a: any) => a.type === 'photo_provider' && a.enabled);
        const connected: { id: string; name: string }[] = [];
        for (const provider of enabled) {
          try {
            if ((await memoriesApi.status(provider.id)).connected)
              connected.push({ id: provider.id, name: provider.name });
          } catch {}
        }
        setAvailableProviders(connected);
        if (connected.length > 0) setExternalProvider((current) => current || connected[0].id);
      } catch {}
      setProvidersLoading(false);
    })();
  }, [photoTab, availableProviders.length]);

  const activeExternalProvider = externalProvider || availableProviders[0]?.id || null;
  const providerExistingAssetIds = new Set<string>();
  if (activeExternalProvider) {
    photos.forEach((photo) => {
      if (photo.provider === activeExternalProvider && photo.asset_id) providerExistingAssetIds.add(photo.asset_id);
    });
    pendingProviderGroups.forEach((group) => {
      if (group.provider === activeExternalProvider)
        group.assetIds.forEach((assetId) => providerExistingAssetIds.add(assetId));
    });
  }

  const handleClose = () => {
    if (isDirty && !window.confirm(t('journey.editor.discardChangesConfirm'))) return;
    onClose();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const entryId = await onSave(
        {
          title: title || null,
          story: story || null,
          entry_date: entryDate,
          entry_time: entryTime || null,
          location_name: locationName || null,
          location_lat: locationLat,
          location_lng: locationLng,
          stats_excluded: offersStatsToggle ? statsExcluded : undefined,
          mood: mood || null,
          weather: weather || null,
          pros_cons: { pros: pros.filter((p) => p.trim()), cons: cons.filter((c) => c.trim()) },
          // An explicit Save is the user saying this suggestion is now their entry —
          // it does not need a story to earn that (#2008).
          type: entry.type === 'skeleton' ? 'entry' : undefined,
        },
        persistedEntryIdRef.current ?? undefined
      );
      if (entryId > 0) persistedEntryIdRef.current = entryId;
      // upload queued files after entry is created
      if (pendingFiles.length > 0 && entryId) {
        const filesToUpload = pendingFiles;
        setUploadProgress({ done: 0, total: filesToUpload.length });
        try {
          const { failed } = await onUploadPhotos(entryId, filesToUpload, {
            onProgress: (p) => setUploadProgress({ done: p.done, total: p.total }),
          });
          setPendingFiles(failed);
          if (failed.length > 0) {
            toast.error(
              t('journey.editor.uploadPartialFailed', {
                failed: String(failed.length),
                total: String(filesToUpload.length),
              })
            );
          }
        } catch (err) {
          toast.error(getApiErrorMessage(err, t('journey.editor.uploadFailed')));
        } finally {
          setUploadProgress(null);
        }
      }
      // link gallery photos that were picked before save
      if (pendingLinkIds.length > 0 && entryId) {
        for (const photoId of pendingLinkIds) {
          try {
            await journeyApi.linkPhoto(entryId, photoId);
          } catch {}
        }
      }
      if (pendingProviderGroups.length > 0 && entryId && onAddProviderPhotos) {
        const failed: PendingProviderGroup[] = [];
        for (const group of pendingProviderGroups) {
          try {
            await onAddProviderPhotos(entryId, group);
          } catch {
            failed.push(group);
          }
        }
        if (failed.length > 0) {
          setPendingProviderGroups(failed);
          toast.error(
            t('journey.editor.externalPhotosPartialFailed', {
              failed: String(failed.length),
              total: String(pendingProviderGroups.length),
            })
          );
          return;
        }
        setPendingProviderGroups([]);
      }
      onDone();
    } catch (err) {
      // Neither the page callback nor journeyStore toasts, so without this the
      // whole entry just fails to save with no sign of it.
      toast.error(getApiErrorMessage(err, t('journey.settings.saveFailed')));
      return;
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    // Queue files locally until Save so cancel/close actually discards. This
    // keeps photo behavior consistent with text fields — no silent persistence.
    const normalized = await normalizeImageFiles(files);
    setPendingFiles((prev) => [...prev, ...normalized]);
  };

  const contextLocation = isValidGeoPoint({ lat: locationLat ?? Number.NaN, lng: locationLng ?? Number.NaN })
    ? { lat: locationLat!, lng: locationLng!, name: locationName || undefined }
    : null;

  // The route switch belongs to an entry that is a stop, or was one: an entry
  // without a point was never on the route, and a new one is not on it yet.
  const offersStatsToggle = entry.id > 0 && (contextLocation != null || !!entry.stats_excluded);

  const handleUseCurrentLocation = async () => {
    if (locating) return;
    setLocating(true);
    try {
      const pos = await getCurrentPositionOnce();
      // Fill coordinates right away; the name is refined below once the
      // reverse geocode comes back.
      const fallbackName = `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`;
      if (locationTimerRef.current) clearTimeout(locationTimerRef.current);
      setLocationSearching(false);
      setLocationLat(pos.lat);
      setLocationLng(pos.lng);
      setLocationName(fallbackName);
      setLocationQuery('');
      setLocationResults([]);
      setShowLocationResults(false);
      try {
        const data = await mapsApi.reverse(pos.lat, pos.lng, language);
        const name = data.name || data.address;
        // Only replace the coordinate fallback — don't clobber a search
        // result the user may have picked while the reverse call was in flight.
        if (name) setLocationName((prev) => (prev === fallbackName ? name : prev));
      } catch {
        /* best effort — keep the coordinate fallback */
      }
    } catch (err) {
      toast.error(t(geoOnceErrorKey(err)));
    } finally {
      setLocating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999]"
      style={{ background: 'rgba(9,9,11,0.6)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
    >
      {/* The modal itself is constrained to the feed column on desktop so it
          centers there — but the backdrop stays full-width (covering the map
          too) for a uniform dim/blur across the whole page. */}
      <div className="absolute inset-0 flex items-end sm:items-center sm:justify-center sm:p-5">
        <div
          className="flex h-full w-full flex-col overflow-hidden rounded-t-[24px] bg-white shadow-[0_20px_40px_rgba(0,0,0,0.2)] dark:bg-zinc-900 sm:h-auto sm:max-h-[90vh] sm:max-w-[1040px] sm:rounded-[24px]"
          style={{ paddingBottom: 'var(--bottom-nav-h)' }}
        >
          <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-700">
            <h2 className="text-[16px] font-bold text-zinc-900 dark:text-white">
              {entry.id === 0 ? t('journey.detail.newEntry') : t('journey.detail.editEntry')}
            </h2>
            <button
              type="button"
              onClick={handleClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <X size={16} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="grid grid-cols-1 items-stretch gap-x-6 gap-y-4 md:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-4">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('journey.editor.titlePlaceholder')}
                  className="w-full border-0 border-b border-transparent bg-transparent pb-2 text-[20px] font-medium text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-300 dark:text-white dark:focus:border-zinc-600"
                />

                <div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                    onClick={(e) => {
                      (e.target as HTMLInputElement).value = '';
                    }}
                    className="hidden"
                  />
                  <input
                    ref={cameraRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileChange}
                    onClick={(e) => {
                      (e.target as HTMLInputElement).value = '';
                    }}
                    className="hidden"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoTab('upload');
                        setShowGalleryPick(false);
                        fileRef.current?.click();
                      }}
                      disabled={saving}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-200 py-4 text-[12px] text-zinc-500 hover:border-zinc-400 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:border-zinc-500 dark:hover:bg-zinc-800"
                    >
                      {uploadProgress ? (
                        <>
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />{' '}
                          {t('journey.editor.uploadingProgress', {
                            done: String(uploadProgress.done),
                            total: String(uploadProgress.total),
                          })}
                        </>
                      ) : (
                        <>
                          <Plus size={13} /> {t('journey.editor.uploadPhotos')}
                        </>
                      )}
                    </button>
                    {galleryPhotos.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoTab('gallery');
                          setShowGalleryPick(!showGalleryPick);
                        }}
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-4 text-[12px] text-zinc-500 ${
                          showGalleryPick
                            ? 'border-zinc-900 bg-zinc-50 dark:border-white dark:bg-zinc-800'
                            : 'border-dashed border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:border-zinc-500 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <Image size={13} /> {t('journey.editor.fromGallery')}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoTab('upload');
                        setShowGalleryPick(false);
                        cameraRef.current?.click();
                      }}
                      disabled={saving}
                      aria-label={t('journey.photo.add')}
                      title={t('journey.photo.add')}
                      className="flex items-center justify-center rounded-xl border border-dashed border-zinc-200 px-4 text-[12px] text-zinc-500 hover:border-zinc-400 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:border-zinc-500 dark:hover:bg-zinc-800"
                    >
                      <Camera size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoTab('external');
                        setShowGalleryPick(false);
                      }}
                      disabled={saving}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-4 text-[12px] text-zinc-500 ${
                        photoTab === 'external'
                          ? 'border-zinc-900 bg-zinc-50 dark:border-white dark:bg-zinc-800'
                          : 'border-dashed border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:border-zinc-500 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <Image size={13} /> {t('journey.editor.externalPhotos') || 'External photos'}
                    </button>
                  </div>

                  {/* Gallery picker — directly below buttons. Safari collapses
                `aspect-square` items inside an overflow-scroll grid, so
                the square is enforced with a padding-top spacer + an
                absolutely positioned image (works across all browsers). */}
                  {showGalleryPick && (
                    <div className="mt-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
                      <div className="grid max-h-[160px] grid-cols-5 gap-1.5 overflow-y-auto sm:grid-cols-6">
                        {availableGalleryPhotos.map((gp) => (
                          <button
                            type="button"
                            key={gp.id}
                            aria-label={t('journey.editor.fromGallery')}
                            onClick={async () => {
                              if (entry.id > 0) {
                                try {
                                  const linked = await journeyApi.linkPhoto(entry.id, gp.id);
                                  if (linked) setPhotos((prev) => [...prev, linked]);
                                } catch {}
                              } else {
                                setPendingLinkIds((prev) => [...prev, gp.id]);
                                setPhotos((prev) => [...prev, gp]);
                              }
                            }}
                            className="relative block w-full cursor-pointer overflow-hidden rounded-xl border-0 bg-transparent p-0 transition-all hover:ring-2 hover:ring-zinc-900 hover:ring-offset-1 dark:hover:ring-white dark:hover:ring-offset-zinc-900"
                            style={{ paddingTop: '100%' }}
                          >
                            <img
                              src={photoUrl(gp)}
                              alt=""
                              className="absolute inset-0 h-full w-full object-cover"
                              loading="lazy"
                              onError={(e) => {
                                const img = e.currentTarget;
                                const orig = photoUrl(gp, 'original');
                                if (!img.src.includes('/original')) img.src = orig;
                              }}
                            />
                          </button>
                        ))}
                        {availableGalleryPhotos.length === 0 && (
                          <div className="col-span-full py-3 text-center text-[11px] text-zinc-400">
                            {t('journey.editor.allPhotosAdded')}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {photoTab === 'external' && (
                    <div
                      className="mt-2 flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50"
                      style={{ height: 'min(56vh, 520px)' }}
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-3 py-2 dark:border-zinc-700">
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-semibold text-zinc-700 dark:text-zinc-200">
                            {t('journey.editor.externalPhotosFor', {
                              date: new Date(entryDate + 'T00:00:00').toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              }),
                            })}
                          </p>
                          <p className="truncate text-[10px] text-zinc-400">
                            {contextLocation?.name
                              ? `${t('journey.editor.externalPhotosNearby') || 'Nearby photos first'} · ${contextLocation.name}`
                              : t('journey.editor.externalPhotosNoLocation') || 'All photos from this day'}
                          </p>
                        </div>
                        {pendingProviderGroups.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setPendingProviderGroups([])}
                            className="whitespace-nowrap text-[10px] text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                          >
                            {pendingProviderGroups.reduce((sum, group) => sum + group.assetIds.length, 0)}{' '}
                            {t('journey.editor.externalPhotosQueued') || 'queued'} · {t('common.clear') || 'Clear'}
                          </button>
                        )}
                      </div>
                      {providersLoading ? (
                        <div className="flex justify-center py-8">
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700" />
                        </div>
                      ) : availableProviders.length === 0 ? (
                        <div className="px-4 py-10 text-center text-[12px] text-zinc-500">
                          {t('journey.editor.externalPhotosUnavailable') ||
                            'No connected photo providers are available.'}
                        </div>
                      ) : (
                        <div className="flex h-full min-h-0 flex-col">
                          <div className="flex gap-1 overflow-x-auto border-b border-zinc-200 px-3 py-2 dark:border-zinc-700">
                            {availableProviders.map((provider) => (
                              <button
                                type="button"
                                key={provider.id}
                                data-testid={`journey-external-provider-${provider.id}`}
                                onClick={() => setExternalProvider(provider.id)}
                                className={`whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] font-medium ${externalProvider === provider.id ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700'}`}
                              >
                                {provider.name}
                              </button>
                            ))}
                          </div>
                          {activeExternalProvider && (
                            <div className="min-h-0 flex-1">
                              <ProviderPicker
                                key={`${activeExternalProvider}-${entryDate}`}
                                provider={activeExternalProvider}
                                userId={userId}
                                entries={[entry]}
                                trips={trips}
                                existingAssetIds={providerExistingAssetIds}
                                initialDate={entryDate}
                                contextLocation={contextLocation}
                                initialEntryId={entry.id || null}
                                embedded
                                onClose={() => setExternalProvider(null)}
                                onAdd={async (groups) => {
                                  setPendingProviderGroups((previous) => {
                                    const next = [...previous];
                                    for (const group of groups) {
                                      const existing = next.find(
                                        (item) =>
                                          item.provider === activeExternalProvider &&
                                          item.passphrase === group.passphrase
                                      );
                                      if (existing) {
                                        const seen = new Set(existing.assetIds);
                                        group.assetIds.forEach((assetId, index) => {
                                          if (seen.has(assetId)) return;
                                          seen.add(assetId);
                                          existing.assetIds.push(assetId);
                                          existing.mediaTypes?.push(group.mediaTypes?.[index] || 'image');
                                        });
                                      } else {
                                        next.push({ ...group, provider: activeExternalProvider });
                                      }
                                    }
                                    return next;
                                  });
                                  setExternalProvider(null);
                                }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {(photos.length > 0 || pendingFiles.length > 0) && (
                    <div className="mt-3">
                      <div className="flex flex-wrap gap-2">
                        {photos.map((p, idx) => (
                          <div
                            key={p.id}
                            className={`group relative h-20 w-20 overflow-hidden rounded-xl ${idx === 0 && photos.length > 1 ? 'ring-2 ring-zinc-900 ring-offset-1 dark:ring-white dark:ring-offset-zinc-900' : ''}`}
                          >
                            <img
                              src={photoUrl(p)}
                              className="h-full w-full object-cover"
                              alt=""
                              onError={(e) => {
                                const img = e.currentTarget;
                                const orig = photoUrl(p, 'original');
                                if (!img.src.includes('/original')) img.src = orig;
                              }}
                            />
                            {idx === 0 && photos.length > 1 && (
                              <span className="absolute bottom-0.5 left-0.5 rounded bg-zinc-900/70 px-1 py-px text-[8px] font-bold text-white">
                                {t('journey.editor.photoFirst')}
                              </span>
                            )}
                            {idx > 0 && photos.length > 1 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const prevOrder = photos;
                                  const next = [...photos];
                                  const [moved] = next.splice(idx, 1);
                                  next.unshift(moved);
                                  setPhotos(next);
                                  // The order is shared: other members, the share view and the
                                  // PDF all read it, so a rejected write has to go back. Every
                                  // write is awaited first — snapping back on the first
                                  // rejection would do it while the rest are still landing.
                                  void (async () => {
                                    const results = await Promise.allSettled(
                                      next.map((ph, i) => journeyApi.updatePhoto(ph.id, { sort_order: i }))
                                    );
                                    const rejected = results.filter(
                                      (r) => r.status === 'rejected'
                                    ) as PromiseRejectedResult[];
                                    if (rejected.length === 0) return;
                                    toast.error(getApiErrorMessage(rejected[0].reason, t('common.error')));
                                    // Only a run where nothing landed can be put back: with a
                                    // partial one the server already holds part of the new
                                    // order, and hiding that would be the worse lie.
                                    if (rejected.length === results.length) setPhotos(prevOrder);
                                  })();
                                }}
                                className="absolute bottom-0.5 left-0.5 rounded bg-black/60 px-1.5 py-0.5 text-[8px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100"
                              >
                                {t('journey.editor.makeFirst')}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                setPhotos((prev) => prev.filter((x) => x.id !== p.id));
                                if (entry.id > 0) {
                                  // unlink from entry; gallery row is preserved
                                  try {
                                    await journeyApi.unlinkPhoto(entry.id, p.id);
                                  } catch {}
                                } else {
                                  setPendingLinkIds((prev) => prev.filter((id) => id !== p.id));
                                }
                              }}
                              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                        {pendingFiles.map((f, i) => (
                          <div key={`pending-${i}`} className="group relative h-20 w-20 overflow-hidden rounded-xl">
                            <img src={pendingUrls[i]} className="h-full w-full object-cover" alt="" />
                            <button
                              type="button"
                              onClick={() => setPendingFiles((prev) => prev.filter((_, j) => j !== i))}
                              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex min-h-[220px] flex-1 flex-col overflow-hidden rounded-xl border border-zinc-200 focus-within:border-zinc-400 dark:border-zinc-700 dark:focus-within:border-zinc-500">
                  <MarkdownToolbar textareaRef={storyRef} onUpdate={setStory} />
                  <textarea
                    ref={storyRef}
                    value={story}
                    onChange={(e) => setStory(e.target.value)}
                    placeholder={t('journey.editor.writeStory')}
                    rows={6}
                    style={{ minHeight: '144px' }}
                    className="w-full flex-1 resize-none border-0 bg-white px-3 py-2.5 text-[14px] text-zinc-900 outline-none dark:bg-zinc-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex min-w-0 flex-col gap-4">
                {/* Pros & Cons */}
                <div className="rounded-2xl bg-zinc-50 p-5 dark:bg-zinc-800/50">
                  <div className="mb-4">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                      {t('journey.editor.prosCons')}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Pros */}
                    <div>
                      <div className="mb-2.5 flex items-center gap-[7px]">
                        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                          <Check size={9} className="text-green-700 dark:text-green-400" strokeWidth={3.5} />
                        </div>
                        <span className="text-[12px] font-semibold text-green-700 dark:text-green-400">
                          {t('journey.editor.pros')}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {pros.map((p, i) => (
                          <div
                            key={i}
                            className="flex h-9 items-center gap-2 rounded-[10px] border border-zinc-200 px-3 dark:border-zinc-700"
                          >
                            <span className="h-[5px] w-[5px] flex-shrink-0 rounded-full bg-green-500" />
                            <input
                              value={p}
                              onChange={(e) => {
                                const next = [...pros];
                                next[i] = e.target.value;
                                setPros(next);
                              }}
                              placeholder={t('journey.editor.proPlaceholder')}
                              className="min-w-0 flex-1 border-none bg-transparent text-[13px] text-zinc-900 outline-none placeholder:text-green-400 dark:text-zinc-100 dark:placeholder:text-green-600"
                            />
                            {pros.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setPros(pros.filter((_, j) => j !== i))}
                                className="flex-shrink-0 p-1 text-green-300 hover:text-green-600 dark:text-green-700 dark:hover:text-green-400"
                              >
                                <X size={13} strokeWidth={2.5} />
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => setPros([...pros, ''])}
                          className="flex h-9 w-full items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-green-200 text-[12px] font-medium text-green-700 transition-colors hover:border-green-300 dark:border-green-800/40 dark:text-green-400 dark:hover:border-green-700"
                        >
                          <Plus size={13} strokeWidth={2.5} /> {t('journey.editor.addAnother')}
                        </button>
                      </div>
                    </div>

                    {/* Cons */}
                    <div>
                      <div className="mb-2.5 flex items-center gap-[7px]">
                        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                          <Minus size={9} className="text-red-700 dark:text-red-400" strokeWidth={3.5} />
                        </div>
                        <span className="text-[12px] font-semibold text-red-700 dark:text-red-400">
                          {t('journey.editor.cons')}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {cons.map((c, i) => (
                          <div
                            key={i}
                            className="flex h-9 items-center gap-2 rounded-[10px] border border-zinc-200 px-3 dark:border-zinc-700"
                          >
                            <span className="h-[5px] w-[5px] flex-shrink-0 rounded-full bg-red-500" />
                            <input
                              value={c}
                              onChange={(e) => {
                                const next = [...cons];
                                next[i] = e.target.value;
                                setCons(next);
                              }}
                              placeholder={t('journey.editor.conPlaceholder')}
                              className="min-w-0 flex-1 border-none bg-transparent text-[13px] text-zinc-900 outline-none placeholder:text-red-400 dark:text-zinc-100 dark:placeholder:text-red-600"
                            />
                            {cons.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setCons(cons.filter((_, j) => j !== i))}
                                className="flex-shrink-0 p-1 text-red-300 hover:text-red-600 dark:text-red-700 dark:hover:text-red-400"
                              >
                                <X size={13} strokeWidth={2.5} />
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => setCons([...cons, ''])}
                          className="flex h-9 w-full items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-red-200 text-[12px] font-medium text-red-700 transition-colors hover:border-red-300 dark:border-red-800/40 dark:text-red-400 dark:hover:border-red-700"
                        >
                          <Plus size={13} strokeWidth={2.5} /> {t('journey.editor.addAnother')}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Time sat in state and went to the server, it just had no input here — so a
                draft's auto-stamped clock time showed up in the timeline, the map, the PDF
                and the public share, and the desktop had no way to correct it (#1614). */}
                  {/* 136px, not 104: the custom picker adds a clock button and, in 12h,
                shows "2:30 PM" where the native input showed a fixed-width HH:MM. */}
                  <div className="grid grid-cols-[1fr_136px] gap-2">
                    <div>
                      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                        {t('journey.editor.date')}
                      </label>
                      <DatePicker value={entryDate} onChange={setEntryDate} tripDates={tripDates} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                        {t('mobileJourney.time')}
                      </label>
                      {/* A native <input type="time"> paints 12h or 24h from the browser
                    locale, and no attribute overrides it — so it ignored the user's
                    setting outright (#2067). The rest of TREK has used this picker
                    for exactly that reason; the journey editor was never migrated. */}
                      <CustomTimePicker value={entryTime} onChange={setEntryTime} />
                    </div>
                  </div>
                  <div className="relative">
                    <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                      {t('journey.editor.location')}
                    </label>
                    <div className="relative">
                      <input
                        value={locationQuery || locationName}
                        onChange={(e) => {
                          const q = e.target.value;
                          setLocationQuery(q);
                          setShowLocationResults(true);
                          if (locationTimerRef.current) clearTimeout(locationTimerRef.current);
                          if (q.trim().length >= 2) {
                            locationTimerRef.current = setTimeout(async () => {
                              setLocationSearching(true);
                              try {
                                const res = await mapsApi.search(q);
                                setLocationResults(
                                  (res.places || []).slice(0, 6).map((p: any) => ({
                                    name: p.name,
                                    address: p.address,
                                    lat: Number(p.lat),
                                    lng: Number(p.lng),
                                  }))
                                );
                              } catch {
                                setLocationResults([]);
                              } finally {
                                setLocationSearching(false);
                              }
                            }, 400);
                          } else {
                            setLocationResults([]);
                          }
                        }}
                        onFocus={() => {
                          if (locationResults.length > 0) setShowLocationResults(true);
                        }}
                        placeholder={t('journey.editor.searchLocation')}
                        className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-3 pr-9 text-[13px] text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-zinc-500"
                      />
                      <button
                        type="button"
                        onClick={handleUseCurrentLocation}
                        disabled={locating}
                        title={t('journey.editor.useCurrentLocation')}
                        aria-label={t('journey.editor.useCurrentLocation')}
                        className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                      >
                        {locating ? (
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
                        ) : (
                          <Locate size={14} />
                        )}
                      </button>
                    </div>
                    {showLocationResults && locationResults.length > 0 && (
                      <>
                        <div
                          role="presentation"
                          className="fixed inset-0 z-[99]"
                          onClick={() => setShowLocationResults(false)}
                        />
                        <div className="absolute left-0 right-0 top-full z-[100] mt-1 max-h-[240px] overflow-hidden overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                          {locationResults.map((r, i) => (
                            <button
                              type="button"
                              key={i}
                              onClick={() => {
                                setLocationName(r.name);
                                setLocationLat(r.lat);
                                setLocationLng(r.lng);
                                setLocationQuery('');
                                setShowLocationResults(false);
                                setLocationResults([]);
                              }}
                              className="flex w-full items-start gap-2.5 border-b border-zinc-100 px-3 py-2.5 text-left last:border-0 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-700"
                            >
                              <MapPin size={13} className="mt-0.5 flex-shrink-0 text-zinc-400" />
                              <div className="min-w-0">
                                <div className="truncate text-[13px] font-medium text-zinc-900 dark:text-white">
                                  {r.name}
                                </div>
                                {r.address && <div className="truncate text-[11px] text-zinc-500">{r.address}</div>}
                              </div>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                    {locationSearching && (
                      <div className="absolute left-0 right-0 top-full z-[100] mt-1 rounded-xl border border-zinc-200 bg-white px-3 py-3 text-center text-[12px] text-zinc-400 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                        {t('journey.editor.searching')}
                      </div>
                    )}
                  </div>
                </div>

                {/* Every located entry is a stop on the route Studio prints, the home
              airport included. This is the entry's own way off it, the same
              switch the Studio travel panel offers (#2064). */}
                {offersStatsToggle && (
                  <div className="flex items-center gap-3 rounded-xl border border-zinc-200 px-3 py-2.5 dark:border-zinc-700">
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-semibold text-zinc-900 dark:text-white">
                        {t('journey.editor.statsExcluded')}
                      </div>
                      <div className="mt-0.5 text-[11px] leading-snug text-zinc-500">
                        {t('journey.editor.statsExcludedHint')}
                      </div>
                    </div>
                    <ToggleSwitch
                      on={statsExcluded}
                      onToggle={() => setStatsExcluded((v) => !v)}
                      label={t('journey.editor.statsExcluded')}
                    />
                  </div>
                )}

                <div>
                  <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                    {t('journey.editor.mood')}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(MOOD_CONFIG).map(([key, config]) => {
                      const Icon = config.icon;
                      const active = mood === key;
                      return (
                        <button
                          type="button"
                          key={key}
                          onClick={() => setMood(active ? '' : key)}
                          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-all ${
                            active ? '' : 'border-zinc-200 text-zinc-500 dark:border-zinc-700'
                          }`}
                          style={
                            active
                              ? { background: config.bg, color: config.text, borderColor: config.text + '30' }
                              : undefined
                          }
                        >
                          <Icon size={12} />
                          {t(config.label)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                    {t('journey.editor.weather')}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(WEATHER_CONFIG).map(([key, config]) => {
                      const Icon = config.icon;
                      const active = weather === key;
                      return (
                        <button
                          type="button"
                          key={key}
                          onClick={() => setWeather(active ? '' : key)}
                          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-all ${
                            active
                              ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900'
                              : 'border-zinc-200 text-zinc-500 hover:border-zinc-400 dark:border-zinc-700'
                          }`}
                        >
                          <Icon size={12} />
                          {t(config.label)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            className="flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-6 py-4 dark:border-zinc-700 dark:bg-zinc-800/50"
            style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))' }}
          >
            <button
              type="button"
              onClick={handleClose}
              className="flex h-10 items-center rounded-full border border-zinc-200 px-4 text-[13px] font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex h-10 items-center rounded-full bg-zinc-900 px-5 text-[13px] font-semibold text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
            >
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
