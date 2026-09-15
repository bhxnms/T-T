import type { CollectionMember, CollectionRole } from '@trek/shared';
import { Clock, Crown, Loader2, LogOut, UserMinus, UserPlus } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { collectionsApi } from '../../api/collections';
import { useAuthStore } from '../../store/authStore';
import { useCollectionStore } from '../../store/collectionStore';
import type { TranslationFn } from '../../types';
import { getApiErrorMessage } from '../../utils/apiError';
import { avatarSrc } from '../../utils/avatarSrc';
import CustomSelect from '../shared/CustomSelect';
import Modal from '../shared/Modal';
import { useToast } from '../shared/Toast';

interface ShareCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  collectionId: number;
  collectionName: string;
  isOwner: boolean;
  members: CollectionMember[];
  /** Called after the current (member) user successfully leaves the list. */
  onAfterLeave: () => void;
  t: TranslationFn;
}

const ROLE_ORDER: CollectionRole[] = ['viewer', 'editor', 'admin'];

function MemberAvatar({ member }: { member: CollectionMember }): React.ReactElement {
  const initial = (member.username || '?').charAt(0).toUpperCase();
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-secondary text-[12px] font-semibold text-content-secondary">
      {member.avatar ? <img src={avatarSrc(member.avatar)!} alt="" className="h-full w-full object-cover" /> : initial}
    </span>
  );
}

/**
 * Fusion-share surface for a single list (blueprint 4.4 / 4.8). The OWNER sees the
 * member roster with accepted/pending status, can invite a user from
 * GET /:id/available-users and cancel a pending invite. A non-owner MEMBER sees the
 * roster read-only plus a "Leave shared list" action (the server blocks the owner
 * from leaving). Incoming invites are accepted/declined from the lists rail, not here.
 */
export default function ShareCollectionModal({
  isOpen,
  onClose,
  collectionId,
  collectionName,
  isOwner,
  members,
  onAfterLeave,
  t,
}: ShareCollectionModalProps): React.ReactElement | null {
  const toast = useToast();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const invite = useCollectionStore((s) => s.invite);
  const cancelInvite = useCollectionStore((s) => s.cancelInvite);
  const removeMember = useCollectionStore((s) => s.removeMember);
  const setMemberRole = useCollectionStore((s) => s.setMemberRole);
  const leave = useCollectionStore((s) => s.leave);

  const [availableUsers, setAvailableUsers] = useState<{ id: number; username: string }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | ''>('');
  const [inviteRole, setInviteRole] = useState<CollectionRole>('editor');
  const [settingRoleId, setSettingRoleId] = useState<number | null>(null);
  const [inviting, setInviting] = useState(false);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Load the invitable users whenever an owner opens the modal.
  useEffect(() => {
    if (!isOpen || !isOwner) return;
    let cancelled = false;
    collectionsApi
      .availableUsers(collectionId)
      .then((data) => {
        if (!cancelled) setAvailableUsers(data.users);
      })
      .catch(() => {
        if (!cancelled) setAvailableUsers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, isOwner, collectionId, members.length]);

  // Reset transient state on close.
  useEffect(() => {
    if (!isOpen) {
      setSelectedUserId('');
      setConfirmLeave(false);
    }
  }, [isOpen]);

  const sortedMembers = useMemo(() => {
    // Owner first, then accepted, then pending — alphabetised within each band.
    const rank = (m: CollectionMember) => (m.is_owner ? 0 : m.status === 'accepted' ? 1 : 2);
    return [...members].sort((a, b) => rank(a) - rank(b) || a.username.localeCompare(b.username));
  }, [members]);

  if (!isOpen) return null;

  const handleInvite = async () => {
    if (selectedUserId === '' || inviting) return;
    setInviting(true);
    try {
      await invite(collectionId, Number(selectedUserId), inviteRole);
      toast.success(t('collections.invite.sent'));
      setSelectedUserId('');
    } catch (err) {
      toast.error(getApiErrorMessage(err, t('collections.invite.error')));
    } finally {
      setInviting(false);
    }
  };

  const handleSetRole = async (userId: number, role: CollectionRole) => {
    if (settingRoleId != null) return;
    setSettingRoleId(userId);
    try {
      await setMemberRole(collectionId, userId, role);
    } catch (err) {
      toast.error(getApiErrorMessage(err, t('common.error')));
    } finally {
      setSettingRoleId(null);
    }
  };

  const handleCancel = async (userId: number) => {
    if (cancellingId != null) return;
    setCancellingId(userId);
    try {
      await cancelInvite(collectionId, userId);
    } catch (err) {
      toast.error(getApiErrorMessage(err, t('common.error')));
    } finally {
      setCancellingId(null);
    }
  };

  const handleRemove = async (userId: number) => {
    if (removingId != null) return;
    setRemovingId(userId);
    try {
      await removeMember(collectionId, userId);
    } catch (err) {
      toast.error(getApiErrorMessage(err, t('common.error')));
    } finally {
      setRemovingId(null);
    }
  };

  const handleLeave = async () => {
    setLeaving(true);
    try {
      await leave(collectionId);
      toast.success(t('collections.share.left'));
      onAfterLeave();
    } catch (err) {
      toast.error(getApiErrorMessage(err, t('common.error')));
    } finally {
      setLeaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={t('collections.share.titleNamed', { name: collectionName })} size="xl">
      <div className="flex flex-col gap-5">
        {/* Member roster */}
        <div>
          <h3 className="mb-2.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-content-faint">
            {t('collections.share.members')}
            <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-surface-secondary px-1 text-[10px] font-bold tabular-nums text-content-secondary">
              {sortedMembers.length}
            </span>
          </h3>
          <div className="flex flex-col gap-1.5">
            {sortedMembers.map((member) => {
              const isSelf = member.user_id === currentUserId;
              const pending = member.status === 'pending';
              return (
                <div
                  key={member.user_id}
                  className={`bg-surface-secondary/50 flex items-center gap-3 rounded-xl border border-edge px-3 py-2.5 ${pending ? 'opacity-90' : ''}`}
                >
                  <MemberAvatar member={member} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-[13.5px] font-semibold text-content">
                      {member.username}
                      {isSelf && (
                        <span className="text-[12px] font-normal text-content-faint">
                          ({t('collections.share.you')})
                        </span>
                      )}
                    </p>
                    {member.email && !pending && (
                      <p className="truncate text-[11.5px] text-content-faint">{member.email}</p>
                    )}
                  </div>
                  {member.is_owner ? (
                    <span className="bg-amber-500/12 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10.5px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                      <Crown size={11} /> {t('collections.share.owner')}
                    </span>
                  ) : pending ? (
                    <span className="bg-amber-500/12 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10.5px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                      <Clock size={11} /> {t('collections.share.pending')}
                    </span>
                  ) : isOwner ? (
                    <div className="w-[118px] shrink-0">
                      <CustomSelect
                        size="sm"
                        value={member.role ?? 'editor'}
                        onChange={(v) => handleSetRole(member.user_id, v as CollectionRole)}
                        options={ROLE_ORDER.map((r) => ({ value: r, label: t(`collections.role.${r}`) }))}
                        disabled={settingRoleId === member.user_id}
                      />
                    </div>
                  ) : (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-secondary px-2 py-1 text-[10.5px] font-semibold uppercase tracking-wide text-content-secondary">
                      {t(`collections.role.${member.role ?? 'editor'}`)}
                    </span>
                  )}
                  {isOwner && pending && (
                    <button
                      type="button"
                      onClick={() => handleCancel(member.user_id)}
                      disabled={cancellingId === member.user_id}
                      className="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium text-content-faint transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-50"
                    >
                      {cancellingId === member.user_id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        t('collections.share.cancel')
                      )}
                    </button>
                  )}
                  {isOwner && !member.is_owner && member.status === 'accepted' && (
                    <button
                      type="button"
                      onClick={() => handleRemove(member.user_id)}
                      disabled={removingId === member.user_id}
                      title={t('collections.share.remove')}
                      aria-label={t('collections.share.remove')}
                      className="shrink-0 rounded-md p-1 text-content-faint transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-50"
                    >
                      {removingId === member.user_id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <UserMinus size={13} />
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {isOwner ? (
          /* Owner: invite UI */
          <div className="border-t border-edge-secondary pt-1">
            <h3 className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wider text-content-faint">
              {t('collections.share.invite')}
            </h3>
            <p className="mb-3 text-[12px] text-content-muted">{t('collections.share.inviteHint')}</p>
            {availableUsers.length === 0 ? (
              <p className="py-3 text-center text-[12px] text-content-faint">{t('collections.share.noUsers')}</p>
            ) : (
              <div className="flex items-stretch gap-2">
                <div className="min-w-0 flex-1">
                  <CustomSelect
                    value={selectedUserId}
                    onChange={(v) => setSelectedUserId(v === '' ? '' : Number(v))}
                    options={availableUsers.map((u) => ({ value: u.id, label: u.username }))}
                    placeholder={t('collections.share.inviteUser')}
                    searchable
                  />
                </div>
                <div className="w-[128px] shrink-0">
                  <CustomSelect
                    size="sm"
                    value={inviteRole}
                    onChange={(v) => setInviteRole(v as CollectionRole)}
                    options={ROLE_ORDER.map((r) => ({ value: r, label: t(`collections.role.${r}`) }))}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleInvite}
                  disabled={selectedUserId === '' || inviting}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-accent-text transition-colors hover:bg-accent-hover disabled:opacity-50"
                >
                  {inviting ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                  <span className="hidden sm:inline">{t('collections.share.sendInvite')}</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Member: read-only roster + leave */
          <div className="border-t border-edge-secondary pt-1">
            <p className="mb-3 mt-4 text-[12px] text-content-muted">{t('collections.share.memberHint')}</p>
            {confirmLeave ? (
              <div className="flex flex-col gap-2.5">
                <p className="text-[13px] text-content-secondary">{t('collections.share.leaveConfirm')}</p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmLeave(false)}
                    className="rounded-lg border border-edge px-3 py-1.5 text-[13px] text-content-secondary transition-colors hover:bg-surface-hover"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleLeave}
                    disabled={leaving}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-danger px-3 py-1.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {leaving ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
                    {t('collections.share.leave')}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmLeave(true)}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-edge px-3 py-2 text-[13px] font-medium text-danger transition-colors hover:bg-danger-soft"
              >
                <LogOut size={14} /> {t('collections.share.leave')}
              </button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
