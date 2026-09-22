import { safeFetchAdminConfigured } from '../../utils/ssrfGuard';

/**
 * A thin client over the slice of Cloudflare's API this feature needs.
 *
 * Hand-rolled rather than pulled from an SDK: three endpoints and one auth
 * header do not justify a dependency, and the project ships no Cloudflare
 * library today. Every call goes through safeFetchAdminConfigured so a
 * redirected response is re-checked per hop, though the host is a fixed public
 * one and never user-supplied.
 *
 * Cloudflare answers `{success, errors, result}` for both success and failure,
 * so the body is parsed before the status is judged: a 403 with a readable
 * message ("Invalid API Token") is far more useful to an operator than the
 * status code alone.
 */

const API_BASE = 'https://api.cloudflare.com/client/v4';
const TIMEOUT_MS = 15_000;

interface CfEnvelope<T> {
  success?: boolean;
  errors?: { code?: number; message?: string }[];
  result?: T;
}

export class CloudflareApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'CloudflareApiError';
  }
}

/**
 * One API call. `accountId` is optional because token verification is an
 * accountless endpoint.
 *
 * The token is passed as a Bearer credential, never appended to the URL, so it
 * cannot leak into an access log or an error message that quotes the URL.
 */
async function call<T>(path: string, token: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await safeFetchAdminConfigured(
      `${API_BASE}${path}`,
      {
        method: init.method ?? 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
      2,
      TIMEOUT_MS,
    );
  } catch (err) {
    throw new CloudflareApiError(
      err instanceof Error ? `Could not reach Cloudflare: ${err.message}` : 'Could not reach Cloudflare',
    );
  }

  const text = await res.text().catch(() => '');
  let body: CfEnvelope<T> | null = null;
  try {
    body = text ? (JSON.parse(text) as CfEnvelope<T>) : null;
  } catch {
    /* non-JSON body — fall through to the status-based message */
  }

  if (!res.ok || body?.success === false) {
    // Cloudflare's own message is the actionable part; it names the offending
    // permission or the malformed field.
    const detail = body?.errors
      ?.map((e) => e.message)
      .filter(Boolean)
      .join('; ');
    if (res.status === 401 || res.status === 403) {
      throw new CloudflareApiError(detail || 'Cloudflare rejected the API token', res.status);
    }
    throw new CloudflareApiError(detail || `Cloudflare returned HTTP ${res.status}`, res.status);
  }

  return body?.result as T;
}

/** The account a token belongs to, or the token is rejected. */
export async function verifyToken(token: string): Promise<{ id: string; name: string } | null> {
  const result = await call<{ id: string; name: string } | null>('/user/tokens/verify', token);
  // A verified token with no account scope answers success with a null result;
  // the caller treats that as "not usable here" rather than an error.
  return result ?? null;
}

/** Tunnel names already in the account, so a typo is visible before saving. */
export async function listTunnelNames(accountId: string, token: string): Promise<string[]> {
  const result = await call<{ name?: string }[]>(`/accounts/${accountId}/cfd_tunnel?is_deleted=false`, token);
  return (result ?? []).map((t) => t.name).filter((n): n is string => !!n);
}

/** A tunnel as the API returns it, reduced to what this feature uses. */
export interface CfTunnel {
  id: string;
  name: string;
  /** Present only on the single-tunnel fetch; the connector runs on this. */
  token?: string;
}

export async function findTunnelByName(accountId: string, token: string, name: string): Promise<CfTunnel | null> {
  const result = await call<{ id?: string; name?: string }[]>(
    `/accounts/${accountId}/cfd_tunnel?is_deleted=false&name=${encodeURIComponent(name)}`,
    token,
  );
  const hit = (result ?? []).find((t) => t.name === name);
  return hit?.id && hit.name ? { id: hit.id, name: hit.name } : null;
}

/**
 * Create a remotely-managed tunnel. Cloudflare generates the connector token,
 * which is what the sidecar authenticates with — the operator never has to run
 * `cloudflared tunnel create` or handle a credentials file.
 */
export async function createTunnel(accountId: string, token: string, name: string): Promise<CfTunnel> {
  const result = await call<{ id?: string; name?: string; token?: string }>(
    `/accounts/${accountId}/cfd_tunnel`,
    token,
    {
      method: 'POST',
      // config_src 'cloudflare' is what makes this remotely managed: the ingress
      // rules live in Cloudflare's config rather than in a local config.yml.
      body: { name, config_src: 'cloudflare' },
    },
  );
  if (!result?.id) throw new CloudflareApiError('Cloudflare did not return a tunnel id');
  return { id: result.id, name: result.name ?? name, token: result.token };
}

/** The connector token for an existing tunnel (Cloudflare mints one on demand). */
export async function getTunnelToken(accountId: string, token: string, tunnelId: string): Promise<string | null> {
  const result = await call<string>(`/accounts/${accountId}/cfd_tunnel/${tunnelId}/token`, token);
  return typeof result === 'string' && result ? result : null;
}

/**
 * Write the tunnel's ingress rules: the public hostname to the local app, and a
 * catch-all 404. Remotely-managed tunnels keep these server-side, so this is
 * what saves the operator from editing a config.yml at all.
 */
export async function putTunnelConfiguration(
  accountId: string,
  token: string,
  tunnelId: string,
  opts: { hostname: string; service: string },
): Promise<void> {
  await call<unknown>(`/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`, token, {
    method: 'PUT',
    body: {
      config: {
        ingress: [{ hostname: opts.hostname, service: opts.service }, { service: 'http_status:404' }],
      },
    },
  });
}

/**
 * Point the hostname at the tunnel. Creates the DNS record when it is missing,
 * updates it when it already exists (an A/CNAME from a previous setup would
 * otherwise shadow the tunnel), and answers the record id either way.
 */
export async function upsertTunnelDns(
  accountId: string,
  token: string,
  opts: { zoneId: string; hostname: string; tunnelId: string },
): Promise<void> {
  const content = `${opts.tunnelId}.cfargotunnel.com`;
  const existing = await call<{ id?: string; content?: string }[]>(
    `/zones/${opts.zoneId}/dns_records?name=${encodeURIComponent(opts.hostname)}`,
    token,
  );
  const record = (existing ?? [])[0];

  if (record?.id) {
    // Already pointing at this tunnel — leave it alone (rewriting would be a
    // no-op that still churns the record's metadata).
    if (record.content === content) return;
    await call<unknown>(`/zones/${opts.zoneId}/dns_records/${record.id}`, token, {
      method: 'PUT',
      body: { type: 'CNAME', name: opts.hostname, content, proxied: true, ttl: 1 },
    });
    return;
  }

  await call<unknown>(`/zones/${opts.zoneId}/dns_records`, token, {
    method: 'POST',
    body: { type: 'CNAME', name: opts.hostname, content, proxied: true, ttl: 1 },
  });
}

/** The zone that owns a hostname, or null when the account has no such zone. */
export async function findZoneIdForHostname(
  accountId: string,
  token: string,
  hostname: string,
): Promise<string | null> {
  const zones = await call<{ id?: string; name?: string }[]>(`/zones?account.id=${accountId}&per_page=50`, token);
  const labels = hostname.split('.');
  // Longest suffix match wins, so a zone for example.com is not preferred over
  // one for sub.example.com when both exist.
  let best: { id: string; name: string } | null = null;
  for (const zone of zones ?? []) {
    if (!zone.id || !zone.name) continue;
    const suffix = labels.slice(-zone.name.split('.').length).join('.');
    if (suffix.toLowerCase() !== zone.name.toLowerCase()) continue;
    if (!best || zone.name.length > best.name.length) best = { id: zone.id, name: zone.name };
  }
  return best?.id ?? null;
}
