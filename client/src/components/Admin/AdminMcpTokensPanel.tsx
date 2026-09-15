import { Key, Loader2, Shield, Trash2, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { adminApi } from '../../api/client';
import { useTranslation } from '../../i18n';
import { useToast } from '../shared/Toast';

interface AdminOAuthSession {
  id: number;
  client_id: string;
  client_name: string;
  user_id: number;
  username: string;
  scopes: string[];
  access_token_expires_at: string;
  refresh_token_expires_at: string;
  created_at: string;
}

interface AdminMcpToken {
  id: number;
  name: string;
  token_prefix: string;
  created_at: string;
  last_used_at: string | null;
  user_id: number;
  username: string;
}

const SCOPES_PREVIEW = 6;

export default function AdminMcpTokensPanel() {
  const [sessions, setSessions] = useState<AdminOAuthSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [tokens, setTokens] = useState<AdminMcpToken[]>([]);
  const [tokensLoading, setTokensLoading] = useState(true);
  const [expandedScopes, setExpandedScopes] = useState<Set<number>>(new Set());
  const [revokeConfirmId, setRevokeConfirmId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const toggleScopes = (id: number) =>
    setExpandedScopes((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const toast = useToast();
  const { t, locale } = useTranslation();

  useEffect(() => {
    adminApi
      .oauthSessions()
      .then((d) => setSessions(d.sessions || []))
      .catch(() => toast.error(t('admin.oauthSessions.loadError')))
      .finally(() => setSessionsLoading(false));

    adminApi
      .mcpTokens()
      .then((d) => setTokens(d.tokens || []))
      .catch(() => toast.error(t('admin.mcpTokens.loadError')))
      .finally(() => setTokensLoading(false));
  }, []);

  const handleRevoke = async (id: number) => {
    try {
      await adminApi.revokeOAuthSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      setRevokeConfirmId(null);
      toast.success(t('admin.oauthSessions.revokeSuccess'));
    } catch {
      toast.error(t('admin.oauthSessions.revokeError'));
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await adminApi.deleteMcpToken(id);
      setTokens((prev) => prev.filter((tk) => tk.id !== id));
      setDeleteConfirmId(null);
      toast.success(t('admin.mcpTokens.deleteSuccess'));
    } catch {
      toast.error(t('admin.mcpTokens.deleteError'));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-content">{t('admin.mcpTokens.title')}</h2>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--text-tertiary)' }}>
          {t('admin.mcpTokens.subtitle')}
        </p>
      </div>

      {/* OAuth Sessions */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-content-secondary">{t('admin.oauthSessions.sectionTitle')}</h3>
        <div className="overflow-hidden rounded-xl border border-edge bg-surface-card">
          {sessionsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12">
              <Shield className="h-8 w-8" style={{ color: 'var(--text-tertiary)' }} />
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                {t('admin.oauthSessions.empty')}
              </p>
            </div>
          ) : (
            <>
              <div
                className="grid grid-cols-[1fr_auto_auto_auto] gap-x-6 border-b border-edge bg-surface-secondary px-4 py-2.5 text-xs font-medium"
                style={{ color: 'var(--text-tertiary)' }}
              >
                <span>{t('admin.oauthSessions.clientName')}</span>
                <span>{t('admin.oauthSessions.owner')}</span>
                <span className="text-right">{t('admin.oauthSessions.created')}</span>
                <span></span>
              </div>
              {sessions.map((session, i) => {
                const expanded = expandedScopes.has(session.id);
                const visible = expanded ? session.scopes : session.scopes.slice(0, SCOPES_PREVIEW);
                const hidden = session.scopes.length - SCOPES_PREVIEW;
                return (
                  <div
                    key={session.id}
                    className={`grid grid-cols-[1fr_auto_auto_auto] items-start gap-x-6 px-4 py-3 ${i < sessions.length - 1 ? 'border-b border-edge' : ''}`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-content">{session.client_name}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {visible.map((scope) => (
                          <span
                            key={scope}
                            className="inline-flex items-center rounded border border-edge bg-surface-secondary px-1.5 py-0.5 font-mono text-xs"
                            style={{ color: 'var(--text-tertiary)' }}
                          >
                            {scope}
                          </span>
                        ))}
                        {!expanded && hidden > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleScopes(session.id)}
                            className="inline-flex items-center rounded border border-edge bg-surface-secondary px-1.5 py-0.5 text-xs font-medium text-content-secondary transition-colors hover:opacity-80"
                          >
                            +{hidden} more
                          </button>
                        )}
                        {expanded && hidden > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleScopes(session.id)}
                            className="inline-flex items-center rounded border border-edge bg-surface-secondary px-1.5 py-0.5 text-xs font-medium text-content-secondary transition-colors hover:opacity-80"
                          >
                            show less
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 pt-0.5 text-sm text-content-secondary">
                      <User className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="whitespace-nowrap">{session.username}</span>
                    </div>
                    <span
                      className="whitespace-nowrap pt-0.5 text-right text-xs"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      {new Date(session.created_at).toLocaleDateString(locale)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setRevokeConfirmId(session.id)}
                      className="rounded-lg p-1.5 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                      style={{ color: 'var(--text-tertiary)' }}
                      title={t('common.delete')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* MCP Tokens */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-content-secondary">{t('admin.mcpTokens.sectionTitle')}</h3>
        <div className="overflow-hidden rounded-xl border border-edge bg-surface-card">
          {tokensLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
            </div>
          ) : tokens.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12">
              <Key className="h-8 w-8" style={{ color: 'var(--text-tertiary)' }} />
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                {t('admin.mcpTokens.empty')}
              </p>
            </div>
          ) : (
            <>
              <div
                className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-4 border-b border-edge bg-surface-secondary px-4 py-2.5 text-xs font-medium"
                style={{ color: 'var(--text-tertiary)' }}
              >
                <span>{t('admin.mcpTokens.tokenName')}</span>
                <span>{t('admin.mcpTokens.owner')}</span>
                <span className="text-right">{t('admin.mcpTokens.created')}</span>
                <span className="text-right">{t('admin.mcpTokens.lastUsed')}</span>
                <span></span>
              </div>
              {tokens.map((token, i) => (
                <div
                  key={token.id}
                  className={`grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-x-4 px-4 py-3 ${i < tokens.length - 1 ? 'border-b border-edge' : ''}`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-content">{token.name}</p>
                    <p className="mt-0.5 font-mono text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {token.token_prefix}...
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-content-secondary">
                    <User className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="whitespace-nowrap">{token.username}</span>
                  </div>
                  <span className="whitespace-nowrap text-right text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {new Date(token.created_at).toLocaleDateString(locale)}
                  </span>
                  <span className="whitespace-nowrap text-right text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {token.last_used_at
                      ? new Date(token.last_used_at).toLocaleDateString(locale)
                      : t('admin.mcpTokens.never')}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmId(token.id)}
                    className="rounded-lg p-1.5 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                    style={{ color: 'var(--text-tertiary)' }}
                    title={t('common.delete')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Revoke OAuth session modal */}
      {revokeConfirmId !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,0.5)] p-4"
          role="button"
          tabIndex={0}
          aria-label={t('common.close')}
          onClick={(e) => {
            if (e.target === e.currentTarget) setRevokeConfirmId(null);
          }}
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget) return;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setRevokeConfirmId(null);
            }
          }}
        >
          <div className="w-full max-w-sm space-y-4 rounded-xl bg-surface-card p-6 shadow-xl">
            <h3 className="text-base font-semibold text-content">{t('admin.oauthSessions.revokeTitle')}</h3>
            <p className="text-sm text-content-secondary">{t('admin.oauthSessions.revokeMessage')}</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRevokeConfirmId(null)}
                className="rounded-lg border border-edge px-4 py-2 text-sm text-content-secondary"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => handleRevoke(revokeConfirmId)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete MCP token modal */}
      {deleteConfirmId !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,0.5)] p-4"
          role="button"
          tabIndex={0}
          aria-label={t('common.close')}
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteConfirmId(null);
          }}
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget) return;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setDeleteConfirmId(null);
            }
          }}
        >
          <div className="w-full max-w-sm space-y-4 rounded-xl bg-surface-card p-6 shadow-xl">
            <h3 className="text-base font-semibold text-content">{t('admin.mcpTokens.deleteTitle')}</h3>
            <p className="text-sm text-content-secondary">{t('admin.mcpTokens.deleteMessage')}</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="rounded-lg border border-edge px-4 py-2 text-sm text-content-secondary"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmId)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
