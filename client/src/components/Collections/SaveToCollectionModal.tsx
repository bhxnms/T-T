import type { Collection, CollectionMembership, CollectionStatus } from '@trek/shared';
import { Bookmark, BookmarkCheck, Check, CheckCircle2, Loader2, Plus } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { collectionsApi } from '../../api/collections';
import { useTranslation } from '../../i18n';
import { useSaveToCollectionStore } from '../../store/saveToCollectionStore';
import { getApiErrorMessage } from '../../utils/apiError';
import Modal from '../shared/Modal';
import { useToast } from '../shared/Toast';
import StatusBadge from './StatusBadge';

/**
 * Globally-mounted list picker for the "Save to Collection" entry points
 * (PlaceInspector footer button + the two trip-sidebar context menus). Reads the
 * active target from saveToCollectionStore, shows every list the user owns or
 * co-owns, and toggles the place in/out of each — a check marks the lists that
 * already hold it. Each change refreshes membership and bumps the store version
 * so the inspector bookmark indicator stays in sync. One mount, no prop drilling.
 */
export default function SaveToCollectionModal(): React.ReactElement | null {
  const target = useSaveToCollectionStore((s) => s.target);
  const close = useSaveToCollectionStore((s) => s.close);
  const bumpVersion = useSaveToCollectionStore((s) => s.bumpVersion);
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();

  const [lists, setLists] = useState<Collection[]>([]);
  const [membership, setMembership] = useState<CollectionMembership | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const membershipQuery = useMemo(() => {
    if (!target) return null;
    return {
      google_place_id: target.google_place_id ?? undefined,
      google_ftid: target.google_ftid ?? undefined,
      name: target.name,
      lat: target.lat ?? undefined,
      lng: target.lng ?? undefined,
    };
  }, [target]);

  const refreshMembership = useCallback(async () => {
    if (!membershipQuery) return;
    try {
      const m = await collectionsApi.membership(membershipQuery);
      setMembership(m);
    } catch {
      setMembership({ saved: false, lists: [] });
    }
  }, [membershipQuery]);

  // Load lists + membership whenever the picker opens for a new target.
  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    setLoading(true);
    setMembership(null);
    Promise.all([
      collectionsApi.list().catch(() => ({ collections: [], incomingInvites: [] })),
      membershipQuery
        ? collectionsApi
            .membership(membershipQuery)
            .catch(() => ({ saved: false, lists: [] as CollectionMembership['lists'] }))
        : Promise.resolve({ saved: false, lists: [] as CollectionMembership['lists'] }),
    ])
      .then(([listRes, m]) => {
        if (cancelled) return;
        setLists(listRes.collections);
        setMembership(m);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  if (!target) return null;

  const savedByCollection = new Map<number, CollectionMembership['lists'][number]>();
  for (const l of membership?.lists ?? []) savedByCollection.set(l.collection_id, l);

  /** Lists holding this place that the viewer may edit and that are not visited yet. */
  const unvisited = (membership?.lists ?? []).filter((l) => l.can_edit && l.status !== 'visited');

  const handleStatus = async (entry: CollectionMembership['lists'][number], next: CollectionStatus) => {
    if (busyId != null) return;
    setBusyId(entry.collection_id);
    try {
      await collectionsApi.setStatus(entry.place_id, next);
      await refreshMembership();
      bumpVersion();
    } catch (err) {
      toast.error(getApiErrorMessage(err, t('common.error')));
    } finally {
      setBusyId(null);
    }
  };

  const handleVisitedEverywhere = async () => {
    if (busyId != null || unvisited.length === 0) return;
    setBusyId(-1);
    try {
      const { updated } = await collectionsApi.setStatusMany(
        unvisited.map((l) => l.place_id),
        'visited'
      );
      toast.success(t('collections.markedVisited', { count: updated }));
      await refreshMembership();
      bumpVersion();
    } catch (err) {
      toast.error(getApiErrorMessage(err, t('common.error')));
    } finally {
      setBusyId(null);
    }
  };

  const handleToggle = async (list: Collection) => {
    if (busyId != null) return;
    const savedPlaceId = savedByCollection.get(list.id)?.place_id;
    setBusyId(list.id);
    try {
      if (savedPlaceId != null) {
        await collectionsApi.deletePlace(savedPlaceId);
        toast.success(t('collections.removedFromList', { name: list.name }));
      } else {
        await collectionsApi.savePlace({
          collection_id: list.id,
          source_trip_id: target.source_trip_id ?? null,
          source_place_id: target.source_place_id ?? null,
          name: target.name,
          description: target.description ?? null,
          lat: target.lat ?? null,
          lng: target.lng ?? null,
          address: target.address ?? null,
          category_id: target.category_id ?? null,
          price: target.price ?? null,
          currency: target.currency ?? null,
          notes: target.notes ?? null,
          image_url: target.image_url ?? null,
          google_place_id: target.google_place_id ?? null,
          google_ftid: target.google_ftid ?? null,
          osm_id: target.osm_id ?? null,
          website: target.website ?? null,
          phone: target.phone ?? null,
          force: true,
        });
        toast.success(t('collections.addedToList', { name: list.name }));
      }
      await refreshMembership();
      bumpVersion();
    } catch (err) {
      toast.error(getApiErrorMessage(err, t('common.error')));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal
      isOpen
      onClose={close}
      title={t('collections.pickList')}
      size="sm"
      footer={
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              close();
              navigate('/collections');
            }}
            className="text-[13px] font-medium text-accent hover:underline"
          >
            {t('collections.viewInCollection')}
          </button>
          <button
            type="button"
            onClick={close}
            className="rounded-lg border border-edge px-3 py-1.5 text-[13px] text-content-secondary hover:bg-surface-hover"
          >
            {t('common.close')}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-content">{target.name}</p>
          {/* One tap for "I have been here", however many lists hold it (#1469). */}
          {unvisited.length > 0 && (
            <button
              type="button"
              onClick={handleVisitedEverywhere}
              disabled={busyId != null}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-edge bg-surface-card px-2.5 py-1 text-[11px] font-semibold text-content-secondary hover:bg-surface-hover disabled:opacity-60"
            >
              {busyId === -1 ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <CheckCircle2 size={12} strokeWidth={2.2} />
              )}
              {unvisited.length > 1 ? t('collections.markVisitedAll') : t('collections.markVisited')}
            </button>
          )}
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-content-faint">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : lists.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-8 text-center">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-surface-secondary text-content-faint">
              <Bookmark size={20} />
            </div>
            <p className="mb-3 text-[13px] text-content-faint">{t('collections.noListsYet')}</p>
            <button
              type="button"
              onClick={() => {
                close();
                navigate('/collections');
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[13px] font-semibold text-accent-text"
            >
              <Plus size={14} /> {t('collections.newList')}
            </button>
          </div>
        ) : (
          <div className="-mx-1 flex max-h-[50vh] flex-col gap-1 overflow-y-auto px-1">
            {lists.map((list) => {
              const entry = savedByCollection.get(list.id);
              const saved = !!entry;
              const busy = busyId === list.id;
              return (
                <button
                  key={list.id}
                  type="button"
                  onClick={() => handleToggle(list)}
                  disabled={busyId != null}
                  className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors disabled:opacity-60 ${saved ? 'border-accent bg-accent-subtle' : 'border-edge bg-surface-card hover:bg-surface-hover'}`}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: list.color || 'var(--accent)' }}
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-content">{list.name}</span>
                  {list.is_owner === false && (
                    <span className="text-[10px] font-semibold uppercase text-content-faint">
                      {t('collections.shared')}
                    </span>
                  )}
                  {/* Per-list status, so one place can be an idea in one list and
                      visited in another. A role=button span, safe to nest here. */}
                  {entry && (
                    <StatusBadge
                      status={entry.status}
                      showLabel={false}
                      size={12}
                      onChange={
                        entry.can_edit
                          ? (next) => {
                              void handleStatus(entry, next);
                            }
                          : undefined
                      }
                      t={t}
                    />
                  )}
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${saved ? 'bg-accent text-accent-text' : 'border border-edge text-transparent'}`}
                  >
                    {busy ? (
                      <Loader2 size={13} className="animate-spin text-content-faint" />
                    ) : saved ? (
                      <BookmarkCheck size={13} />
                    ) : (
                      <Check size={13} />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
