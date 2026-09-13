import { readEnv } from '../../app-config';

/**
 * Idempotency-key TTL purge (moved from src/scheduler.ts; the interceptor that
 * writes the keys lives next door in idempotency.interceptor.ts).
 *
 * The TTL must exceed any realistic offline window: the TREK client replays
 * queued mutations with their X-Idempotency-Key when it reconnects, so a key
 * GC'd before the device comes back online would let the replay create a
 * duplicate. 24h was far too short for a multi-day offline trip; default 30d,
 * overridable via IDEMPOTENCY_TTL_SECONDS (default lives in app-config).
 */

export interface PurgeDb {
  prepare(sql: string): { run(...args: unknown[]): { changes: number } };
}

/** Delete idempotency keys older than the configured TTL. Returns rows removed.
 *  The db is a required parameter now (DatabaseService satisfies PurgeDb
 *  structurally) — the old lazy-require default died with the scheduler. */
export function purgeExpiredIdempotencyKeys(
  now: number = Date.now(),
  ttlSeconds: number = readEnv().session.idempotencyTtlSeconds,
  database: PurgeDb,
): number {
  const cutoff = Math.floor(now / 1000) - ttlSeconds;
  const result = database.prepare('DELETE FROM idempotency_keys WHERE created_at < ?').run(cutoff);
  return result.changes;
}
