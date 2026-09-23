import { decrypt_api_key, maybe_encrypt_api_key } from '../common/crypto/apiKeyCrypto';
import { DatabaseService } from '../database/database.service';
import {
  CloudflareApiError,
  createTunnel,
  findTunnelByName,
  findZoneIdForHostname,
  getTunnelToken,
  listTunnelNames,
  putTunnelConfiguration,
  upsertTunnelDns,
  verifyToken,
} from './cloudflare.client';
import { Injectable } from '@nestjs/common';
import { MASKED_SETTING_VALUE } from '@trek/shared';
import type {
  CloudflareTunnelState,
  CloudflareTunnelTestResult,
  CloudflareTunnelProvisionResult,
  CloudflareTunnelConfigPut,
} from '@trek/shared';

/**
 * The app_settings keys this feature owns. Prefixed so they cannot collide with
 * the flat names ADMIN_SETTINGS_KEYS already uses.
 */
export const TUNNEL_KEYS = {
  enabled: 'cloudflare_tunnel_enabled',
  accountId: 'cloudflare_tunnel_account_id',
  token: 'cloudflare_tunnel_token',
  tunnelName: 'cloudflare_tunnel_name',
  hostname: 'cloudflare_tunnel_hostname',
  servicePort: 'cloudflare_tunnel_service_port',
  /** Set once provisioning succeeds, so the panel knows the tunnel exists. */
  tunnelId: 'cloudflare_tunnel_id',
} as const;

/** Every key above, for the encryption-rotation list and the managed-key ledger. */
export const TUNNEL_SETTING_KEYS: string[] = Object.values(TUNNEL_KEYS);

/**
 * The port a connector should use to reach this app inside its Docker network.
 * Matches the container's fixed listen port; exposed as a setting only because
 * a compose user may rename the service or front it differently.
 */
const DEFAULT_SERVICE_PORT = 3000;

/**
 * Cloudflare Tunnel configuration (the "operator cannot set this up by hand"
 * path).
 *
 * Off by default, and the switch is load-bearing rather than cosmetic: while
 * `cloudflare_tunnel_enabled` is not 'true' the state reads as disabled, the
 * probe refuses, and nothing in the app consults the stored hostname. An
 * operator who already runs their own cloudflared, nginx or Caddy is therefore
 * untouched by this feature's existence — including its presence in the admin
 * sidebar — and can keep configuring their tunnel however they always have.
 *
 * The token is encrypted at rest (AES-256-GCM, the same helper as the other
 * instance secrets) and is only ever rendered back as the mask.
 *
 * This service does NOT run cloudflared. It stores credentials, verifies them,
 * and hands the operator the config to paste into a sidecar. See the class doc
 * on TunnelController for why the connector stays outside this container.
 */
@Injectable()
export class TunnelService {
  constructor(private readonly db: DatabaseService) {}

  private read(key: string): string | null {
    const row = this.db.get<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', key);
    return row?.value ?? null;
  }

  private write(key: string, value: string): void {
    this.db.run('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', key, value);
  }

  /** The master switch. Anything other than an explicit 'true' is off. */
  isEnabled(): boolean {
    return this.read(TUNNEL_KEYS.enabled) === 'true';
  }

  /**
   * The stored token in the clear, or null. Returns null while disabled, so a
   * caller that forgot the gate still cannot reach Cloudflare with it.
   */
  private token(): string | null {
    if (!this.isEnabled()) return null;
    const stored = this.read(TUNNEL_KEYS.token);
    return stored ? decrypt_api_key(stored) : null;
  }

  private servicePort(): number {
    const raw = Number.parseInt(this.read(TUNNEL_KEYS.servicePort) ?? '', 10);
    return Number.isSafeInteger(raw) && raw >= 1 && raw <= 65535 ? raw : DEFAULT_SERVICE_PORT;
  }

  /**
   * What the admin panel renders. Always answerable — an unconfigured or
   * disabled install gets a valid state with everything empty, never a 404, so
   * the panel does not have to special-case a fresh setup.
   */
  state(): CloudflareTunnelState {
    const enabled = this.isEnabled();
    const accountId = this.read(TUNNEL_KEYS.accountId) ?? '';
    const hasToken = !!this.read(TUNNEL_KEYS.token);
    const tunnelName = this.read(TUNNEL_KEYS.tunnelName) ?? '';
    const hostname = this.read(TUNNEL_KEYS.hostname) ?? '';
    const servicePort = this.servicePort();

    // Which pieces are missing, named so the panel can show a checklist rather
    // than a bare "incomplete".
    const missing: string[] = [];
    if (!accountId) missing.push('account_id');
    if (!hasToken) missing.push('api_token');
    if (!tunnelName) missing.push('tunnel_name');
    if (!hostname) missing.push('hostname');

    return {
      enabled,
      account_id: accountId,
      api_token: hasToken ? MASKED_SETTING_VALUE : '',
      tunnel_name: tunnelName,
      hostname,
      service_port: servicePort,
      configured: missing.length === 0,
      missing,
      public_url: hostname ? `https://${hostname}` : null,
      provisioned: !!this.read(TUNNEL_KEYS.tunnelId),
    };
  }

  /**
   * Persist a partial update from the admin form.
   *
   * Two conventions to note: echoing the mask back means "keep the stored
   * token" (never overwrite it with the literal mask), and an empty string
   * clears a field. The token is encrypted here, so no caller can store it in
   * the clear by accident.
   */
  update(patch: CloudflareTunnelConfigPut): void {
    // A change to any field the tunnel was built from invalidates the previous
    // provisioning: the tunnel id on Cloudflare no longer describes what the
    // form now says, so the panel must offer to create it again rather than
    // showing a connector command that no longer matches.
    const invalidatesProvisioning =
      (patch.account_id !== undefined && patch.account_id.trim() !== (this.read(TUNNEL_KEYS.accountId) ?? '')) ||
      (patch.tunnel_name !== undefined && patch.tunnel_name.trim() !== (this.read(TUNNEL_KEYS.tunnelName) ?? '')) ||
      (patch.hostname !== undefined && patch.hostname.trim() !== (this.read(TUNNEL_KEYS.hostname) ?? '')) ||
      (patch.service_port !== undefined && patch.service_port !== this.servicePort());

    if (patch.enabled !== undefined) {
      this.write(TUNNEL_KEYS.enabled, patch.enabled ? 'true' : 'false');
    }
    if (patch.account_id !== undefined) {
      this.write(TUNNEL_KEYS.accountId, patch.account_id.trim());
    }
    if (patch.tunnel_name !== undefined) {
      this.write(TUNNEL_KEYS.tunnelName, patch.tunnel_name.trim());
    }
    if (patch.hostname !== undefined) {
      this.write(TUNNEL_KEYS.hostname, patch.hostname.trim());
    }
    if (patch.service_port !== undefined) {
      this.write(TUNNEL_KEYS.servicePort, String(patch.service_port));
    }
    if (patch.api_token !== undefined) {
      const value = patch.api_token.trim();
      // The mask means "unchanged" — the panel re-sends whatever GET returned.
      if (value !== MASKED_SETTING_VALUE) {
        this.write(TUNNEL_KEYS.token, value ? (maybe_encrypt_api_key(value) ?? '') : '');
      }
    }

    if (invalidatesProvisioning) this.write(TUNNEL_KEYS.tunnelId, '');
  }

  /**
   * Verify a token against Cloudflare and list the account's tunnels.
   *
   * Never throws: a rejected credential is an answer the panel renders, not a
   * 500. A token the request carries overrides the stored one so the operator
   * can test before saving; the mask falls back to the stored value.
   */
  async test(input: { account_id?: string; api_token?: string }): Promise<CloudflareTunnelTestResult> {
    if (!this.isEnabled()) {
      return { success: false, error: 'disabled' };
    }

    const accountId = (input.account_id?.trim() || this.read(TUNNEL_KEYS.accountId) || '').trim();
    const typed = input.api_token?.trim();
    const token = !typed || typed === MASKED_SETTING_VALUE ? (this.token() ?? '') : typed;
    if (!token) return { success: false, error: 'missing_token' };

    try {
      const verified = await verifyToken(token);
      if (!verified) {
        // A valid token with no account scope: it works, it just cannot manage
        // tunnels. Say that rather than reporting success and failing later.
        return { success: false, error: 'token_has_no_account' };
      }
      if (!accountId) {
        // Token is good and we know its account — hand the id back so the
        // operator does not have to dig it out of the dashboard.
        return { success: true, account_name: verified.name };
      }
      const tunnels = await listTunnelNames(accountId, token);
      return { success: true, account_name: verified.name, tunnels };
    } catch (err) {
      if (err instanceof CloudflareApiError) return { success: false, error: err.message };
      return { success: false, error: err instanceof Error ? err.message : 'unknown_error' };
    }
  }

  /**
   * Create or reconcile the tunnel on Cloudflare's side: the tunnel itself, its
   * ingress rules, and the DNS record for the hostname. Answers the connector
   * token the sidecar authenticates with.
   *
   * This is the whole point of the feature — it is what lets somebody who has
   * never run cloudflared get a working tunnel without `cloudflared tunnel
   * create`, a credentials file, or hand-written config.yml. Everything is
   * remotely managed: the ingress rules live in Cloudflare's config, so the
   * sidecar needs nothing but the token.
   *
   * Idempotent: an existing tunnel of the same name is reused, its config
   * overwritten with the current hostname, and its DNS record left alone when
   * it already points at this tunnel. Running it twice is safe.
   *
   * Never throws — failures come back as a message the panel renders.
   */
  async provision(): Promise<CloudflareTunnelProvisionResult> {
    if (!this.isEnabled()) return { success: false, error: 'disabled' };

    const st = this.state();
    if (!st.configured) return { success: false, error: 'incomplete' };

    const accountId = this.read(TUNNEL_KEYS.accountId) ?? '';
    const token = this.token();
    if (!token) return { success: false, error: 'missing_token' };

    const service = `http://app:${this.servicePort()}`;

    try {
      const zoneId = await findZoneIdForHostname(accountId, token, st.hostname);
      if (!zoneId) return { success: false, error: 'no_zone_for_hostname' };

      // Reuse the tunnel when the name is taken; otherwise create one. A
      // remotely-managed tunnel is what keeps the ingress server-side.
      let tunnel = await findTunnelByName(accountId, token, st.tunnel_name);
      let connectorToken: string | null = null;
      if (!tunnel) {
        // Create answers the connector token inline — the only time Cloudflare
        // hands it over without a second call.
        const created = await createTunnel(accountId, token, st.tunnel_name);
        tunnel = { id: created.id, name: created.name };
        connectorToken = created.token ?? null;
      }

      await putTunnelConfiguration(accountId, token, tunnel.id, { hostname: st.hostname, service });
      await upsertTunnelDns(accountId, token, { zoneId, hostname: st.hostname, tunnelId: tunnel.id });

      // An existing tunnel's token is not returned by the list endpoint, so it
      // is fetched on demand.
      connectorToken ??= await getTunnelToken(accountId, token, tunnel.id);
      if (!connectorToken) return { success: false, error: 'no_connector_token' };

      this.write(TUNNEL_KEYS.tunnelId, tunnel.id);

      return { success: true, tunnel_id: tunnel.id, connector_token: connectorToken, public_url: st.public_url! };
    } catch (err) {
      if (err instanceof CloudflareApiError) return { success: false, error: err.message };
      return { success: false, error: err instanceof Error ? err.message : 'unknown_error' };
    }
  }

  /**
   * What the operator has to run, and nothing else.
   *
   * Token mode means no config.yml: the ingress rules were written to
   * Cloudflare by provision(), so the sidecar is one command with one secret.
   * Null until provisioning has actually happened, so the panel cannot show a
   * command that would fail.
   */
  connectorConfig(): { compose: string; command: string; env: string } | null {
    if (!this.isEnabled()) return null;
    const st = this.state();
    if (!st.configured || !st.public_url) return null;
    // Gated on provisioning, not just on the form being complete: the snippet
    // references a tunnel that only exists once provision() has run, and the two
    // states are independent — a hostname edit invalidates provisioning while
    // leaving every field filled. The panel happens to check `provisioned` before
    // asking, but that is the caller's guard; this method's contract says the
    // command is only available once the tunnel exists, so it enforces it here
    // rather than depending on who is asking.
    if (!st.provisioned) return null;

    const tokenVar = '${CLOUDFLARE_TUNNEL_TOKEN}';
    return {
      compose: [
        'tunnel:',
        '  image: cloudflare/cloudflared:latest',
        '  restart: unless-stopped',
        `  command: tunnel --no-autoupdate run --token ${tokenVar}`,
        '  depends_on:',
        '    - app',
      ].join('\n'),
      command: `cloudflared tunnel --no-autoupdate run --token <连接器令牌>`,
      env: [`APP_URL=${st.public_url}`, 'TRUST_PROXY=1'].join('\n'),
    };
  }
}
