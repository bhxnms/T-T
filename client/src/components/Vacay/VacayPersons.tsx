import { Check, Clock, Loader2, UserPlus, X } from 'lucide-react';
import { useEffect, useState, type HTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import apiClient from '../../api/client';
import { useTranslation } from '../../i18n';
import { useAuthStore } from '../../store/authStore';
import { useVacayStore } from '../../store/vacayStore';
import { getApiErrorMessage } from '../../types';
import CustomSelect from '../shared/CustomSelect';
import { useToast } from '../shared/Toast';
import VacayBadge from './VacayBadge';

const PRESET_COLORS = [
  '#6366f1',
  '#ec4899',
  '#14b8a6',
  '#8b5cf6',
  '#ef4444',
  '#3b82f6',
  '#22c55e',
  '#06b6d4',
  '#f43f5e',
  '#a855f7',
  '#10b981',
  '#0ea5e9',
  '#64748b',
  '#be185d',
  '#0d9488',
];

export default function VacayPersons() {
  const { t } = useTranslation();
  const toast = useToast();
  const { users, pendingInvites, invite, cancelInvite, updateColor, selectedUserId, setSelectedUserId, isFused } =
    useVacayStore();
  const { user: currentUser } = useAuthStore();

  // Default selectedUserId to current user
  useEffect(() => {
    if (!selectedUserId && currentUser) setSelectedUserId(currentUser.id);
  }, [currentUser, selectedUserId]);
  const [showInvite, setShowInvite] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [colorEditUserId, setColorEditUserId] = useState(null);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [selectedInviteUser, setSelectedInviteUser] = useState(null);
  const [inviting, setInviting] = useState(false);

  const loadAvailable = async () => {
    try {
      const data = await apiClient.get('/addons/vacay/available-users').then((r) => r.data);
      setAvailableUsers(data.users);
    } catch {
      /* */
    }
  };

  const handleInvite = async () => {
    if (!selectedInviteUser) return;
    setInviting(true);
    try {
      await invite(selectedInviteUser);
      toast.success(t('vacay.inviteSent'));
      setShowInvite(false);
      setSelectedInviteUser(null);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, t('vacay.inviteError')));
    } finally {
      setInviting(false);
    }
  };

  const handleColorChange = async (color: string) => {
    await updateColor(color, colorEditUserId);
    setShowColorPicker(false);
    setColorEditUserId(null);
  };

  const editingUserColor = users.find((u) => u.id === colorEditUserId)?.color || '#6366f1';

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
          {t('vacay.persons')}
        </span>
        <button
          type="button"
          onClick={() => {
            setShowInvite(true);
            loadAvailable();
          }}
          className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
          style={{ color: 'var(--vg-ink3)' }}
        >
          <UserPlus size={15} />
        </button>
      </div>

      <div className="flex flex-col gap-1">
        {users.map((u) => {
          const isSelected = selectedUserId === u.id;
          // Only a fused plan lets you pick whose leave you are looking at, so the
          // row takes focus and keys only then — it stays a div because the colour
          // dot inside it is a button of its own.
          const select: HTMLAttributes<HTMLDivElement> = isFused
            ? {
                role: 'button',
                tabIndex: 0,
                onClick: () => setSelectedUserId(u.id),
                onKeyDown: (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedUserId(u.id);
                  }
                },
              }
            : {};
          return (
            <div
              key={u.id}
              {...select}
              className="group flex items-center gap-2.5 transition-colors"
              style={{
                padding: '7px 10px',
                borderRadius: 12,
                cursor: isFused ? 'pointer' : 'default',
                background: isSelected ? 'var(--vg-surf2)' : 'transparent',
                border: `1px solid ${isSelected ? 'var(--vg-line)' : 'transparent'}`,
              }}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setColorEditUserId(u.id);
                  setShowColorPicker(true);
                }}
                className="h-3 w-3 shrink-0 rounded-full transition-transform hover:scale-125"
                style={{ backgroundColor: u.color, cursor: 'pointer' }}
                title={t('vacay.changeColor')}
              />
              <span className="min-w-0 truncate" style={{ fontSize: 13, fontWeight: 600, color: 'var(--vg-ink)' }}>
                {u.username}
              </span>
              {u.id === currentUser?.id && <VacayBadge label={t('vacay.you')} />}
              {isSelected && isFused && (
                <Check size={15} strokeWidth={2.4} className="ml-auto" style={{ color: 'var(--vg-ink2)' }} />
              )}
            </div>
          );
        })}

        {/* Pending invites */}
        {pendingInvites.map((inv) => (
          <div
            key={inv.user_id}
            className="group flex items-center gap-2.5"
            style={{ padding: '7px 10px', borderRadius: 12, background: 'var(--vg-surf2)', opacity: 0.7 }}
          >
            <Clock size={13} style={{ color: 'var(--vg-ink3)' }} />
            <span className="min-w-0 truncate" style={{ fontSize: 13, color: 'var(--vg-ink2)' }}>
              {inv.username}
            </span>
            <VacayBadge label={t('vacay.pending')} tone="amber" />
            <button
              type="button"
              onClick={() => cancelInvite(inv.user_id)}
              className="ml-auto rounded px-1.5 py-0.5 text-[10px] opacity-0 transition-all group-hover:opacity-100"
              style={{ color: 'var(--vg-ink3)' }}
            >
              {t('common.cancel')}
            </button>
          </div>
        ))}
      </div>

      {/* Invite Modal — Portal to body to avoid z-index issues */}
      {showInvite &&
        createPortal(
          <div
            className="trek-backdrop-enter fixed inset-0 flex items-center justify-center bg-[rgba(15,23,42,0.5)] px-4"
            style={{ zIndex: 99990, paddingTop: 70 }}
            role="presentation"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowInvite(false);
            }}
          >
            <div className="trek-modal-enter w-full max-w-sm rounded-2xl bg-surface-card shadow-2xl">
              <div className="flex items-center justify-between border-b border-edge-secondary p-5">
                <h2 className="text-base font-semibold text-content">{t('vacay.inviteUser')}</h2>
                <button
                  type="button"
                  onClick={() => setShowInvite(false)}
                  className="rounded-lg p-1.5 text-content-faint transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-4 p-5">
                <p className="text-xs text-content-muted">{t('vacay.inviteHint')}</p>
                {availableUsers.length === 0 ? (
                  <p className="py-4 text-center text-xs text-content-faint">{t('vacay.noUsersAvailable')}</p>
                ) : (
                  <CustomSelect
                    value={selectedInviteUser}
                    onChange={setSelectedInviteUser}
                    options={availableUsers.map((u) => ({ value: u.id, label: `${u.username} (${u.email})` }))}
                    placeholder={t('vacay.selectUser')}
                    searchable
                  />
                )}
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowInvite(false)}
                    className="rounded-lg border border-edge px-4 py-2 text-sm text-content-muted"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleInvite}
                    disabled={!selectedInviteUser || inviting}
                    className="flex items-center gap-1.5 rounded-lg bg-content px-4 py-2 text-sm text-surface-card transition-colors disabled:opacity-40"
                  >
                    {inviting && <Loader2 size={13} className="animate-spin" />}
                    {t('vacay.sendInvite')}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Color Picker Modal — Portal to body */}
      {showColorPicker &&
        createPortal(
          <div
            className="trek-backdrop-enter fixed inset-0 flex items-center justify-center bg-[rgba(15,23,42,0.5)] px-4"
            style={{ zIndex: 99990, paddingTop: 70 }}
            role="presentation"
            onClick={(e) => {
              if (e.target !== e.currentTarget) return;
              setShowColorPicker(false);
              setColorEditUserId(null);
            }}
          >
            <div className="trek-modal-enter w-full max-w-xs rounded-2xl bg-surface-card shadow-2xl">
              <div className="flex items-center justify-between border-b border-edge-secondary p-5">
                <h2 className="text-base font-semibold text-content">{t('vacay.changeColor')}</h2>
                <button
                  type="button"
                  onClick={() => {
                    setShowColorPicker(false);
                    setColorEditUserId(null);
                  }}
                  className="rounded-lg p-1.5 text-content-faint transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="p-5">
                <div className="flex flex-wrap justify-center gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => handleColorChange(c)}
                      className={`h-8 w-8 rounded-full transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] ${editingUserColor === c ? 'scale-110 ring-2 ring-offset-2' : 'hover:scale-110'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
