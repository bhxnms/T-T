import { Check, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { authApi, journeyApi } from '../../api/client';
import { useTranslation } from '../../i18n';
import { useToast } from '../shared/Toast';

export default function ContributorInviteDialog({
  journeyId,
  existingUserIds,
  onClose,
  onInvited,
}: {
  journeyId: number;
  existingUserIds: number[];
  onClose: () => void;
  onInvited: () => void;
}) {
  const { t } = useTranslation();
  const [users, setUsers] = useState<{ id: number; username: string; email: string; avatar?: string | null }[]>([]);
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [role, setRole] = useState<'editor' | 'viewer'>('viewer');
  const [sending, setSending] = useState(false);
  const toast = useToast();

  useEffect(() => {
    authApi
      .listUsers()
      .then((d) => setUsers(d.users || []))
      .catch(() => {});
  }, []);

  const filtered = users.filter((u) => {
    if (existingUserIds.includes(u.id)) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const handleInvite = async () => {
    if (!selectedUserId) return;
    setSending(true);
    try {
      await journeyApi.addContributor(journeyId, selectedUserId, role);
      toast.success(t('journey.contributors.added'));
      onInvited();
    } catch {
      toast.error(t('journey.contributors.addFailed'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[rgba(9,9,11,0.75)] p-5">
      <div className="flex w-full max-w-[420px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_20px_40px_rgba(0,0,0,0.2)] dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-700">
          <h2 className="text-[16px] font-bold text-zinc-900 dark:text-white">{t('journey.contributors.invite')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-6 py-5">
          {/* Search */}
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
              {t('journey.contributors.searchUser')}
            </label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('journey.contributors.searchPlaceholder')}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[13px] text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-zinc-500"
            />
          </div>

          {/* User list */}
          <div className="flex max-h-[200px] flex-col gap-1 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="py-4 text-center text-[12px] text-zinc-400">{t('journey.contributors.noUsers')}</p>
            )}
            {filtered.map((u) => (
              <button
                type="button"
                key={u.id}
                onClick={() => setSelectedUserId(u.id)}
                className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg p-2.5 text-left transition-all ${
                  selectedUserId === u.id
                    ? 'border border-zinc-900 bg-zinc-100 dark:border-white dark:bg-zinc-800'
                    : 'border border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-[12px] font-semibold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                  {u.username[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-zinc-900 dark:text-white">{u.username}</div>
                  <div className="truncate text-[11px] text-zinc-500">{u.email}</div>
                </div>
                {selectedUserId === u.id && (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900">
                    <Check size={12} />
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Role selector */}
          <div>
            <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
              {t('journey.invite.role')}
            </label>
            <div className="flex gap-2">
              {(['viewer', 'editor'] as const).map((r) => (
                <button
                  type="button"
                  key={r}
                  onClick={() => setRole(r)}
                  className={`flex-1 rounded-lg border py-2 text-[12px] font-medium transition-all ${
                    role === r
                      ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900'
                      : 'border-zinc-200 text-zinc-500 hover:border-zinc-400 dark:border-zinc-700'
                  }`}
                >
                  {t(`journey.invite.${r}`)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-6 py-4 dark:border-zinc-700 dark:bg-zinc-800/50">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-200 px-3.5 py-2 text-[13px] font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleInvite}
            disabled={!selectedUserId || sending}
            className="rounded-lg bg-zinc-900 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
          >
            {sending ? t('journey.invite.inviting') : t('journey.invite.invite')}
          </button>
        </div>
      </div>
    </div>
  );
}
