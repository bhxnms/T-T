import { Archive, ArchiveRestore, ImagePlus, Plus, Trash2, UserPlus, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { journeyApi } from '../../api/client';
import { useTranslation } from '../../i18n';
import { pickGradient } from '../../pages/journeyDetail/JourneyDetailPage.helpers';
import type { JourneyDetail } from '../../store/journeyStore';
import { useJourneyStore } from '../../store/journeyStore';
import { normalizeImageFile } from '../../utils/convertHeic';
import ConfirmDialog from '../shared/ConfirmDialog';
import { useToast } from '../shared/Toast';
import { AddTripDialog } from './JourneyDetailPageAddTripDialog';
import JourneyShareSection from './JourneyShareSection';

export function JourneySettingsDialog({
  journey,
  onClose,
  onSaved,
  onOpenInvite,
  onRefresh,
}: {
  journey: JourneyDetail;
  onClose: () => void;
  onSaved: () => void;
  onOpenInvite: () => void;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(journey.title);
  const [subtitle, setSubtitle] = useState(journey.subtitle || '');
  const [saving, setSaving] = useState(false);
  const [showAddTrip, setShowAddTrip] = useState(false);
  const [unlinkTarget, setUnlinkTarget] = useState<{ trip_id: number; title: string } | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const isDirty = title !== journey.title || subtitle !== (journey.subtitle || '');
  const handleClose = () => {
    if (isDirty) setShowDiscardConfirm(true);
    else onClose();
  };
  const coverRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const navigate = useNavigate();
  const { updateJourney, deleteJourney } = useJourneyStore();

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateJourney(journey.id, { title, subtitle: subtitle || null });
      onSaved();
    } catch {
      toast.error(t('journey.settings.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('cover', await normalizeImageFile(file));
    try {
      await journeyApi.uploadCover(journey.id, formData);
      toast.success(t('journey.settings.coverUpdated'));
      onSaved();
    } catch {
      toast.error(t('journey.settings.coverFailed'));
    }
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const handleArchiveToggle = async () => {
    setArchiving(true);
    try {
      const newStatus = journey.status === 'archived' ? 'active' : 'archived';
      await updateJourney(journey.id, { status: newStatus });
      toast.success(newStatus === 'archived' ? t('journey.settings.archived') : t('journey.settings.reopened'));
      onSaved();
    } catch {
      toast.error(t('journey.settings.saveFailed'));
    } finally {
      setArchiving(false);
    }
  };

  // Saved on the spot rather than on Save, like the archive switch above it:
  // it is a view setting, and the point of it is seeing the map change (#2194).
  const [savingTracks, setSavingTracks] = useState(false);
  const handleTracksToggle = async () => {
    setSavingTracks(true);
    try {
      await updateJourney(journey.id, { show_trip_tracks: !journey.show_trip_tracks });
      // onRefresh, not onSaved: onSaved closes the dialog, which would destroy the
      // switch the moment it is flipped AND skip handleClose's unsaved-changes
      // guard, silently dropping a title the owner had typed but not saved yet.
      onRefresh();
    } catch {
      toast.error(t('journey.settings.saveFailed'));
    } finally {
      setSavingTracks(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteJourney(journey.id);
      navigate('/journey');
    } catch {
      toast.error(t('journey.settings.failedToDelete'));
    }
  };

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[200] flex items-end justify-center overscroll-none bg-[rgba(9,9,11,0.75)] md:items-center md:p-5"
      onClick={handleClose}
      onTouchMove={(e) => {
        if (e.target === e.currentTarget) e.preventDefault();
      }}
    >
      <div
        role="presentation"
        className="flex max-h-[85vh] w-full max-w-[980px] flex-col overflow-hidden rounded-t-2xl bg-white shadow-[0_20px_40px_rgba(0,0,0,0.2)] dark:bg-zinc-900 md:max-h-[90vh] md:rounded-[24px]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-700">
          <h2 className="text-[16px] font-bold text-zinc-900 dark:text-white">{t('journey.settings.title')}</h2>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5">
          <div className="grid grid-cols-1 items-start gap-x-6 gap-y-5 md:grid-cols-2">
            {/* Left column */}
            <div
              className="flex flex-col gap-5 rounded-2xl p-4"
              style={{ background: 'var(--vg-surf2)', border: '1px solid var(--vg-line)' }}
            >
              {/*Cover Image */}
              <div>
                <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  {t('journey.settings.coverImage')}
                </label>
                <input ref={coverRef} type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
                <button
                  type="button"
                  onClick={() => coverRef.current?.click()}
                  className="relative flex h-28 w-full items-center justify-center gap-2 overflow-hidden rounded-xl border border-dashed border-zinc-200 text-[12px] text-zinc-500 hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:border-zinc-500 dark:hover:bg-zinc-800"
                >
                  {journey.cover_image ? (
                    <>
                      <img
                        src={`/uploads/${journey.cover_image}`}
                        className="absolute inset-0 h-full w-full object-cover opacity-50"
                        alt=""
                      />
                      <span className="relative z-10 flex items-center gap-1.5">
                        <ImagePlus size={14} /> {t('journey.settings.changeCover')}
                      </span>
                    </>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <ImagePlus size={14} /> {t('journey.settings.addCover')}
                    </span>
                  )}
                </button>
              </div>

              {/* Title */}
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  {t('journey.settings.name')}
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-[14px] text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </div>

              {/* Subtitle */}
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  {t('journey.settings.subtitle')}
                </label>
                <input
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder={t('journey.settings.subtitlePlaceholder')}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-[14px] text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </div>

              {/* Trip GPX tracks on the journey map (#2194) */}
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  {t('journey.settings.tracks')}
                </label>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!journey.show_trip_tracks}
                  disabled={savingTracks}
                  onClick={handleTracksToggle}
                  className="flex w-full items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-left disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] text-zinc-900 dark:text-white">
                      {t('journey.settings.showTripTracks')}
                    </span>
                    <span className="block text-[11px] text-zinc-500">{t('journey.settings.showTripTracksHint')}</span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={`h-5 w-9 flex-shrink-0 rounded-full p-0.5 transition-colors ${journey.show_trip_tracks ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}
                  >
                    <span
                      className={`block h-4 w-4 rounded-full bg-white transition-transform ${journey.show_trip_tracks ? 'translate-x-4' : ''}`}
                    />
                  </span>
                </button>
              </div>
            </div>

            {/* Right column */}
            <div
              className="flex flex-col gap-5 rounded-2xl p-4"
              style={{ background: 'var(--vg-surf2)', border: '1px solid var(--vg-line)' }}
            >
              {/*Synced Trips */}
              <div>
                <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  {t('journey.detail.syncedTrips')}
                </label>
                <div className="flex flex-col gap-1.5">
                  {journey.trips.map((trip: any) => (
                    <div
                      key={trip.trip_id}
                      className="flex items-center gap-2.5 rounded-xl bg-zinc-50 p-2 dark:bg-zinc-800"
                    >
                      <div
                        className="h-8 w-8 flex-shrink-0 rounded-md"
                        style={{ background: pickGradient(trip.trip_id) }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] font-medium text-zinc-900 dark:text-white">{trip.title}</div>
                        <div className="text-[10px] text-zinc-500">
                          {trip.place_count || 0} {t('journey.synced.places')}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setUnlinkTarget({ trip_id: trip.trip_id, title: trip.title })}
                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-500 transition-colors hover:bg-red-500/20 dark:bg-red-500/15 dark:hover:bg-red-500/25"
                        title="Unlink trip"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {journey.trips.length === 0 && (
                    <p className="text-[11px] text-zinc-400">{t('journey.trips.noTripsLinkedSettings')}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowAddTrip(true)}
                    className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-300 py-2.5 text-[12px] font-medium text-zinc-500 transition-colors hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-600 dark:hover:border-zinc-500 dark:hover:text-zinc-300"
                  >
                    <Plus size={14} /> {t('journey.trips.addTrip')}
                  </button>
                </div>
              </div>

              {/* Contributors */}
              <div>
                <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  {t('journey.detail.contributors')}
                </label>
                <div className="flex flex-col gap-2">
                  {journey.contributors.map((c: any) => (
                    <div key={c.user_id} className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 text-[11px] font-semibold text-white dark:bg-white dark:text-zinc-900">
                        {(c.username || '?')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 text-[12px] font-medium text-zinc-900 dark:text-white">{c.username}</div>
                      <span
                        className="shrink-0 rounded-full font-semibold uppercase"
                        style={{
                          fontSize: 8.5,
                          letterSpacing: '0.05em',
                          padding: '2px 7px',
                          ...(c.role === 'owner'
                            ? { background: 'var(--vg-ink)', color: 'var(--vg-bg)' }
                            : {
                                background: 'color-mix(in srgb, var(--vg-ink3) 14%, transparent)',
                                color: 'var(--vg-ink2)',
                              }),
                        }}
                      >
                        {c.role}
                      </span>
                      {c.role !== 'owner' && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (!window.confirm(t('journey.contributors.removeConfirm', { username: c.username })))
                              return;
                            try {
                              await journeyApi.removeContributor(journey.id, c.user_id);
                              toast.success(t('journey.contributors.removed'));
                              onRefresh();
                            } catch {
                              toast.error(t('journey.contributors.removeFailed'));
                            }
                          }}
                          aria-label={t('journey.contributors.remove')}
                          title={t('journey.contributors.remove')}
                          className="flex h-7 w-7 items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={onOpenInvite}
                    className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-300 py-2.5 text-[12px] font-medium text-zinc-500 transition-colors hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-600 dark:hover:border-zinc-500 dark:hover:text-zinc-300"
                  >
                    <UserPlus size={14} /> {t('journey.contributors.invite')}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="h-3" />

          {/* Public Share */}
          <JourneyShareSection journeyId={journey.id} />
        </div>

        {/* Footer */}
        <div className="flex items-center gap-1.5 border-t border-zinc-200 bg-zinc-50 px-4 py-4 pb-6 dark:border-zinc-700 dark:bg-zinc-800/50 md:px-6 md:pb-4">
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            aria-label={t('journey.settings.delete')}
            title={t('journey.settings.delete')}
            className="flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-full px-3 text-[12px] font-semibold text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 md:px-3.5"
          >
            <Trash2 size={14} />
            <span className="hidden md:inline">{t('journey.settings.delete')}</span>
          </button>
          <button
            type="button"
            onClick={handleArchiveToggle}
            disabled={archiving}
            aria-label={
              journey.status === 'archived' ? t('journey.settings.reopenJourney') : t('journey.settings.endJourney')
            }
            title={t('journey.settings.endDescription')}
            className="mr-auto flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-full px-3 text-[12px] font-semibold text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-700 md:px-3.5"
          >
            {journey.status === 'archived' ? <ArchiveRestore size={14} /> : <Archive size={14} />}
            <span className="hidden md:inline">
              {journey.status === 'archived' ? t('journey.settings.reopenJourney') : t('journey.settings.endJourney')}
            </span>
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="h-10 rounded-full border border-zinc-200 px-4 text-[13px] font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="h-10 rounded-full bg-zinc-900 px-5 text-[13px] font-semibold text-white transition-colors hover:bg-zinc-800 disabled:opacity-40 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
          >
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </div>

      {/* Unlink Trip confirm */}
      <ConfirmDialog
        isOpen={!!unlinkTarget}
        onClose={() => setUnlinkTarget(null)}
        onConfirm={async () => {
          if (!unlinkTarget) return;
          try {
            await journeyApi.removeTrip(journey.id, unlinkTarget.trip_id);
            toast.success(t('journey.trips.tripUnlinked'));
            setUnlinkTarget(null);
            onSaved();
          } catch {
            toast.error(t('journey.trips.unlinkFailed'));
          }
        }}
        title={t('journey.trips.unlinkTrip')}
        message={t('journey.trips.unlinkMessage', { title: unlinkTarget?.title })}
        confirmLabel={t('journey.trips.unlink')}
        danger
      />

      {/* Add Trip — sits inside the backdrop, so its clicks have to be kept
          from bubbling into the close/discard handler underneath */}
      {showAddTrip && (
        <div role="presentation" onClick={(e) => e.stopPropagation()}>
          <AddTripDialog
            journeyId={journey.id}
            existingTripIds={journey.trips.map((t: any) => t.trip_id)}
            onClose={() => setShowAddTrip(false)}
            onAdded={() => {
              setShowAddTrip(false);
              onSaved();
            }}
          />
        </div>
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title={t('journey.settings.deleteJourney')}
        message={t('journey.settings.deleteMessage', { title: journey.title })}
        confirmLabel={t('common.delete')}
        danger
      />

      <ConfirmDialog
        isOpen={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        onConfirm={() => {
          setShowDiscardConfirm(false);
          onClose();
        }}
        title={t('common.discardChanges')}
        message={t('journey.editor.discardChangesConfirm')}
        confirmLabel={t('common.discard')}
        danger
      />
    </div>
  );
}
