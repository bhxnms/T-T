import { Eye, EyeOff, Loader2, Share2, X } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import apiClient from '../../api/client';
import { useTranslation } from '../../i18n';
import { useVacayStore } from '../../store/vacayStore';
import { getApiErrorMessage } from '../../types';
import CustomSelect from '../shared/CustomSelect';
import { useToast } from '../shared/Toast';
import VacayBadge from './VacayBadge';

/**
 * Sidebar card for read-only calendar sharing (#444/#667). Deliberately separate
 * from the Persons card: Persons is the fusion (merge) feature, this card only
 * grants view access. Incoming rows toggle that person's calendar overlay.
 */
export default function VacaySharedCalendars() {
  const { t } = useTranslation();
  const toast = useToast();
  const { outgoingShares, incomingShares, shareWith, removeShare, setShareHidden } = useVacayStore();

  const [showShare, setShowShare] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<{ id: number; username: string }[]>([]);
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [sharing, setSharing] = useState(false);

  const loadAvailable = async () => {
    try {
      const data = await apiClient.get('/addons/vacay/shares/available-users').then((r) => r.data);
      setAvailableUsers(data.users);
    } catch {
      /* */
    }
  };

  const handleShare = async () => {
    if (!selectedUser) return;
    setSharing(true);
    try {
      await shareWith(selectedUser);
      toast.success(t('vacay.shareSent'));
      setShowShare(false);
      setSelectedUser(null);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, t('vacay.shareFailed')));
    } finally {
      setSharing(false);
    }
  };

  // The optimistic hide and the removals reject on server errors — surface them
  // instead of leaving an unhandled rejection behind a silently reverted toggle.
  const handleToggleHidden = (id: number, hidden: boolean) => {
    setShareHidden(id, hidden).catch((err: unknown) => toast.error(getApiErrorMessage(err, t('vacay.shareFailed'))));
  };
  const handleRemove = (id: number) => {
    removeShare(id).catch((err: unknown) => toast.error(getApiErrorMessage(err, t('vacay.shareFailed'))));
  };

  const empty = incomingShares.length === 0 && outgoingShares.length === 0;

  return (
    <div className="vg-card rounded-[22px]" style={{ padding: '14px 18px' }}>
      <div className="mb-2 flex items-center justify-between">
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
            color: 'var(--vg-ink3)',
          }}
        >
          {t('vacay.sharedCalendars')}
        </span>
        <button
          type="button"
          onClick={() => {
            setShowShare(true);
            loadAvailable();
          }}
          className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
          style={{ color: 'var(--vg-ink3)' }}
          title={t('vacay.shareCalendar')}
        >
          <Share2 size={14} />
        </button>
      </div>

      {empty && <p style={{ fontSize: 12, color: 'var(--vg-ink3)', lineHeight: 1.5 }}>{t('vacay.sharedEmpty')}</p>}

      {incomingShares.length > 0 && (
        <div className="flex flex-col gap-1">
          {incomingShares.map((s) => (
            <div
              key={s.id}
              role="button"
              // No press-scale on the row: shrinking it mid-click slides the remove X
              // out from under the pointer, so the click retargets onto the row and
              // toggles visibility instead of removing the share (#2158).
              data-no-press
              tabIndex={0}
              onClick={() => handleToggleHidden(s.id, !s.hidden)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleToggleHidden(s.id, !s.hidden);
                }
              }}
              className="group flex cursor-pointer items-center gap-2.5 transition-colors"
              style={{ padding: '7px 10px', borderRadius: 12, opacity: s.hidden ? 0.55 : 1 }}
              title={s.hidden ? t('vacay.showInCalendar') : t('vacay.hideFromCalendar')}
            >
              {/* Ring dot — mirrors how shared days render in the grid (outline, not fill). */}
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ border: `2.5px solid ${s.color}` }} />
              <span className="min-w-0 truncate" style={{ fontSize: 13, fontWeight: 600, color: 'var(--vg-ink)' }}>
                {s.username}
              </span>
              <VacayBadge label={t('vacay.viewOnly')} />
              <span className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(s.id);
                  }}
                  className="flex h-5 w-5 items-center justify-center rounded opacity-0 transition-all group-hover:opacity-100"
                  style={{ color: 'var(--vg-ink3)' }}
                  title={t('vacay.remove')}
                >
                  <X size={12} />
                </button>
                {s.hidden ? (
                  <EyeOff size={14} style={{ color: 'var(--vg-ink3)' }} />
                ) : (
                  <Eye size={14} style={{ color: 'var(--vg-ink2)' }} />
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {outgoingShares.length > 0 && (
        <div className="flex flex-col gap-1" style={{ marginTop: incomingShares.length > 0 ? 10 : 0 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--vg-ink3)',
              padding: '0 10px',
            }}
          >
            {t('vacay.youShareWith')}
          </span>
          {outgoingShares.map((s) => (
            <div
              key={s.id}
              className="group flex items-center gap-2.5"
              style={{ padding: '5px 10px', borderRadius: 12 }}
            >
              <Share2 size={12} style={{ color: 'var(--vg-ink3)' }} />
              <span className="min-w-0 truncate" style={{ fontSize: 13, color: 'var(--vg-ink2)' }}>
                {s.username}
              </span>
              <button
                type="button"
                onClick={() => handleRemove(s.id)}
                className="ml-auto rounded px-1.5 py-0.5 text-[10px] opacity-0 transition-all group-hover:opacity-100"
                style={{ color: 'var(--vg-ink3)' }}
              >
                {t('vacay.stopSharing')}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Share Modal — Portal to body to avoid z-index issues */}
      {showShare &&
        createPortal(
          <div
            className="trek-backdrop-enter fixed inset-0 flex items-center justify-center bg-[rgba(15,23,42,0.5)] px-4"
            style={{ zIndex: 99990, paddingTop: 70 }}
            role="presentation"
            onClick={() => setShowShare(false)}
          >
            <div
              className="trek-modal-enter w-full max-w-sm rounded-2xl bg-surface-card shadow-2xl"
              role="presentation"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-edge-secondary p-5">
                <h2 className="text-base font-semibold text-content">{t('vacay.shareCalendar')}</h2>
                <button
                  type="button"
                  onClick={() => setShowShare(false)}
                  className="rounded-lg p-1.5 text-content-faint transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-4 p-5">
                <p className="text-xs text-content-muted">{t('vacay.shareCalendarHint')}</p>
                {availableUsers.length === 0 ? (
                  <p className="py-4 text-center text-xs text-content-faint">{t('vacay.noUsersAvailable')}</p>
                ) : (
                  <CustomSelect
                    value={selectedUser}
                    onChange={(v) => setSelectedUser(Number(v))}
                    options={availableUsers.map((u) => ({ value: u.id, label: u.username }))}
                    placeholder={t('vacay.selectUser')}
                    searchable
                  />
                )}
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowShare(false)}
                    className="rounded-lg border border-edge px-4 py-2 text-sm text-content-muted"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleShare}
                    disabled={!selectedUser || sharing}
                    className="flex items-center gap-1.5 rounded-lg bg-content px-4 py-2 text-sm text-surface-card transition-colors disabled:opacity-40"
                  >
                    {sharing && <Loader2 size={13} className="animate-spin" />}
                    {t('vacay.share')}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
