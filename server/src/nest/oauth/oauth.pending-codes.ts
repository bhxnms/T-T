/**
 * The short-lived authorization-code store.
 *
 * Module-scoped + import-time interval on purpose (legacy parity — atlas-geo
 * interval precedent). This is not a stylistic choice: the consent controller
 * writes a code through the container OauthService and the SDK exchange path
 * (oauth-sdk.provider.ts) reads it back — through the same injected singleton
 * in production, but the integration harness and any second OauthService
 * instance must keep seeing the same map. Two maps would make the
 * authorization-code flow fail *silently* — the SDK only ever answers
 * "Authorization grant is invalid."
 *
 * No DB persistence: codes live two minutes and a restart invalidating them
 * is the correct behaviour.
 */

export interface PendingCode {
  clientId: string;
  userId: number;
  redirectUri: string;
  scopes: string[];
  resource: string | null;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
  expiresAt: number;
}

export const MAX_PENDING_CODES = 500;
export const AUTH_CODE_TTL_MS = 2 * 60 * 1000; // 2 minutes

const pendingCodes = new Map<string, PendingCode>();

/** Drop everything past its TTL. Named so the interval body is reachable from a test. */
export function sweepPendingCodes(now = Date.now()): void {
  for (const [key, entry] of pendingCodes) {
    if (now > entry.expiresAt) pendingCodes.delete(key);
  }
}

setInterval(() => sweepPendingCodes(), 60_000).unref();

/** Returns false when the store is at capacity — the caller answers with a null code. */
export function putPendingCode(code: string, entry: PendingCode): boolean {
  if (pendingCodes.size >= MAX_PENDING_CODES) return false;
  pendingCodes.set(code, entry);
  return true;
}

/** Single-use: the entry is removed even when it turns out to be expired. */
export function takePendingCode(code: string): PendingCode | null {
  const entry = pendingCodes.get(code);
  if (!entry) return null;
  pendingCodes.delete(code);
  if (Date.now() > entry.expiresAt) return null;
  return entry;
}
