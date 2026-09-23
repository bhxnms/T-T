/**
 * Unit tests for TunnelService and the Cloudflare client contract it drives —
 * TUNNEL-001..018.
 *
 * The load-bearing property here is the OFF state: with the feature disabled
 * nothing is read, nothing is written, and the probe refuses before it can
 * reach Cloudflare. An operator running their own cloudflared, nginx or Caddy
 * must be unaffected by this feature simply existing, so most of these tests
 * assert absence of action rather than a returned value.
 *
 * Uses a real in-memory SQLite DB (repo convention) with only the tables this
 * service touches. The Cloudflare client is stubbed at the module boundary, so
 * no test performs a network call.
 */
import { createTables } from '../../../src/db/schema';
import { decrypt_api_key, is_encrypted_api_key } from '../../../src/nest/common/crypto/apiKeyCrypto';
import { DatabaseService } from '../../../src/nest/database/database.service';
import { TunnelService, TUNNEL_KEYS, TUNNEL_SETTING_KEYS } from '../../../src/nest/tunnel/tunnel.service';
import { MASKED_SETTING_VALUE } from '@trek/shared';

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { testDb } = vi.hoisted(() => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  return { testDb: db };
});

vi.mock('../../../src/db/database', () => ({ db: testDb }));

// The runtime form decides which connector instructions the service renders, and
// it is a module constant probed from the filesystem. Mocked so both branches can
// be exercised deterministically — reading the real value would make the suite
// assert whatever machine it happens to run on (it is false on a dev box and true
// in the container that runs this repo's own CI).
const { mockIsDocker } = vi.hoisted(() => ({ mockIsDocker: { value: false } }));
vi.mock('../../../src/nest/admin/admin.helpers', () => ({
  get isDocker() {
    return mockIsDocker.value;
  },
}));

// The Cloudflare API is stubbed: these tests are about what the service does
// with an answer, never about reaching Cloudflare.
const verifyToken = vi.fn();
const listTunnelNames = vi.fn();
const findZoneIdForHostname = vi.fn();
const findTunnelByName = vi.fn();
const createTunnel = vi.fn();
const getTunnelToken = vi.fn();
const putTunnelConfiguration = vi.fn();
const upsertTunnelDns = vi.fn();
vi.mock('../../../src/nest/tunnel/cloudflare.client', () => ({
  verifyToken: (...args: unknown[]) => verifyToken(...args),
  listTunnelNames: (...args: unknown[]) => listTunnelNames(...args),
  findZoneIdForHostname: (...args: unknown[]) => findZoneIdForHostname(...args),
  findTunnelByName: (...args: unknown[]) => findTunnelByName(...args),
  createTunnel: (...args: unknown[]) => createTunnel(...args),
  getTunnelToken: (...args: unknown[]) => getTunnelToken(...args),
  putTunnelConfiguration: (...args: unknown[]) => putTunnelConfiguration(...args),
  upsertTunnelDns: (...args: unknown[]) => upsertTunnelDns(...args),
  CloudflareApiError: class CloudflareApiError extends Error {
    constructor(
      message: string,
      readonly status?: number,
    ) {
      super(message);
      this.name = 'CloudflareApiError';
    }
  },
}));

const service = new TunnelService(new DatabaseService(testDb as never));

const readRow = (key: string) =>
  (testDb.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value: string } | undefined)?.value;

const complete = {
  enabled: true,
  account_id: '0123456789abcdef0123456789abcdef',
  api_token: 'cf-token-abcdefghijklmnop',
  tunnel_name: 'tt-planner',
  hostname: 'tt.example.com',
  service_port: 3000,
};

beforeEach(() => {
  // createTables is idempotent (CREATE TABLE IF NOT EXISTS), so calling it per
  // test is what lets this file run standalone as well as in the suite.
  createTables(testDb);
  testDb.exec('DELETE FROM app_settings;');
  // Reset per test: a case that switches the runtime form must not leak it into
  // the next one, which would make the suite order-dependent.
  mockIsDocker.value = false;
  verifyToken.mockReset();
  listTunnelNames.mockReset();
  findZoneIdForHostname.mockReset();
  findTunnelByName.mockReset();
  createTunnel.mockReset();
  getTunnelToken.mockReset();
  putTunnelConfiguration.mockReset();
  upsertTunnelDns.mockReset();
});

describe('TunnelService — disabled by default', () => {
  it('TUNNEL-001: a fresh install reads as disabled and unconfigured', () => {
    const state = service.state();
    expect(state.enabled).toBe(false);
    expect(state.configured).toBe(false);
    expect(state.public_url).toBeNull();
    expect(state.missing.sort()).toEqual(['account_id', 'api_token', 'hostname', 'tunnel_name']);
  });

  it('TUNNEL-002: the probe refuses while disabled and never calls Cloudflare', async () => {
    // Even with credentials already stored, a disabled install must not use them.
    service.update(complete);
    testDb.prepare('UPDATE app_settings SET value = ? WHERE key = ?').run('false', TUNNEL_KEYS.enabled);

    const result = await service.test({});

    expect(result).toEqual({ success: false, error: 'disabled' });
    expect(verifyToken).not.toHaveBeenCalled();
  });

  it('TUNNEL-003: no connector config is offered while disabled', () => {
    service.update(complete);
    testDb.prepare('UPDATE app_settings SET value = ? WHERE key = ?').run('false', TUNNEL_KEYS.enabled);
    expect(service.connectorConfig()).toBeNull();
  });

  it('TUNNEL-004: enabling is explicit — any other stored value stays off', () => {
    testDb.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?)').run(TUNNEL_KEYS.enabled, 'yes');
    expect(service.isEnabled()).toBe(false);
  });

  it('TUNNEL-005: disabling preserves the stored credentials', () => {
    // The operator may switch the feature off and back on; losing the token
    // would make turning it off a destructive act.
    service.update(complete);
    service.update({ enabled: false });

    expect(service.state().enabled).toBe(false);
    expect(readRow(TUNNEL_KEYS.token)).toBeTruthy();
    expect(readRow(TUNNEL_KEYS.hostname)).toBe('tt.example.com');

    service.update({ enabled: true });
    expect(service.state().configured).toBe(true);
  });
});

describe('TunnelService — storage', () => {
  it('TUNNEL-006: the token is encrypted at rest and no row holds the clear value', () => {
    service.update(complete);

    const stored = readRow(TUNNEL_KEYS.token)!;
    expect(stored).not.toContain(complete.api_token);
    expect(is_encrypted_api_key(stored)).toBe(true);
    expect(decrypt_api_key(stored)).toBe(complete.api_token);
  });

  it('TUNNEL-007: state reports the mask, never the token', () => {
    service.update(complete);
    const state = service.state();
    expect(state.api_token).toBe(MASKED_SETTING_VALUE);
    expect(JSON.stringify(state)).not.toContain(complete.api_token);
  });

  it('TUNNEL-008: echoing the mask back keeps the stored token', () => {
    service.update(complete);
    const before = readRow(TUNNEL_KEYS.token);

    service.update({ api_token: MASKED_SETTING_VALUE });

    expect(readRow(TUNNEL_KEYS.token)).toBe(before);
  });

  it('TUNNEL-009: an empty token clears it', () => {
    service.update(complete);
    service.update({ api_token: '' });
    expect(readRow(TUNNEL_KEYS.token)).toBe('');
    expect(service.state().missing).toContain('api_token');
  });

  it('TUNNEL-010: a partial save is accepted and reports exactly what is missing', () => {
    service.update({ enabled: true, account_id: complete.account_id, hostname: complete.hostname });

    const state = service.state();
    expect(state.configured).toBe(false);
    expect(state.missing.sort()).toEqual(['api_token', 'tunnel_name']);
  });

  it('TUNNEL-011: the public URL is derived from the hostname', () => {
    service.update(complete);
    expect(service.state().public_url).toBe('https://tt.example.com');
  });

  it('TUNNEL-012: the service port falls back to the port this process listens on', () => {
    // Not a constant: the old hardcoded 3000 was only right inside the Docker
    // image, which fixes its port. The portable Windows package binds 3001 by
    // default (and moves up when that is taken), so a fixed default aimed the
    // connector at a port nothing was listening on.
    service.update({ enabled: true });
    const fallback = service.state().service_port;
    expect(fallback).toBe(service.state().listening_port);
    // The suite sets no PORT, so the app default applies.
    expect(fallback).toBe(3001);

    testDb.prepare('UPDATE app_settings SET value = ? WHERE key = ?').run('not-a-port', TUNNEL_KEYS.servicePort);
    expect(service.state().service_port).toBe(fallback);

    // A nonsense value is ignored the same way an absent one is.
    testDb.prepare('UPDATE app_settings SET value = ? WHERE key = ?').run('0', TUNNEL_KEYS.servicePort);
    expect(service.state().service_port).toBe(fallback);
  });

  it('TUNNEL-012b: the service host defaults to the compose service name', () => {
    service.update({ enabled: true });
    expect(service.state().service_host).toBe('app');

    service.update({ service_host: 'localhost' });
    expect(service.state().service_host).toBe('localhost');

    // A blank value falls back rather than producing `http://:3001`.
    service.update({ service_host: '   ' });
    expect(service.state().service_host).toBe('app');
  });

  it('TUNNEL-013: every setting key is prefixed, so it cannot collide with the flat admin keys', () => {
    for (const key of TUNNEL_SETTING_KEYS) expect(key.startsWith('cloudflare_tunnel_')).toBe(true);
  });
});

describe('TunnelService — probe', () => {
  beforeEach(() => {
    service.update(complete);
  });

  it('TUNNEL-014: a working token with an account lists the existing tunnels', async () => {
    verifyToken.mockResolvedValue({ id: 'acct', name: 'My Account' });
    listTunnelNames.mockResolvedValue(['tt-planner', 'other']);

    const result = await service.test({});

    expect(result).toEqual({ success: true, account_name: 'My Account', tunnels: ['tt-planner', 'other'] });
    expect(verifyToken).toHaveBeenCalledWith(complete.api_token);
  });

  it('TUNNEL-015: a token without account scope is reported as such, not as success', async () => {
    verifyToken.mockResolvedValue(null);

    const result = await service.test({});

    expect(result.success).toBe(false);
    expect(result.error).toBe('token_has_no_account');
  });

  it('TUNNEL-016: a rejected token surfaces Cloudflare’s own message', async () => {
    const { CloudflareApiError } = await import('../../../src/nest/tunnel/cloudflare.client');
    verifyToken.mockRejectedValue(new CloudflareApiError('Invalid API Token', 403));

    const result = await service.test({});

    expect(result).toEqual({ success: false, error: 'Invalid API Token' });
  });

  it('TUNNEL-017: a token typed into the form is used without being saved first', async () => {
    verifyToken.mockResolvedValue({ id: 'acct', name: 'My Account' });
    listTunnelNames.mockResolvedValue([]);

    await service.test({ api_token: 'typed-token-abcdefghijkl' });

    expect(verifyToken).toHaveBeenCalledWith('typed-token-abcdefghijkl');
    // ...and the stored token is untouched by a probe.
    expect(decrypt_api_key(readRow(TUNNEL_KEYS.token)!)).toBe(complete.api_token);
  });

  it('TUNNEL-018: a probe with no token at all is refused before any call', async () => {
    service.update({ api_token: '' });

    const result = await service.test({});

    expect(result).toEqual({ success: false, error: 'missing_token' });
    expect(verifyToken).not.toHaveBeenCalled();
  });
});

describe('TunnelService — connector command', () => {
  /** Provision once, so the connector snippet is allowed to render. */
  async function provisioned(): Promise<void> {
    service.update(complete);
    findZoneIdForHostname.mockResolvedValue('zone-1');
    findTunnelByName.mockResolvedValue(null);
    createTunnel.mockResolvedValue({ id: 'tun-1', name: complete.tunnel_name, token: 'tok' });
    putTunnelConfiguration.mockResolvedValue(undefined);
    upsertTunnelDns.mockResolvedValue(undefined);
    await service.provision();
  }

  it('TUNNEL-019: renders the token-mode sidecar once configured and provisioned (Docker)', async () => {
    mockIsDocker.value = true;
    await provisioned();

    const config = service.connectorConfig()!;

    // Token mode: no credentials file, no config.yml — the ingress rules were
    // written to Cloudflare by provision(), so the sidecar is one command.
    expect(config.compose).toContain('cloudflare/cloudflared:latest');
    expect(config.compose).toContain('--token ${CLOUDFLARE_TUNNEL_TOKEN}');
    expect(config.compose).not.toContain('credentials-file');
    expect(config.env).toContain(`APP_URL=https://${complete.hostname}`);
    expect(config.env).toContain('TRUST_PROXY=1');
    // The ingress dials the compose service name inside the container network.
    // `complete` pins service_port 3000, so the stored value beats the fallback.
    expect(config.target).toBe('http://app:3000');
  });

  it('TUNNEL-019b: a native install gets binary instructions, not a compose block', async () => {
    // The portable Windows package and a bare-metal/LXC install have no compose
    // network: handing them a sidecar block gives them something they cannot run,
    // and `app` is not a hostname that resolves outside it.
    mockIsDocker.value = false;
    await provisioned();

    const config = service.connectorConfig()!;

    expect(config.compose).toBeNull();
    expect(config.command).toContain('cloudflared tunnel');
    expect(config.command).toContain('--token');
    // The command is still token-only: no config file to write.
    expect(config.command).not.toContain('credentials-file');
    expect(config.env).toContain('TRUST_PROXY=1');
    // And the target follows the operator's service_host, not a hardcoded name.
    expect(config.target).toBe('http://app:3000');
  });

  it('TUNNEL-019c: service_host decides what the ingress dials', async () => {
    mockIsDocker.value = false;
    service.update({ ...complete, service_host: 'localhost', service_port: 8080 });
    findZoneIdForHostname.mockResolvedValue('zone-1');
    findTunnelByName.mockResolvedValue(null);
    createTunnel.mockResolvedValue({ id: 'tun-1', name: complete.tunnel_name, token: 'tok' });
    await service.provision();

    // The value provision() wrote into Cloudflare's ingress rules.
    const putCall = putTunnelConfiguration.mock.calls.at(-1);
    expect(putCall?.[3]).toMatchObject({ service: 'http://localhost:8080' });
    expect(service.connectorConfig()!.target).toBe('http://localhost:8080');
  });

  it('TUNNEL-020: nothing is rendered while the configuration is incomplete', () => {
    service.update({ enabled: true, account_id: complete.account_id });
    expect(service.connectorConfig()).toBeNull();
  });

  it('TUNNEL-020b: nothing is rendered before the tunnel exists, however complete the form', () => {
    // The snippet references a tunnel provision() has to create first, and the
    // two states are independent: a hostname edit clears provisioning while
    // leaving every field filled (TUNNEL-025). Without this gate the service
    // handed out a command for a tunnel that did not exist — it was the panel's
    // own `provisioned` check that hid it, so every other caller was exposed.
    service.update(complete);
    expect(service.state().configured).toBe(true);
    expect(service.state().provisioned).toBe(false);

    expect(service.connectorConfig()).toBeNull();
  });

  it('TUNNEL-020c: an invalidating edit takes the snippet away again', async () => {
    await provisioned();
    expect(service.connectorConfig()).not.toBeNull();

    // Changing the hostname means the existing tunnel no longer matches what the
    // form says, so the command must stop being offered until it is re-created.
    service.update({ hostname: 'other.example.com' });
    expect(service.connectorConfig()).toBeNull();
  });
});

describe('TunnelService — provisioning', () => {
  it('TUNNEL-021: creates the tunnel, writes ingress and points DNS at it', async () => {
    service.update(complete);
    verifyToken.mockResolvedValue({ id: 'acct', name: 'Acct' });
    findZoneIdForHostname.mockResolvedValue('zone-1');
    findTunnelByName.mockResolvedValue(null);
    createTunnel.mockResolvedValue({ id: 'tun-1', name: complete.tunnel_name, token: 'connector-token-xyz' });
    putTunnelConfiguration.mockResolvedValue(undefined);
    upsertTunnelDns.mockResolvedValue(undefined);

    const result = await service.provision();

    expect(result).toMatchObject({ success: true, tunnel_id: 'tun-1', connector_token: 'connector-token-xyz' });
    // The ingress points at the app inside the Docker network, by service name.
    expect(putTunnelConfiguration).toHaveBeenCalledWith(
      '0123456789abcdef0123456789abcdef',
      complete.api_token,
      'tun-1',
      {
        hostname: complete.hostname,
        service: 'http://app:3000',
      },
    );
    expect(upsertTunnelDns).toHaveBeenCalledWith('0123456789abcdef0123456789abcdef', complete.api_token, {
      zoneId: 'zone-1',
      hostname: complete.hostname,
      tunnelId: 'tun-1',
    });
    // Provisioning is remembered, so the panel stops offering to create it.
    expect(service.state().provisioned).toBe(true);
  });

  it('TUNNEL-022: an existing tunnel of the same name is reused, not duplicated', async () => {
    service.update(complete);
    findZoneIdForHostname.mockResolvedValue('zone-1');
    findTunnelByName.mockResolvedValue({ id: 'tun-existing', name: complete.tunnel_name });
    getTunnelToken.mockResolvedValue('existing-token');

    const result = await service.provision();

    expect(createTunnel).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: true, tunnel_id: 'tun-existing', connector_token: 'existing-token' });
  });

  it('TUNNEL-023: a hostname with no matching zone is reported, not silently created', async () => {
    service.update(complete);
    findZoneIdForHostname.mockResolvedValue(null);

    const result = await service.provision();

    expect(result).toEqual({ success: false, error: 'no_zone_for_hostname' });
    expect(createTunnel).not.toHaveBeenCalled();
  });

  it('TUNNEL-024: provisioning is refused while disabled or incomplete', async () => {
    service.update(complete);
    service.update({ enabled: false });
    expect(await service.provision()).toEqual({ success: false, error: 'disabled' });

    service.update({ enabled: true, hostname: '' });
    expect(await service.provision()).toEqual({ success: false, error: 'incomplete' });

    expect(createTunnel).not.toHaveBeenCalled();
  });

  it('TUNNEL-025: editing a field the tunnel was built from invalidates provisioning', async () => {
    // Otherwise the panel would keep showing a connector command for a tunnel
    // that no longer matches the form.
    service.update(complete);
    findZoneIdForHostname.mockResolvedValue('zone-1');
    findTunnelByName.mockResolvedValue(null);
    createTunnel.mockResolvedValue({ id: 'tun-1', name: complete.tunnel_name, token: 'tok' });
    await service.provision();
    expect(service.state().provisioned).toBe(true);

    service.update({ hostname: 'other.example.com' });
    expect(service.state().provisioned).toBe(false);
  });
});
