import type { CloudflareTunnelState, CloudflareTunnelTestResult } from '@trek/shared';
import { CheckCircle2, Cloud, Copy, Eye, EyeOff, Loader2, RefreshCw, Save, XCircle } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../../api/client';
import Section from '../../components/Settings/Section';
import Button from '../../components/shared/Button';
import { useToast } from '../../components/shared/Toast';
import type { TranslationFn } from '../../types';
import { getApiErrorMessage } from '../../types';

interface AdminTunnelTabProps {
  t: TranslationFn;
}

/** What the last probe said. Rendered as a badge, not a toast — it stays readable. */
type Probe = CloudflareTunnelTestResult | null;

const fieldCls =
  'w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-content outline-none focus:border-accent disabled:opacity-60';
const labelCls = 'mb-1 block text-xs font-semibold text-content-secondary';
const hintCls = 'mt-1 text-xs text-content-faint';

/**
 * Admin → Cloudflare Tunnel.
 *
 * For operators who cannot set up a tunnel themselves. Off by default, and
 * while it is off this panel writes nothing and the server ignores the stored
 * hostname entirely — an operator already running their own cloudflared, nginx
 * or Caddy is unaffected by this tab existing.
 *
 * The connector itself is NOT run by the app: the shipped container has a
 * read-only rootfs with dropped capabilities, so cloudflared lives in a
 * sidecar. This panel's job is credentials + verification + the config to
 * paste, and it says so plainly rather than implying a tunnel is running.
 */
export default function AdminTunnelTab({ t }: AdminTunnelTabProps): React.ReactElement {
  const toast = useToast();
  const [state, setState] = useState<CloudflareTunnelState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [probe, setProbe] = useState<Probe>(null);
  const [showToken, setShowToken] = useState(false);
  const [connector, setConnector] = useState<{
    available: boolean;
    compose?: string | null;
    command?: string;
    env?: string;
    target?: string;
  } | null>(null);
  const [provisioning, setProvisioning] = useState(false);
  // The connector token is shown once, right after provisioning: it is the one
  // secret the operator still has to carry to the sidecar, and the app does not
  // keep a copy.
  const [connectorToken, setConnectorToken] = useState<string | null>(null);

  // Form mirrors state once loaded; the token starts as the mask and is only
  // sent back when the operator actually retypes it.
  const [accountId, setAccountId] = useState('');
  const [token, setToken] = useState('');
  const [tunnelName, setTunnelName] = useState('');
  const [hostname, setHostname] = useState('');
  const [serviceHost, setServiceHost] = useState('app');
  const [servicePort, setServicePort] = useState('3000');

  const applyState = useCallback((next: CloudflareTunnelState) => {
    setState(next);
    setAccountId(next.account_id);
    setToken(next.api_token);
    setTunnelName(next.tunnel_name);
    setHostname(next.hostname);
    setServiceHost(next.service_host);
    // From the server's own listening port rather than a constant: it is the one
    // component that knows which port it actually bound (the portable Windows
    // launcher picks a free one and never tells it otherwise), so a hardcoded
    // default here would aim the connector at a port nothing is listening on.
    setServicePort(String(next.service_port));
  }, []);

  const loadConnector = useCallback(() => {
    adminApi
      .getTunnelConnector()
      .then(setConnector)
      .catch(() => setConnector(null));
  }, []);

  useEffect(() => {
    adminApi
      .getTunnel()
      .then((next) => {
        applyState(next);
        if (next.provisioned) loadConnector();
      })
      .catch((err) => toast.error(getApiErrorMessage(err, t('admin.tunnel.loadError'))))
      .finally(() => setLoading(false));
    // Loads once on mount; the toast helper and t are stable enough here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enabled = state?.enabled ?? false;

  const save = async (patch?: Record<string, unknown>) => {
    setSaving(true);
    try {
      const next = await adminApi.updateTunnel({
        account_id: accountId,
        api_token: token,
        tunnel_name: tunnelName,
        hostname,
        service_host: serviceHost,
        service_port: Number.parseInt(servicePort, 10) || 3000,
        ...patch,
      });
      applyState(next);
      setProbe(null);
      // A save that invalidated the previous provisioning (hostname, tunnel
      // name, account or port changed) clears the connector command, because it
      // would no longer describe the tunnel that exists.
      setConnectorToken(null);
      setConnector(null);
      if (next.provisioned) loadConnector();
      toast.success(t('admin.tunnel.saved'));
    } catch (err) {
      toast.error(getApiErrorMessage(err, t('admin.tunnel.saveError')));
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    setTesting(true);
    setProbe(null);
    try {
      const result = await adminApi.testTunnel({ account_id: accountId, api_token: token });
      setProbe(result);
    } catch (err) {
      setProbe({ success: false, error: getApiErrorMessage(err, t('admin.tunnel.testError')) });
    } finally {
      setTesting(false);
    }
  };

  /**
   * Create the tunnel on Cloudflare's side, write its ingress rules and point
   * DNS at it. This is what saves the operator from running `cloudflared tunnel
   * create` or writing a config.yml — all they do afterwards is run the sidecar
   * with the token this returns.
   */
  const runProvision = async () => {
    setProvisioning(true);
    setConnectorToken(null);
    try {
      const result = await adminApi.provisionTunnel();
      if (result.success && result.connector_token) {
        setConnectorToken(result.connector_token);
        await adminApi.getTunnel().then(applyState);
        loadConnector();
        toast.success(t('admin.tunnel.provisioned'));
      } else {
        toast.error(probeErrorText(result.error));
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, t('admin.tunnel.provisionError')));
    } finally {
      setProvisioning(false);
    }
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard
      ?.writeText(text)
      .then(() => toast.success(t('admin.tunnel.copied', { what: label })))
      .catch(() => toast.error(t('admin.tunnel.copyError')));
  };

  /**
   * The server answers with a code ('missing_token', 'disabled', …) for the
   * cases it names itself, and with Cloudflare's own message for everything
   * else. Only the codes have translations; anything else is shown verbatim,
   * because "Cloudflare rejected the API token" is already the useful text.
   */
  const probeErrorText = (code: string | undefined): string => {
    if (!code) return t('admin.tunnel.testError');
    const key = `admin.tunnel.error.${code}`;
    const translated = t(key);
    return translated === key ? code : translated;
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-content-secondary">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">{t('common.loading')}</span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Section
        title={t('admin.tunnel.title')}
        icon={Cloud}
        badge={
          <span
            className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              enabled ? 'bg-green-500/15 text-green-600' : 'bg-surface-tertiary text-content-faint'
            }`}
          >
            {enabled ? t('admin.tunnel.statusOn') : t('admin.tunnel.statusOff')}
          </span>
        }
      >
        <p className="text-sm text-content-secondary">{t('admin.tunnel.intro')}</p>

        {/* The master switch comes first: everything below is inert while it is off. */}
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-edge bg-surface-secondary p-4">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4"
            checked={enabled}
            disabled={saving}
            onChange={(e) => void save({ enabled: e.target.checked })}
          />
          <span>
            <span className="block text-sm font-semibold text-content">{t('admin.tunnel.enable')}</span>
            <span className="mt-1 block text-xs text-content-faint">{t('admin.tunnel.enableHint')}</span>
          </span>
        </label>

        {!enabled && (
          <p className="rounded-lg border border-edge bg-surface-secondary p-4 text-xs text-content-faint">
            {t('admin.tunnel.disabledNotice')}
          </p>
        )}

        {enabled && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls} htmlFor="cf-account">
                  {t('admin.tunnel.accountId')}
                </label>
                <input
                  id="cf-account"
                  className={fieldCls}
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  placeholder="0123456789abcdef0123456789abcdef"
                  autoComplete="off"
                  spellCheck={false}
                />
                <p className={hintCls}>{t('admin.tunnel.accountIdHint')}</p>
              </div>

              <div>
                <label className={labelCls} htmlFor="cf-token">
                  {t('admin.tunnel.apiToken')}
                </label>
                <div className="relative">
                  <input
                    id="cf-token"
                    className={fieldCls}
                    type={showToken ? 'text' : 'password'}
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-content-faint"
                    aria-label={t('admin.tunnel.toggleTokenVisibility')}
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className={hintCls}>{t('admin.tunnel.apiTokenHint')}</p>
              </div>

              <div>
                <label className={labelCls} htmlFor="cf-tunnel">
                  {t('admin.tunnel.tunnelName')}
                </label>
                <input
                  id="cf-tunnel"
                  className={fieldCls}
                  value={tunnelName}
                  onChange={(e) => setTunnelName(e.target.value)}
                  placeholder="tt-planner"
                  autoComplete="off"
                  spellCheck={false}
                />
                <p className={hintCls}>{t('admin.tunnel.tunnelNameHint')}</p>
              </div>

              <div>
                <label className={labelCls} htmlFor="cf-host">
                  {t('admin.tunnel.hostname')}
                </label>
                <input
                  id="cf-host"
                  className={fieldCls}
                  value={hostname}
                  onChange={(e) => setHostname(e.target.value)}
                  placeholder="tt.example.com"
                  autoComplete="off"
                  spellCheck={false}
                />
                <p className={hintCls}>{t('admin.tunnel.hostnameHint')}</p>
              </div>

              <div>
                <label className={labelCls} htmlFor="cf-host">
                  {t('admin.tunnel.serviceHost')}
                </label>
                <input
                  id="cf-host"
                  className={fieldCls}
                  value={serviceHost}
                  onChange={(e) => setServiceHost(e.target.value)}
                  placeholder={state?.in_docker ? 'app' : 'localhost'}
                  autoComplete="off"
                  spellCheck={false}
                />
                <p className={hintCls}>
                  {state?.in_docker
                    ? t('admin.tunnel.serviceHostHintDocker')
                    : t('admin.tunnel.serviceHostHintNative')}
                </p>
              </div>

              <div>
                <label className={labelCls} htmlFor="cf-port">
                  {t('admin.tunnel.servicePort')}
                </label>
                <input
                  id="cf-port"
                  className={fieldCls}
                  type="number"
                  min={1}
                  max={65535}
                  value={servicePort}
                  onChange={(e) => setServicePort(e.target.value)}
                />
                <p className={hintCls}>
                  {t('admin.tunnel.servicePortHint', { port: String(state?.listening_port ?? '') })}
                </p>
              </div>
            </div>

            {/* Missing pieces, named — so the panel says what to fix. */}
            {state && state.missing.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-content">
                {t('admin.tunnel.missing', {
                  fields: state.missing.map((m) => t(`admin.tunnel.field.${m}`)).join('、'),
                })}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" size="md" onClick={() => void save()} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span className="ml-2">{t('common.save')}</span>
              </Button>
              <Button variant="secondary" size="md" onClick={() => void runTest()} disabled={testing}>
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                <span className="ml-2">{t('admin.tunnel.test')}</span>
              </Button>

              {probe && (
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                    probe.success ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {probe.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  {probe.success
                    ? t('admin.tunnel.testOk', {
                        account: probe.account_name ? ` (${probe.account_name})` : '',
                      })
                    : probeErrorText(probe.error)}
                </span>
              )}
            </div>

            {/* The account's existing tunnels, so a typo in the name is visible. */}
            {probe?.success && probe.tunnels && probe.tunnels.length > 0 && (
              <p className="text-xs text-content-faint">
                {t('admin.tunnel.existingTunnels', { list: probe.tunnels.join(', ') })}
              </p>
            )}
          </>
        )}
      </Section>

      {/* Step 2: create the tunnel on Cloudflare's side, then run the sidecar. */}
      {enabled && state?.configured && (
        <Section title={t('admin.tunnel.connectorTitle')} icon={Cloud}>
          <p className="text-sm text-content-secondary">{t('admin.tunnel.connectorIntro')}</p>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" size="md" onClick={() => void runProvision()} disabled={provisioning}>
              {provisioning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
              <span className="ml-2">
                {state.provisioned ? t('admin.tunnel.reprovision') : t('admin.tunnel.provision')}
              </span>
            </Button>
            {state.provisioned && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                {t('admin.tunnel.provisionedBadge')}
              </span>
            )}
          </div>

          {/* The connector token, shown once. The app does not keep a copy, so
              this is the only moment it can be copied. */}
          {connectorToken && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
              <p className="mb-2 text-xs font-semibold text-content">{t('admin.tunnel.connectorToken')}</p>
              <p className="mb-2 text-xs text-content-secondary">{t('admin.tunnel.connectorTokenHint')}</p>
              <div className="flex items-start gap-2">
                <pre className="flex-1 overflow-x-auto rounded border border-edge bg-surface p-3 text-xs text-content">
                  {connectorToken}
                </pre>
                <button
                  type="button"
                  className="inline-flex flex-none items-center gap-1 text-xs font-semibold text-accent"
                  onClick={() => copy(connectorToken, t('admin.tunnel.connectorToken'))}
                >
                  <Copy className="h-3.5 w-3.5" />
                  {t('common.copy')}
                </button>
              </div>
            </div>
          )}

          {connector?.available ? (
            <div className="space-y-4">
              {/* What the ingress actually points at. Worth showing rather than
                  hiding in a config file: a connector dialling the wrong host or
                  port starts cleanly and answers 502, which is hard to trace. */}
              {connector.target && (
                <p className="text-xs text-content-secondary">
                  {t('admin.tunnel.connectorTarget', { target: connector.target })}
                </p>
              )}

              {/* Compose only when the connector can be a sibling container. A
                  native install (the Windows package, bare metal) has no compose
                  network to join, so it gets the binary instructions alone. */}
              {connector.compose && (
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className={labelCls}>{t('admin.tunnel.connectorCompose')}</span>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-accent"
                      onClick={() => copy(connector.compose!, t('admin.tunnel.connectorCompose'))}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {t('common.copy')}
                    </button>
                  </div>
                  <pre className="overflow-x-auto rounded-lg border border-edge bg-surface-secondary p-3 text-xs text-content">
                    {connector.compose}
                  </pre>
                </div>
              )}

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className={labelCls}>
                    {connector.compose ? t('admin.tunnel.connectorCommand') : t('admin.tunnel.connectorNativeTitle')}
                  </span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-accent"
                    onClick={() => copy(connector.command!, t('admin.tunnel.connectorCommand'))}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {t('common.copy')}
                  </button>
                </div>
                {!connector.compose && (
                  <p className="mb-2 text-xs text-content-secondary">{t('admin.tunnel.connectorNativeIntro')}</p>
                )}
                <pre className="overflow-x-auto rounded-lg border border-edge bg-surface-secondary p-3 text-xs text-content">
                  {connector.command}
                </pre>
              </div>

              <div className="rounded-lg border border-edge bg-surface-secondary p-4 text-xs text-content-secondary">
                <p className="mb-2 font-semibold text-content">{t('admin.tunnel.envTitle')}</p>
                <p className="mb-2">{t('admin.tunnel.envIntro')}</p>
                <pre className="overflow-x-auto rounded border border-edge bg-surface p-3 text-content">
                  {connector.env}
                </pre>
                <p className="mt-2">{t('admin.tunnel.envHint')}</p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-content-faint">{t('admin.tunnel.connectorUnavailable')}</p>
          )}
        </Section>
      )}
    </div>
  );
}
