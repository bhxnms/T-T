import type { Trip, TripCreateRequest } from '@trek/shared';
import { Archive, ArchiveRestore, Camera, FileUp, Search, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { tripsApi, type TrekImportTripSummary } from '../../../api/client';
import { currenciesWith, SYMBOLS } from '../../../components/Budget/BudgetPanel.constants';
import { CustomDatePicker } from '../../../components/shared/CustomDateTimePicker';
import CustomSelect from '../../../components/shared/CustomSelect';
import { useToast } from '../../../components/shared/Toast';
import { useTranslation } from '../../../i18n';
import type { DashboardTrip } from '../../../pages/dashboard/dashboardModel';
import { useCanDo } from '../../../store/permissionsStore';
import { useSettingsStore } from '../../../store/settingsStore';
import { getApiErrorMessage } from '../../../types';
import { normalizeImageFile } from '../../../utils/convertHeic';
import MIconBtn from '../../components/MIconBtn';
import MListRow from '../../components/MListRow';
import MSheet from '../../components/MSheet';

interface CoverSearchPhoto {
  id: string;
  url: string;
  thumb: string;
  description?: string | null;
  photographer?: string | null;
}

interface MNewTripSheetProps {
  open: boolean;
  /** null = create, otherwise edit */
  trip: DashboardTrip | null;
  onClose: () => void;
  onSave: (data: TripCreateRequest) => Promise<{ trip?: Trip } | void> | void;
  onCoverUpdate?: (tripId: number, coverUrl: string | null) => void;
  /** Edit mode only: archives (or restores) the trip — the grid cards have no archive button. */
  onArchive?: () => void;
  /** Fired after trips were imported from a TREK backup, so the grid refreshes. */
  onImported?: () => void;
}

function FieldLabel({ children }: { children: React.ReactNode }): React.ReactElement {
  return <div className="font-geist text-[0.5625rem] font-bold uppercase tracking-[.1em] text-m-faint">{children}</div>;
}

/**
 * Create/edit trip sheet — the mobile counterpart of TripFormModal's core flow:
 * title, date range and Unsplash cover search (plus device upload). Archiving
 * lives here in edit mode, as decided for the grid cards.
 */
export default function MNewTripSheet({
  open,
  trip,
  onClose,
  onSave,
  onCoverUpdate,
  onArchive,
  onImported,
}: MNewTripSheetProps): React.ReactElement {
  const isEditing = !!trip;
  const { t } = useTranslation();
  const toast = useToast();
  const can = useCanDo();
  const defaultCurrency = useSettingsStore((s) => s.settings.default_currency) || 'EUR';
  const fileRef = useRef<HTMLInputElement>(null);
  const coverSearchSeq = useRef(0);
  const canEditTrip = !isEditing || can('trip_edit', trip);
  const canUploadCover = !isEditing || can('trip_cover_upload', trip);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [pendingCoverFile, setPendingCoverFile] = useState<File | null>(null);
  const [pendingUnsplashUrl, setPendingUnsplashUrl] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CoverSearchPhoto[]>([]);
  const [searchError, setSearchError] = useState('');
  const [searching, setSearching] = useState(false);

  // ── 从TREK导入 mode (create only) ──
  const [createMode, setCreateMode] = useState<'form' | 'trek'>('form');
  const [trekToken, setTrekToken] = useState<string | null>(null);
  const [trekTrips, setTrekTrips] = useState<TrekImportTripSummary[]>([]);
  const [trekSelected, setTrekSelected] = useState<Set<number>>(new Set());
  const [trekBusy, setTrekBusy] = useState(false);
  const trekFileRef = useRef<HTMLInputElement>(null);

  const handleTrekFile = async (file: File | null) => {
    if (!file) return;
    setTrekBusy(true);
    setError('');
    setTrekTrips([]);
    setTrekToken(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await tripsApi.previewTrekImport(fd);
      setTrekToken(res.token);
      setTrekTrips(res.trips ?? []);
      setTrekSelected(new Set((res.trips ?? []).map((tr) => tr.id)));
      if (!res.trips?.length) setError(t('trips.importTrekNone'));
    } catch {
      setError(t('trips.importTrekFailed'));
    } finally {
      setTrekBusy(false);
    }
  };

  const handleTrekImport = async () => {
    if (!trekToken || trekSelected.size === 0) return;
    setTrekBusy(true);
    setError('');
    try {
      const res = await tripsApi.importTrek(trekToken, [...trekSelected]);
      toast.success(t('trips.importTrekSuccess', { count: res.imported?.length ?? 0 }));
      setTrekToken(null);
      setTrekTrips([]);
      setTrekSelected(new Set());
      setCreateMode('form');
      onImported?.();
      onClose();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, t('trips.importTrekFailed')));
    } finally {
      setTrekBusy(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setTitle(trip?.title || '');
    setDescription(trip?.description || '');
    setStartDate(trip?.start_date || '');
    setEndDate(trip?.end_date || '');
    setCurrency(trip?.currency || defaultCurrency);
    setCoverPreview(trip?.cover_image || null);
    setPendingCoverFile(null);
    setPendingUnsplashUrl(null);
    setSearchQuery('');
    setSearchResults([]);
    setSearchError('');
    setError('');
    setCreateMode('form');
    setTrekToken(null);
    setTrekTrips([]);
    setTrekSelected(new Set());
  }, [trip, open]);

  // The local file preview is a blob url; release it once a new cover replaces it
  // or the sheet goes away. Server and Unsplash urls are left alone.
  useEffect(() => {
    if (!coverPreview?.startsWith('blob:')) return;
    return () => {
      URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  // Moving the start keeps the trip length (same rule as TripFormModal).
  const changeStart = (value: string) => {
    if (value && endDate && startDate && endDate >= startDate) {
      const duration = Math.round(
        (new Date(endDate + 'T00:00:00Z').getTime() - new Date(startDate + 'T00:00:00Z').getTime()) / 86400000
      );
      const newEnd = new Date(value + 'T00:00:00Z');
      newEnd.setDate(newEnd.getDate() + duration);
      setEndDate(newEnd.toISOString().split('T')[0]);
    } else if (value && (!endDate || endDate < value)) {
      setEndDate(value);
    }
    setStartDate(value);
  };

  const handleSave = async () => {
    setError('');
    if (!title.trim()) {
      setError(t('dashboard.titleRequired'));
      return;
    }
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      setError(t('dashboard.endDateError'));
      return;
    }
    setIsSaving(true);
    try {
      const result = await onSave({
        title: title.trim(),
        description: description.trim() || null,
        start_date: startDate || null,
        end_date: endDate || null,
        currency,
        ...(!startDate && !endDate && !isEditing ? { day_count: 7 } : {}),
      });
      const created = result ? result.trip : undefined;
      if (pendingCoverFile && created?.id) {
        try {
          const fd = new FormData();
          fd.append('cover', pendingCoverFile);
          const data = await tripsApi.uploadCover(created.id, fd);
          onCoverUpdate?.(created.id, data.cover_image);
        } catch {
          toast.error(t('dashboard.coverUploadError'));
        }
      } else if (pendingUnsplashUrl && created?.id) {
        try {
          await tripsApi.update(created.id, { cover_image: pendingUnsplashUrl });
          onCoverUpdate?.(created.id, pendingUnsplashUrl);
        } catch {
          toast.error(t('dashboard.coverSaveError'));
        }
      }
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('places.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCoverFile = async (file: File | undefined | null) => {
    if (!file) return;
    const normalized = await normalizeImageFile(file);
    setPendingUnsplashUrl(null);
    if (isEditing && trip?.id) {
      setUploadingCover(true);
      try {
        const fd = new FormData();
        fd.append('cover', normalized);
        const data = await tripsApi.uploadCover(trip.id, fd);
        setCoverPreview(data.cover_image);
        onCoverUpdate?.(trip.id, data.cover_image);
        toast.success(t('dashboard.coverSaved'));
      } catch {
        toast.error(t('dashboard.coverUploadError'));
      } finally {
        setUploadingCover(false);
      }
    } else {
      setPendingCoverFile(normalized);
      setCoverPreview(URL.createObjectURL(normalized));
    }
  };

  const handleSearch = async () => {
    const query = searchQuery.trim() || title.trim();
    if (!query) {
      setSearchError(t('dashboard.unsplashQueryRequired'));
      return;
    }
    // Only the latest search may apply its results (out-of-order guard).
    const seq = ++coverSearchSeq.current;
    setSearching(true);
    setSearchError('');
    try {
      const data = await tripsApi.searchCoverImages(query);
      if (seq !== coverSearchSeq.current) return;
      const photos: CoverSearchPhoto[] = data.photos || [];
      setSearchResults(photos);
      if (photos.length === 0) setSearchError(t('dashboard.unsplashNoResults'));
    } catch (err: unknown) {
      if (seq !== coverSearchSeq.current) return;
      setSearchError(getApiErrorMessage(err, t('dashboard.coverSearchError')));
    } finally {
      if (seq === coverSearchSeq.current) setSearching(false);
    }
  };

  const selectUnsplash = async (photo: CoverSearchPhoto) => {
    if (!photo.url) return;
    setPendingCoverFile(null);
    if (isEditing && trip?.id) {
      setUploadingCover(true);
      try {
        await tripsApi.update(trip.id, { cover_image: photo.url });
        setCoverPreview(photo.url);
        onCoverUpdate?.(trip.id, photo.url);
        toast.success(t('dashboard.coverSaved'));
      } catch (err: unknown) {
        toast.error(getApiErrorMessage(err, t('dashboard.coverSaveError')));
      } finally {
        setUploadingCover(false);
      }
    } else {
      setPendingUnsplashUrl(photo.url);
      setCoverPreview(photo.url);
    }
  };

  const removeCover = async () => {
    if (pendingCoverFile || pendingUnsplashUrl) {
      setPendingCoverFile(null);
      setPendingUnsplashUrl(null);
      setCoverPreview(null);
      return;
    }
    // Anything else is a cover stored on the trip, so this is the edit sheet.
    const id = trip!.id;
    try {
      await tripsApi.update(id, { cover_image: null });
      setCoverPreview(null);
      onCoverUpdate?.(id, null);
    } catch {
      toast.error(t('dashboard.coverRemoveError'));
    }
  };

  const boxCls = 'rounded-[14px] border border-[color:var(--m-rowbr)] bg-[color:var(--m-ic)] p-[11px_12px]';
  const inputCls =
    'w-full border-none bg-transparent pt-[2px] font-[inherit] text-[0.9375rem] font-semibold text-m-ink outline-none placeholder:text-m-faint';

  return (
    <MSheet
      open={open}
      onClose={onClose}
      variant="card"
      material="opaque"
      ariaLabel={isEditing ? t('dashboard.editTrip') : t('dashboard.createTrip')}
    >
      <div className="flex items-center gap-[11px] p-[16px_16px_0]">
        <div className="min-w-0 flex-1 truncate text-[1.0625rem] font-bold">
          {isEditing ? t('dashboard.editTrip') : t('dashboard.createTrip')}
        </div>
        <MIconBtn ariaLabel={t('common.cancel')} variant="neutral" size={34} onClick={onClose}>
          <X size={16} strokeWidth={2.2} />
        </MIconBtn>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {error && (
          <div className="mb-3 rounded-[14px] bg-[color:var(--m-ic)] p-[11px_12px] text-[0.75rem] font-semibold text-[color:var(--m-st-danger)]">
            {error}
          </div>
        )}

        {!isEditing && (
          <div className="mb-3 flex gap-1 rounded-full bg-[color:var(--m-ic)] p-[3px]" role="tablist">
            {(
              [
                ['form', t('dashboard.createTrip')],
                ['trek', t('trips.importTrekTab')],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={createMode === id}
                onClick={() => setCreateMode(id)}
                className={`flex flex-1 items-center justify-center gap-[5px] rounded-full py-[7px] text-[0.75rem] font-bold transition-colors ${
                  createMode === id ? 'bg-m-act text-m-actfg' : 'text-m-muted'
                }`}
              >
                {id === 'trek' && <FileUp size={12} strokeWidth={2.2} />}
                {label}
              </button>
            ))}
          </div>
        )}

        {!isEditing && createMode === 'trek' && (
          <div className="space-y-2">
            <p className="px-1 text-[0.75rem] leading-[1.5] text-m-muted">{t('trips.importTrekIntro')}</p>
            <input
              ref={trekFileRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={(e) => {
                void handleTrekFile(e.target.files?.[0] ?? null);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => trekFileRef.current?.click()}
              disabled={trekBusy}
              className="flex w-full items-center justify-center gap-[6px] rounded-[14px] border border-dashed border-[color:var(--m-rowbr)] bg-[color:var(--m-ic)] p-[18px] text-[0.8125rem] font-medium text-m-muted disabled:opacity-50"
            >
              {trekBusy ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[color:var(--m-rowbr)] border-t-m-ink" />
              ) : (
                <FileUp size={15} strokeWidth={2} />
              )}
              {trekBusy ? t('trips.importTrekScanning') : t('trips.importTrekPick')}
            </button>
            {trekTrips.map((tr) => {
              const checked = trekSelected.has(tr.id);
              return (
                <button
                  key={tr.id}
                  type="button"
                  onClick={() =>
                    setTrekSelected((prev) => {
                      const next = new Set(prev);
                      if (next.has(tr.id)) next.delete(tr.id);
                      else next.add(tr.id);
                      return next;
                    })
                  }
                  className={`flex w-full items-center gap-[10px] rounded-[18px] px-[14px] py-[11px] text-left ${
                    checked ? 'bg-m-act/[.14] ring-1 ring-inset ring-[color:var(--m-act)]' : 'bg-[color:var(--m-ic)]'
                  }`}
                >
                  <span
                    className={`flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[5px] ${
                      checked ? 'bg-m-act text-m-actfg' : 'border-[1.5px] border-[color:var(--m-rowbr)]'
                    }`}
                  >
                    {checked && <FileUp size={10} strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.84375rem] font-semibold text-m-ink">
                      {tr.title || t('trips.importTrekUntitled')}
                    </span>
                    <span className="block truncate font-geist text-[0.6875rem] text-m-muted">
                      {[tr.start_date, tr.end_date].filter(Boolean).join(' ~ ')}
                      {' · '}
                      {t('trips.importTrekStats', {
                        days: tr.day_count,
                        places: tr.place_count,
                        photos: tr.photo_count,
                        budget: tr.budget_count,
                      })}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className={boxCls} style={{ display: !isEditing && createMode === 'trek' ? 'none' : undefined }}>
          <FieldLabel>{t('dashboard.tripTitle')}</FieldLabel>
          <input
            value={title}
            onChange={(e) => canEditTrip && setTitle(e.target.value)}
            readOnly={!canEditTrip}
            placeholder={t('dashboard.tripTitlePlaceholder')}
            className={inputCls}
          />
        </div>

        <div className={`${boxCls} mt-2`}>
          <FieldLabel>{t('dashboard.tripDescription')}</FieldLabel>
          <textarea
            value={description}
            onChange={(e) => canEditTrip && setDescription(e.target.value)}
            readOnly={!canEditTrip}
            placeholder={t('dashboard.tripDescriptionPlaceholder')}
            rows={2}
            className={`${inputCls} resize-none text-[0.8125rem] font-medium`}
          />
        </div>

        <div className="mt-2 flex gap-2">
          <div className={`${boxCls} min-w-0 flex-1`}>
            <FieldLabel>{t('dashboard.startDate')}</FieldLabel>
            <CustomDatePicker
              value={startDate}
              onChange={(v) => {
                if (canEditTrip) changeStart(v);
              }}
              placeholder={t('dashboard.startDate')}
              borderless
              style={{ marginTop: 3 }}
            />
          </div>
          <div className={`${boxCls} min-w-0 flex-1`}>
            <FieldLabel>{t('dashboard.endDate')}</FieldLabel>
            <CustomDatePicker
              value={endDate}
              onChange={(v) => {
                if (canEditTrip) setEndDate(v);
              }}
              placeholder={t('dashboard.endDate')}
              borderless
              style={{ marginTop: 3 }}
            />
          </div>
        </div>
        {!isEditing && !startDate && !endDate && (
          <div className="mt-[6px] px-1 font-geist text-[0.625rem] text-m-faint">{t('dashboard.noDateHint')}</div>
        )}

        <div className="mt-2">
          <FieldLabel>{t('dashboard.currency')}</FieldLabel>
          <CustomSelect
            value={currency}
            onChange={(v) => {
              if (canEditTrip) setCurrency(String(v));
            }}
            disabled={!canEditTrip}
            searchable
            size="sm"
            options={currenciesWith(currency).map((c) => ({ value: c, label: `${c} (${SYMBOLS[c] || c})` }))}
            style={{ width: '100%', marginTop: 5 }}
          />
        </div>

        {canUploadCover && (
          <div className="mt-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                handleCoverFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            {coverPreview ? (
              <div className="relative h-[130px] overflow-hidden rounded-[16px]">
                <img src={coverPreview} alt="" className="h-full w-full object-cover" />
                <div className="absolute bottom-2 right-2 flex gap-[6px]">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploadingCover}
                    className="flex h-[34px] items-center gap-1 rounded-full border border-white/30 bg-white/[.22] px-3 text-[0.6875rem] font-semibold text-white backdrop-blur-[8px]"
                  >
                    <Camera size={13} strokeWidth={2.1} />
                    {uploadingCover ? t('common.uploading') : t('common.change')}
                  </button>
                  <button
                    type="button"
                    onClick={removeCover}
                    aria-label={t('common.delete')}
                    className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-white/30 bg-white/[.22] text-white backdrop-blur-[8px]"
                  >
                    <X size={14} strokeWidth={2.1} />
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploadingCover}
                className="flex w-full items-center justify-center gap-[6px] rounded-[14px] border border-dashed border-[color:var(--m-rowbr)] bg-[color:var(--m-ic)] p-[18px] text-[0.8125rem] font-medium text-m-muted"
              >
                <Camera size={15} strokeWidth={2} />
                {uploadingCover ? t('common.uploading') : t('dashboard.mobile.addCoverImage')}
              </button>
            )}

            <div className="mt-2 flex gap-2">
              <div className={`${boxCls} min-w-0 flex-1 py-[9px]`}>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSearch();
                    }
                  }}
                  placeholder={t('dashboard.unsplashSearchPlaceholder')}
                  className={`${inputCls} pt-0 text-[0.8125rem] font-medium`}
                />
              </div>
              <button
                type="button"
                onClick={handleSearch}
                disabled={searching || (!searchQuery.trim() && !title.trim())}
                aria-label={t('dashboard.searchUnsplash')}
                className="flex h-auto w-[42px] flex-none items-center justify-center rounded-[14px] bg-m-act text-m-actfg disabled:opacity-50"
              >
                <Search size={15} strokeWidth={2.2} />
              </button>
            </div>
            {searchError && (
              <p className="mt-[6px] px-1 text-[0.6875rem] font-medium text-[color:var(--m-st-danger)]">
                {searchError}
              </p>
            )}
            {searchResults.length > 0 && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {searchResults.map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => selectUnsplash(photo)}
                    aria-label={t('dashboard.useUnsplashPhoto', { photographer: photo.photographer || 'Unsplash' })}
                    className={`relative h-20 overflow-hidden rounded-[12px] border ${
                      coverPreview === photo.url ? 'border-[color:var(--m-act)]' : 'border-[color:var(--m-rowbr)]'
                    }`}
                  >
                    <img
                      src={photo.thumb}
                      alt={photo.description || ''}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                    {photo.photographer && (
                      <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-[6px] py-1 text-left font-geist text-[0.625rem] text-white">
                        {photo.photographer}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {isEditing && onArchive && (
          <div className="mt-2 rounded-[14px] bg-[color:var(--m-ic)]">
            <MListRow
              icon={trip?.is_archived ? ArchiveRestore : Archive}
              label={trip?.is_archived ? t('dashboard.restore') : t('dashboard.archive')}
              onClick={() => {
                onArchive();
                onClose();
              }}
            />
          </div>
        )}
      </div>

      <div className="flex gap-2 p-[0_16px_16px]">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-full bg-[color:var(--m-ic)] py-[10px] text-[0.8125rem] font-semibold text-m-ink"
        >
          {t('common.cancel')}
        </button>
        {!isEditing && createMode === 'trek' ? (
          <button
            type="button"
            onClick={handleTrekImport}
            disabled={trekBusy || trekSelected.size === 0}
            className="flex-1 rounded-full bg-m-act py-[10px] text-[0.8125rem] font-semibold text-m-actfg disabled:opacity-50"
          >
            {trekBusy ? t('common.saving') : t('trips.importTrekImport')}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 rounded-full bg-m-act py-[10px] text-[0.8125rem] font-semibold text-m-actfg disabled:opacity-50"
          >
            {isSaving ? t('common.saving') : isEditing ? t('common.update') : t('dashboard.createTrip')}
          </button>
        )}
      </div>
    </MSheet>
  );
}
