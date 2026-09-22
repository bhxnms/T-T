// Central registry of demo-user email addresses.
//
// The demo account is seeded under DEMO_EMAIL_PRIMARY, but two earlier builds
// shipped different addresses — "demo@nomad.app" first, then "demo@trek.app" —
// and a live row keeps whichever one created it, because the hourly reset
// restores the database file from a baseline that was written at seed time.
// Several guards (the demo upload block, the MFA/backup-code bypasses) once
// checked those older strings inline, so they either never fired or silently
// diverged between call sites. Routing every lookup through this module keeps
// them aligned, and keeps accounts seeded by an older build recognised.
//
// Two rules follow from that, and both matter:
//  - Anything *matching* a demo account (guards, blocks) must accept every
//    address in DEMO_EMAIL_CANDIDATES, or an upgraded instance loses its
//    protection.
//  - Anything *looking one up* (demo login, the seeder) must try them in order,
//    because the row it wants may still carry an older address.

/** The address a freshly seeded demo account gets. */
export const DEMO_EMAIL_PRIMARY = 'demo@tt.local';

/**
 * Addresses earlier builds seeded, newest first. Only ever appended to: a
 * baseline database written by one of those builds still hands them back after
 * a reset, so dropping one would break demo login on that instance.
 */
const DEMO_EMAIL_LEGACY = ['demo@trek.app', 'demo@nomad.app'] as const;

/**
 * Lookup order for the demo account's row: the address this build seeds, then
 * the ones it superseded.
 */
export const DEMO_EMAIL_CANDIDATES: readonly string[] = [DEMO_EMAIL_PRIMARY, ...DEMO_EMAIL_LEGACY];

/**
 * The demo account's password. Public on purpose — a demo instance shows it on
 * the login screen so visitors can get in — but it was written out twice, in the
 * seeder and in the config payload, which is one copy too many for something the
 * seeder has to match exactly for the login to work.
 */
export const DEMO_PASS = 'demo12345';

/** The demo admin's address, as seeded; the seeder uses it when the env sets none. */
export const DEMO_ADMIN_EMAIL_DEFAULT = 'admin@tt.local';

/** Admin addresses earlier builds seeded, newest first. Same append-only rule. */
const DEMO_ADMIN_EMAIL_LEGACY = ['admin@trek.app', 'admin@nomad.app'] as const;

/** Lookup order for the demo admin's row, including the address the env may set. */
export function demoAdminEmailCandidates(configured: string | undefined): string[] {
  return configured ? [configured] : [DEMO_ADMIN_EMAIL_DEFAULT, ...DEMO_ADMIN_EMAIL_LEGACY];
}

/**
 * Every email address that should be treated as a demo account. Includes the
 * historical identifiers so instances that upgraded in place without resetting
 * the DB still hit demo-mode guards.
 */
export const DEMO_EMAILS: ReadonlySet<string> = new Set(DEMO_EMAIL_CANDIDATES);

export function isDemoEmail(email: string | null | undefined): boolean {
  return !!email && DEMO_EMAILS.has(email);
}

/**
 * The demo user's row, whichever of the candidate addresses it carries.
 *
 * Takes a lookup rather than a database handle so both the service (which owns
 * a connection) and the seeder (which is handed one) can share the order — the
 * one thing they must not do is disagree about which row is the demo account.
 */
export function findDemoUser<T>(lookup: (email: string) => T | undefined): T | undefined {
  for (const email of DEMO_EMAIL_CANDIDATES) {
    const user = lookup(email);
    if (user) return user;
  }
  return undefined;
}
