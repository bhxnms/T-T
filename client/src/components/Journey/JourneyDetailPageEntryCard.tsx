import { Clock, MapPin, MoreHorizontal, Pencil, Plus, RouteOff, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { pluginsApi } from '../../api/client';
import { useTranslation } from '../../i18n';
import { MOOD_CONFIG, WEATHER_CONFIG } from '../../pages/journeyDetail/JourneyDetailPage.constants';
import type { JourneyEntry, JourneyPhoto } from '../../store/journeyStore';
import { usePluginStore } from '../../store/pluginStore';
import { formatLocationName } from '../../utils/formatters';
import { MoodChip, WeatherChip } from './JourneyDetailPageChips';
import { ExpandableStory } from './JourneyDetailPageExpandableStory';
import { PhotoGrid } from './JourneyDetailPagePhotoGrid';
import { VerdictSection } from './JourneyDetailPageVerdictSection';

export function EntryCard({
  entry,
  readOnly,
  onEdit,
  onDelete,
  onPhotoClick,
}: {
  entry: JourneyEntry;
  readOnly?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onPhotoClick: (photos: JourneyPhoto[], index: number) => void;
}) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  // Extra rows contributed by journalEntryProvider plugins — same pattern as the
  // PlaceInspector provider details: fetched only when plugins are active at all,
  // fail-safe (the server drops slow/failing providers), only ever additive.
  const hasPlugins = usePluginStore((s) => s.plugins.length > 0);
  const [providerRows, setProviderRows] = useState<
    Array<{ pluginId: string; items: Array<{ label: string; value?: string; url?: string }> }>
  >([]);
  useEffect(() => {
    if (!hasPlugins) {
      setProviderRows([]);
      return;
    }
    let cancelled = false;
    pluginsApi
      .journalEntryRows(entry.id)
      .then((d) => {
        if (!cancelled)
          setProviderRows((d.providers || []).filter((p) => Array.isArray(p.items) && p.items.length > 0));
      })
      .catch(() => {
        if (!cancelled) setProviderRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [entry.id, hasPlugins]);
  const photos = entry.photos || [];
  const mood = entry.mood ? MOOD_CONFIG[entry.mood] : null;
  const weather = entry.weather ? WEATHER_CONFIG[entry.weather] : null;

  const prosArr = entry.pros_cons?.pros ?? [];
  const consArr = entry.pros_cons?.cons ?? [];
  const hasProscons = prosArr.length > 0 || consArr.length > 0;

  return (
    <div
      className="overflow-hidden rounded-[20px] bg-white transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5 hover:shadow-md dark:bg-zinc-900"
      style={{ border: '1px solid var(--vg-line)' }}
    >
      {/* Hero area: photos with title overlay */}
      {photos.length > 0 ? (
        <div className="relative">
          <PhotoGrid photos={photos} onClick={(idx) => onPhotoClick(photos, idx)} />
          {/* Gradient overlay for title */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0"
            style={{
              background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)',
              height: '60%',
            }}
          />

          {/* Badges top-left */}
          <div className="absolute left-4 right-14 top-3 z-[2] flex items-center gap-1.5">
            {entry.location_name && (
              <span className="inline-flex max-w-full items-center gap-1 overflow-hidden rounded-full bg-black/40 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white backdrop-blur-sm">
                <MapPin size={10} className="flex-shrink-0" />
                <span className="truncate">{formatLocationName(entry.location_name)}</span>
              </span>
            )}
            {entry.entry_time && (
              <span className="inline-flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white backdrop-blur-sm">
                <Clock size={10} />
                {entry.entry_time}
              </span>
            )}
            {/* Switched off the route (#2064): the day is still in the journal,
                the printed map and the distance skip it, and the card says so. */}
            {entry.stats_excluded && (
              <span className="inline-flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white backdrop-blur-sm">
                <RouteOff size={10} />
                {t('journey.entry.offRoute')}
              </span>
            )}
          </div>

          {/* Menu top-right */}
          {!readOnly && (
            <div className="absolute right-3 top-2.5 z-[2]">
              <button
                type="button"
                ref={menuBtnRef}
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-black/40 text-white backdrop-blur-sm hover:bg-black/50"
              >
                <MoreHorizontal size={14} />
              </button>
              {menuOpen &&
                createPortal(
                  <>
                    <div className="fixed inset-0 z-[99]" role="presentation" onClick={() => setMenuOpen(false)} />
                    <div
                      className="fixed z-[100] min-w-[120px] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
                      style={{
                        top: (menuBtnRef.current?.getBoundingClientRect().bottom || 0) + 4,
                        right: window.innerWidth - (menuBtnRef.current?.getBoundingClientRect().right || 0),
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onEdit();
                        }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-700"
                      >
                        <Pencil size={12} /> {t('common.edit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onDelete();
                        }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                      >
                        <Trash2 size={12} /> {t('common.delete')}
                      </button>
                    </div>
                  </>,
                  document.body
                )}
            </div>
          )}

          {/* Title on photo */}
          {entry.title && (
            <div className="pointer-events-none absolute bottom-4 left-5 right-5 z-[2]">
              <h3 className="text-[22px] font-bold leading-tight tracking-[-0.02em] text-white drop-shadow-sm">
                {entry.title}
              </h3>
            </div>
          )}
        </div>
      ) : (
        /* No photos: simple header */
        <div className="flex items-center justify-between px-4 pt-3">
          <div className="mr-2 flex min-w-0 flex-1 items-center gap-2">
            {entry.location_name && (
              <span className="inline-flex max-w-full items-center gap-1 overflow-hidden rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800">
                <MapPin size={10} className="flex-shrink-0" />{' '}
                <span className="truncate">{formatLocationName(entry.location_name)}</span>
              </span>
            )}
            {entry.entry_time && (
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800">
                <Clock size={10} /> {entry.entry_time}
              </span>
            )}
            {entry.stats_excluded && (
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800">
                <RouteOff size={10} /> {t('journey.entry.offRoute')}
              </span>
            )}
          </div>
          {!readOnly && (
            <div className="relative">
              <button
                type="button"
                ref={menuBtnRef}
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <MoreHorizontal size={14} />
              </button>
              {menuOpen &&
                createPortal(
                  <>
                    <div className="fixed inset-0 z-[99]" role="presentation" onClick={() => setMenuOpen(false)} />
                    <div
                      className="fixed z-[100] min-w-[120px] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
                      style={{
                        top: (menuBtnRef.current?.getBoundingClientRect().bottom || 0) + 4,
                        right: window.innerWidth - (menuBtnRef.current?.getBoundingClientRect().right || 0),
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onEdit();
                        }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-700"
                      >
                        <Pencil size={12} /> {t('common.edit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onDelete();
                        }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                      >
                        <Trash2 size={12} /> {t('common.delete')}
                      </button>
                    </div>
                  </>,
                  document.body
                )}
            </div>
          )}
        </div>
      )}

      <div className="px-5 pb-5 pt-4">
        {/* Title (only if no photos — otherwise shown on image) */}
        {!photos.length && entry.title && (
          <h3 className="mb-1 text-base font-semibold leading-snug tracking-tight text-zinc-900 dark:text-white">
            {entry.title}
          </h3>
        )}
        {!photos.length && entry.location_name && !entry.title && <div className="mb-2" />}
        {entry.story && <ExpandableStory story={entry.story} />}

        {/* Pros & Cons — "Pros & Cons" style */}
        {hasProscons && <VerdictSection pros={prosArr} cons={consArr} />}

        {(mood || weather || (entry.tags && entry.tags.length > 0)) && (
          <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <div className="flex items-center gap-1.5">
              {mood && <MoodChip mood={entry.mood!} />}
              {weather && <WeatherChip weather={entry.weather!} />}
            </div>
            <div className="flex gap-1">
              {entry.tags?.map((tag, i) => (
                <span
                  key={i}
                  className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Plugin provider rows — host-vetted label/value/url, plain text only */}
        {providerRows.length > 0 && (
          <div className="mt-3 space-y-1.5 border-t border-zinc-100 pt-3 dark:border-zinc-800">
            {providerRows.flatMap((p) =>
              p.items.map((it, i) => (
                <div key={`${p.pluginId}-${i}`} className="flex items-baseline justify-between gap-2 text-[12px]">
                  <span className="flex-shrink-0 font-medium text-zinc-500 dark:text-zinc-400">{it.label}</span>
                  {it.url ? (
                    <a
                      href={it.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="truncate text-right text-indigo-600 dark:text-indigo-400"
                    >
                      {it.value ?? it.url}
                    </a>
                  ) : (
                    <span className="truncate text-right text-zinc-600 dark:text-zinc-300">{it.value}</span>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function SkeletonCard({ entry, onClick }: { entry: JourneyEntry; onClick?: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`flex items-center gap-3 rounded-[18px] px-3.5 py-3 transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] ${onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''}`}
      style={{ border: '1.5px dashed var(--vg-line2)', background: 'var(--vg-surf2)' }}
    >
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
        style={{ background: 'var(--vg-surf)', border: '1px solid var(--vg-line)', color: 'var(--vg-ink3)' }}
      >
        <MapPin size={15} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold" style={{ color: 'var(--vg-ink)' }}>
          {entry.title || t('journey.detail.newEntry')}
        </div>
        <div className="mt-0.5 truncate text-[11px]" style={{ color: 'var(--vg-ink3)' }}>
          {formatLocationName(entry.location_name)}
          {entry.entry_time ? ` · ${entry.entry_time}` : ''}
        </div>
      </div>
      {onClick && (
        <span
          className="inline-flex flex-shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold"
          style={{ background: 'var(--vg-ink)', color: 'var(--vg-bg)' }}
        >
          <Plus size={12} strokeWidth={2.6} /> {t('journey.detail.addEntry')}
        </span>
      )}
    </div>
  );
}

export function CheckinCard({ entry, onClick }: { entry: JourneyEntry; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] dark:border-zinc-700 dark:bg-zinc-900 ${onClick ? 'cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-500' : ''}`}
    >
      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
        <MapPin size={13} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[13px] font-medium text-zinc-900 dark:text-white">
          {entry.title}
          {entry.location_name && <span className="text-xs font-normal text-zinc-500">· {entry.location_name}</span>}
        </div>
        {entry.story && <div className="mt-0.5 text-[11px] text-zinc-500">{entry.story}</div>}
      </div>
      <div className="flex flex-shrink-0 items-center gap-2.5">
        {entry.entry_time && <span className="text-[11px] tabular-nums text-zinc-400">{entry.entry_time}</span>}
      </div>
    </div>
  );
}
