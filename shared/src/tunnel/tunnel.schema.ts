import { z } from 'zod';

/**
 * Cloudflare Tunnel admin contract.
 *
 * This surface exists for operators who cannot or will not set up a tunnel by
 * hand. It is strictly opt-in: `cloudflare_tunnel_enabled` defaults to off, and
 * while it is off nothing here reads or writes anything — an operator running
 * their own cloudflared (or their own nginx/Caddy) is completely unaffected.
 *
 * The app never launches cloudflared itself. It stores the credentials, checks
 * them against Cloudflare's API, and renders the config the operator pastes
 * into a sidecar. Running a connector inside this container is not possible
 * without breaking the read-only rootfs and the dropped capabilities the image
 * ships with, so the tunnel deliberately stays a separate process.
 */

/** Cloudflare API token: a URL-safe opaque string. Length-bounded, never echoed back. */
export const cloudflareApiTokenSchema = z
  .string()
  .trim()
  .min(20, 'token looks too short')
  .max(200, 'token looks too long')
  .regex(/^[A-Za-z0-9_-]+$/, 'token must be a Cloudflare API token');

/** Cloudflare account id: 32 lowercase hex characters. */
export const cloudflareAccountIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f0-9]{32}$/i, 'account id must be 32 hex characters');

/** A tunnel name, as it will appear in the Cloudflare dashboard. */
export const cloudflareTunnelNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9._-]+$/, 'use letters, digits, dot, dash or underscore');

/**
 * The public hostname the tunnel serves. A DNS name, not a URL: the scheme is
 * always https on Cloudflare's edge, and the operator's local service is plain
 * http, so accepting a URL here would invite the wrong thing.
 */
export const cloudflareHostnameSchema = z
  .string()
  .trim()
  .min(4)
  .max(253)
  .regex(
    /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i,
    'must be a hostname like tt.example.com',
  );

/** Port the connector should reach the app on. See `service_host` for the other half. */
export const cloudflareServicePortSchema = z.number().int().min(1).max(65535);

/**
 * Where the connector should reach the app, from the connector's own point of
 * view. Two legitimate answers, which is why this is a setting rather than a
 * constant:
 *
 *  - `app` — the compose service name. Correct when the connector runs as a
 *    sidecar in the same Docker network, which is what the shipped
 *    docker-compose.yml sets up: resolution happens inside that network, where
 *    `app` really is a hostname.
 *  - `localhost` (or any host the operator names) — every install where the
 *    connector is NOT a sibling container: the native Windows package, a
 *    bare-metal/LXC install, or a connector run on the host in front of a
 *    container whose port is published.
 *
 * A hostname rather than a full URL: the scheme is always http (Cloudflare
 * terminates TLS at the edge and the local hop is plain), so accepting a URL
 * would invite something that cannot work.
 */
export const cloudflareServiceHostSchema = z
  .string()
  .trim()
  .min(1)
  .max(253)
  .regex(/^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$/, 'must be a hostname like app or localhost');

/**
 * The stored configuration as the admin form sends it.
 *
 * `api_token` is write-only in practice: GET answers the mask, and echoing the
 * mask back means "keep the stored token". Same convention as smtp_pass and
 * admin_ntfy_token.
 */
export const cloudflareTunnelConfigSchema = z.object({
  enabled: z.boolean(),
  account_id: z.string().trim().max(64),
  api_token: z.string().trim().max(200),
  tunnel_name: z.string().trim().max(64),
  hostname: z.string().trim().max(253),
  service_host: cloudflareServiceHostSchema,
  service_port: cloudflareServicePortSchema,
});
export type CloudflareTunnelConfig = z.infer<typeof cloudflareTunnelConfigSchema>;

/**
 * PUT body. Looser than the read shape on purpose: the form saves partial state
 * (a half-filled form must not 400), so the field-level refinements above are
 * applied by the probe and by the "is it complete enough to use" check, not by
 * the validator. Only the shape is pinned here.
 */
export const cloudflareTunnelConfigPutSchema = cloudflareTunnelConfigSchema.partial();
export type CloudflareTunnelConfigPut = z.infer<typeof cloudflareTunnelConfigPutSchema>;

/** POST /test body — probe the credentials currently stored (or just typed). */
export const cloudflareTunnelTestRequestSchema = z.object({
  account_id: z.string().trim().max(64).optional(),
  api_token: z.string().trim().max(200).optional(),
});
export type CloudflareTunnelTestRequest = z.infer<typeof cloudflareTunnelTestRequestSchema>;

/**
 * What the admin panel renders. `configured` is the "has enough to be usable"
 * flag the UI keys off; the individual readiness checks are returned so the
 * panel can say WHICH part is missing instead of a bare "incomplete".
 */
export const cloudflareTunnelStateSchema = z.object({
  /** Master switch. Off means this feature does nothing at all. */
  enabled: z.boolean(),
  account_id: z.string(),
  /** Always the mask when a token is stored, never the token. */
  api_token: z.string(),
  tunnel_name: z.string(),
  hostname: z.string(),
  /** Where the connector reaches the app: `app` in Docker, `localhost` natively. */
  service_host: z.string(),
  service_port: z.number().int(),
  /**
   * The port this process is actually listening on, read from the live
   * environment rather than from the saved form.
   *
   * The panel seeds the service-port field from this, because nothing else can
   * know the answer: the Docker image is fixed at 3000, while the portable
   * Windows package picks whatever port is free (3001, or the next one up when
   * that is taken) and never tells the server which choice it made. A hardcoded
   * default therefore silently points the connector at a port nobody is
   * listening on.
   */
  listening_port: z.number().int(),
  /**
   * True when this process is running inside a Docker container, which is the
   * one case where the connector is expected to be a sibling container and
   * `service_host: 'app'` is right. The panel uses it to pick which set of
   * connector instructions to show.
   */
  in_docker: z.boolean(),
  /** True once every required field is present, regardless of `enabled`. */
  configured: z.boolean(),
  /** Names of the missing pieces, for the panel's checklist. Empty when configured. */
  missing: z.array(z.string()),
  /** The resolved public URL, or null while unconfigured. */
  public_url: z.string().nullable(),
  /**
   * True once the tunnel has been created on Cloudflare's side. Until then the
   * panel offers the "create" action; afterwards it shows the connector command.
   */
  provisioned: z.boolean(),
});
export type CloudflareTunnelState = z.infer<typeof cloudflareTunnelStateSchema>;

/** A probe result. Always 200 — a rejected credential is an answer, not an error. */
export const cloudflareTunnelTestResultSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  /** Account name Cloudflare reports for the token, when the probe got that far. */
  account_name: z.string().optional(),
  /** Tunnel names already present in the account, so the operator can spot a typo. */
  tunnels: z.array(z.string()).optional(),
});
export type CloudflareTunnelTestResult = z.infer<typeof cloudflareTunnelTestResultSchema>;

/**
 * Result of provisioning the tunnel on Cloudflare's side: create-or-reuse the
 * tunnel, write its ingress rules, point DNS at it. Always 200 — a rejected
 * token or a hostname outside the account is an answer the panel renders.
 *
 * `connector_token` is the one secret the operator still handles: it is what the
 * sidecar authenticates with. It is returned here and never stored, because the
 * app does not run the connector and has no use for it afterwards.
 */
export const cloudflareTunnelProvisionResultSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  tunnel_id: z.string().optional(),
  connector_token: z.string().optional(),
  public_url: z.string().optional(),
});
export type CloudflareTunnelProvisionResult = z.infer<typeof cloudflareTunnelProvisionResultSchema>;
