import type { Collection } from '@trek/shared';
import { ArrowRight, Bookmark, Loader2, Plus, Search } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { collectionsApi } from '../../api/collections';
import { useTranslation } from '../../i18n';
import { getApiErrorMessage } from '../../utils/apiError';
import Modal from '../shared/Modal';
import { useToast } from '../shared/Toast';

interface SaveTripPlacesToListModalProps {
  isOpen: boolean;
  tripId: number;
  /** The selected trip place ids to copy into the chosen list. */
  placeIds: number[];
  onClose: () => void;
  /** Called after a successful save (e.g. to clear the trip selection). */
  onDone: () => void;
}

/**
 * Bulk "save to collection" for the trip place list: pick one of the user's lists
 * and copy every selected trip place into it at once (server dedups by name/coords).
 */
export default function SaveTripPlacesToListModal({
  isOpen,
  tripId,
  placeIds,
  onClose,
  onDone,
}: SaveTripPlacesToListModalProps): React.ReactElement | null {
  const { t } = useTranslation();
  const toast = useToast();
  const [lists, setLists] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setSearch('');
    collectionsApi
      .list()
      // Only lists the user can add to (their own or an editor/admin share). The
      // server still enforces this; here we drop lists that are clearly read-only.
      .then((res) => {
        if (!cancelled) setLists((res.collections ?? []).filter((c) => c.is_owner !== false));
      })
      .catch(() => {
        if (!cancelled) setLists([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? lists.filter((l) => l.name.toLowerCase().includes(q)) : lists;
  }, [lists, search]);

  if (!isOpen) return null;

  const pick = async (list: Collection) => {
    if (busyId != null || placeIds.length === 0) return;
    setBusyId(list.id);
    try {
      const res = await collectionsApi.saveFromTripMany(list.id, tripId, placeIds);
      if (res.copied > 0) toast.success(t('collections.addedNToList', { count: res.copied, name: list.name }));
      if (res.skipped.length > 0) toast.info(t('collections.skippedDuplicates', { count: res.skipped.length }));
      if (res.copied === 0 && res.skipped.length === 0) toast.info(t('collections.copyNothing'));
      onDone();
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, t('common.error')));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={t('collections.saveNToList', { count: placeIds.length })} size="sm">
      <div className="flex flex-col gap-3">
        {lists.length > 5 && (
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-content-faint" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('collections.searchLists')}
              className="w-full rounded-lg border border-edge bg-surface-input py-2 pl-8 pr-3 text-[13px] text-content outline-none focus:border-accent"
            />
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center py-10 text-content-faint">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-content-faint">{t('collections.noOwnLists')}</p>
        ) : (
          <div className="-mx-1 flex max-h-[50vh] flex-col gap-1 overflow-y-auto px-1">
            {filtered.map((list) => {
              const busy = busyId === list.id;
              return (
                <button
                  key={list.id}
                  type="button"
                  onClick={() => pick(list)}
                  disabled={busyId != null}
                  className="flex items-center gap-3 rounded-xl border border-edge bg-surface-card px-3 py-2.5 text-left transition-colors hover:bg-surface-hover disabled:opacity-60"
                >
                  <span
                    className="flex h-9 w-9 min-w-[36px] shrink-0 items-center justify-center rounded-lg text-white"
                    style={{ background: list.color || '#6366f1' }}
                  >
                    <Bookmark size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-content">{list.name}</span>
                    <span className="block text-[11.5px] text-content-faint">
                      {t('collections.placeCount', { count: list.place_count ?? 0 })}
                    </span>
                  </span>
                  {busy ? (
                    <Loader2 size={15} className="shrink-0 animate-spin text-content-faint" />
                  ) : (
                    <ArrowRight size={15} className="shrink-0 text-content-faint" />
                  )}
                </button>
              );
            })}
          </div>
        )}
        <p className="inline-flex items-center gap-1.5 text-[11.5px] text-content-faint">
          <Plus size={12} /> {t('collections.saveToListHint')}
        </p>
      </div>
    </Modal>
  );
}
