import { Copy, Edit2, Link2, Plus, Shield, Trash2, UserPlus } from 'lucide-react';
import React from 'react';
import PermissionsPanel from '../../components/Admin/PermissionsPanel';
import CustomSelect from '../../components/shared/CustomSelect';
import Modal from '../../components/shared/Modal';
import type { TranslationFn } from '../../types';
import type { useAdmin } from './useAdmin';

interface AdminUsersTabProps {
  admin: ReturnType<typeof useAdmin>;
  t: TranslationFn;
  locale: string;
}

// "Users" admin tab: user table, invite links, permissions panel + the
// create-invite modal. Pure layout around the useAdmin hook — no logic of its own.
export default function AdminUsersTab({ admin, t, locale }: AdminUsersTabProps): React.ReactElement {
  const {
    hour12,
    currentUser,
    users,
    isLoading,
    setShowCreateUser,
    invites,
    inviteTrips,
    showCreateInvite,
    setShowCreateInvite,
    inviteForm,
    setInviteForm,
    copyInviteLink,
    handleCreateInvite,
    handleDeleteInvite,
    handleEditUser,
    handleDeleteUser,
  } = admin;

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div>
            <h2 className="font-semibold text-slate-900">{t('admin.tabs.users')}</h2>
            <p className="mt-1 text-xs text-slate-400">
              {users.length} {t('admin.stats.users')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateUser(true)}
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white transition-colors hover:bg-slate-700"
          >
            <UserPlus className="h-4 w-4" />
            {t('admin.createUser')}
          </button>
        </div>

        {isLoading ? (
          <div className="p-8 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3">{t('admin.table.user')}</th>
                  <th className="px-5 py-3">{t('admin.table.email')}</th>
                  <th className="px-5 py-3">{t('admin.table.role')}</th>
                  <th className="px-5 py-3">{t('admin.table.created')}</th>
                  <th className="px-5 py-3">{t('admin.table.lastLogin')}</th>
                  <th className="px-5 py-3 text-right">{t('admin.table.actions')}</th>
                </tr>
              </thead>
              <tbody className="trek-stagger divide-y divide-slate-100">
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className={`transition-colors hover:bg-slate-50 ${u.id === currentUser?.id ? 'bg-slate-50/60' : ''}`}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt={u.username} className="h-8 w-8 rounded-full object-cover" />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm font-medium text-slate-700">
                              {u.username.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface-card ${u.online ? 'bg-[#22c55e]' : 'bg-[#94a3b8]'}`}
                          />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{u.username}</p>
                          {u.id === currentUser?.id && <span className="text-xs text-slate-500">{t('admin.you')}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600">{u.email}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          u.role === 'admin' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {u.role === 'admin' && <Shield className="h-3 w-3" />}
                        {u.role === 'admin' ? t('settings.roleAdmin') : t('settings.roleUser')}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-500">
                      {new Date(u.created_at).toLocaleDateString(locale)}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-500">
                      {u.last_login
                        ? new Date(u.last_login).toLocaleDateString(locale, {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12,
                          })
                        : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleEditUser(u)}
                          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900"
                          title={t('admin.editUser')}
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(u)}
                          disabled={u.id === currentUser?.id}
                          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                          title={t('admin.deleteUserTitle')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invite Links (inside users tab) */}
      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div>
            <h2 className="font-semibold text-slate-900">{t('admin.invite.title')}</h2>
            <p className="mt-1 text-xs text-slate-400">{t('admin.invite.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateInvite(true)}
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white transition-colors hover:bg-slate-700"
          >
            <Plus className="h-4 w-4" />
            {t('admin.invite.create')}
          </button>
        </div>

        {invites.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">{t('admin.invite.empty')}</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {invites.map((inv) => {
              const isExpired = inv.expires_at && new Date(inv.expires_at) < new Date();
              const isUsedUp = inv.max_uses > 0 && inv.used_count >= inv.max_uses;
              const isActive = !isExpired && !isUsedUp;
              return (
                <div key={inv.id} className="flex items-center gap-4 px-5 py-3">
                  <Link2 className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-content' : 'text-[#d1d5db]'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <code className="truncate font-mono text-xs text-slate-600">{inv.token.slice(0, 12)}...</code>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${
                          isActive ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {isUsedUp
                          ? t('admin.invite.usedUp')
                          : isExpired
                            ? t('admin.invite.expired')
                            : t('admin.invite.active')}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-400">
                      {inv.used_count}/{inv.max_uses === 0 ? '∞' : inv.max_uses} {t('admin.invite.uses')}
                      {inv.expires_at &&
                        ` · ${t('admin.invite.expiresAt')} ${new Date(inv.expires_at).toLocaleDateString(locale)}`}
                      {inv.trip_title && ` · ${t('admin.invite.boundTo', { trip: inv.trip_title })}`}
                      {` · ${t('admin.invite.createdBy')} ${inv.created_by_name}`}
                    </div>
                  </div>
                  {isActive && (
                    <button
                      type="button"
                      onClick={() => copyInviteLink(inv.token)}
                      title={t('admin.invite.copyLink')}
                      className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteInvite(inv.id)}
                    title={t('common.delete')}
                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-6">
        <PermissionsPanel />
      </div>

      {/* Create Invite Modal */}
      <Modal
        isOpen={showCreateInvite}
        onClose={() => setShowCreateInvite(false)}
        title={t('admin.invite.create')}
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t('admin.invite.maxUses')}
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5, 0].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setInviteForm((f) => ({ ...f, max_uses: n }))}
                  className={`flex-1 rounded-lg border py-2 text-sm font-semibold transition-colors ${
                    inviteForm.max_uses === n
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
                  }`}
                >
                  {n === 0 ? '∞' : `${n}×`}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t('admin.invite.expiry')}
            </label>
            <div className="flex gap-2">
              {[
                { value: 1, label: '1d' },
                { value: 3, label: '3d' },
                { value: 7, label: '7d' },
                { value: 14, label: '14d' },
                { value: '', label: '∞' },
              ].map((opt) => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => setInviteForm((f) => ({ ...f, expires_in_days: opt.value as number | '' }))}
                  className={`flex-1 rounded-lg border py-2 text-sm font-semibold transition-colors ${
                    inviteForm.expires_in_days === opt.value
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {inviteTrips.length > 0 && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t('admin.invite.tripLabel')}
              </label>
              <CustomSelect
                value={inviteForm.trip_id}
                onChange={(v) => setInviteForm((f) => ({ ...f, trip_id: v === '' ? '' : Number(v) }))}
                options={[
                  { value: '', label: t('admin.invite.tripNone') },
                  ...inviteTrips.map((tr) => ({ value: tr.id, label: tr.title })),
                ]}
                searchable={inviteTrips.length > 8}
                placeholder={t('admin.invite.tripNone')}
              />
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{t('admin.invite.tripHint')}</p>
            </div>
          )}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-2">
            <button
              type="button"
              onClick={() => setShowCreateInvite(false)}
              className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleCreateInvite}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700"
            >
              {t('admin.invite.createAndCopy')}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
