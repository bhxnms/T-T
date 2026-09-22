/**
 * First-deploy bootstrap credentials — the two bugs that kept the initial admin
 * password from ever reaching the operator.
 *
 * This path had no test at all, which is why both defects shipped together:
 *
 *   1. `getActiveNoticesFor` handed `.get()`'s ROW to `decrypt_api_key`, which
 *      only accepts a string. It answered null on every install, so the notice
 *      rendered without the credentials it exists to deliver.
 *   2. The client skipped fetching notices entirely while
 *      `must_change_password` was set — precisely the state that needs them.
 *
 * The test runs against a real in-memory database and the real seeder, so it
 * exercises the same encryption round trip production does.
 */
import { describe, it, expect, vi } from 'vitest';

const { testDb } = vi.hoisted(() => {
  const Db = require('better-sqlite3');
  return { testDb: new Db(':memory:') };
});

vi.mock('../../../src/db/database', () => ({ db: testDb }));

/** Minimal users/app_settings schema — the seeder and notice service need no more. */
function createSchema(db: any): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      email TEXT UNIQUE,
      password_hash TEXT,
      role TEXT,
      login_count INTEGER DEFAULT 0,
      first_seen_version TEXT DEFAULT '0.0.0',
      must_change_password INTEGER DEFAULT 0,
      frontend_language TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE IF NOT EXISTS trips (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER);
    CREATE TABLE IF NOT EXISTS user_notice_dismissals (
      user_id INTEGER, notice_id TEXT, dismissed_at INTEGER, dismissed_app_version TEXT,
      PRIMARY KEY (user_id, notice_id)
    );
  `);
}

async function bootstrappedAdmin(): Promise<{ id: number; password: string }> {
  const { seedAdminAccount } = await import('../../../src/db/seeds');
  const { decrypt_api_key } = await import('../../../src/nest/common/crypto/apiKeyCrypto');

  createSchema(testDb);
  seedAdminAccount(testDb as never);

  const admin = testDb
    .prepare("SELECT id, email, must_change_password FROM users WHERE role = 'admin'")
    .get() as { id: number; email: string; must_change_password: number };
  // The seeder prints the generated password to stdout; read it back from the
  // store instead so the test asserts on what was actually persisted.
  const stored = testDb
    .prepare("SELECT value FROM app_settings WHERE key = 'bootstrap_admin_password'")
    .get() as { value: string };

  return { id: admin.id, password: decrypt_api_key(stored.value) as string };
}

describe('first-deploy bootstrap credentials', () => {
  it('seeds admin@tt.local with a generated password and must_change_password', async () => {
    const { id, password } = await bootstrappedAdmin();
    const admin = testDb.prepare('SELECT email, username, must_change_password FROM users WHERE id = ?').get(id) as {
      email: string;
      username: string;
      must_change_password: number;
    };

    expect(admin.email).toBe('admin@tt.local');
    expect(admin.username).toBe('admin');
    expect(admin.must_change_password).toBe(1);
    expect(typeof password).toBe('string');
    expect(password.length).toBeGreaterThan(8);
  });

  it('BSTRAP-001: no system notice carries the credentials any more', async () => {
    // They used to ride a non-dismissible modal shown after login. That was both
    // a duplicate (the login page already shows them before sign-in, which is the
    // only point where they are useful) and a deadlock: `dismissible: false`
    // hides the close button AND the OK button while locking the pager, and that
    // notice had no CTA — so there was no exit at all. This asserts the notice
    // stays gone, since re-adding it would re-create the trap.
    const { id } = await bootstrappedAdmin();
    const { getActiveNoticesFor } = await import('../../../src/systemNotices/service');

    const notices = getActiveNoticesFor(id, () => false, false);
    expect(notices.some((n: any) => n.id === 'tt-bootstrap-password')).toBe(false);
    // And no other notice leaks the pair through bodyParams either.
    for (const n of notices as any[]) {
      expect(JSON.stringify(n.bodyParams ?? {})).not.toContain('bootstrap');
    }
  });

  it('BSTRAP-002: an unreadable credential blob never throws the notice path', async () => {
    const { id } = await bootstrappedAdmin();
    const { getActiveNoticesFor } = await import('../../../src/systemNotices/service');

    // A rotated/foreign key used to leave the notice without its credentials. The
    // notice is gone now, but the service still reads app_settings at this point
    // in its life, so a corrupt blob must not take the whole notice list down —
    // a throw here would blank EVERY notice for the user.
    testDb.prepare("UPDATE app_settings SET value = 'enc:v1:not-a-real-blob' WHERE key = 'bootstrap_admin_password'").run();
    expect(() => getActiveNoticesFor(id, () => false, false)).not.toThrow();
  });

  it('BSTRAP-003: no registry entry can trap the user — every non-dismissible notice offers a CTA', async () => {
    // The deadlock's root shape, pinned at the source rather than at the one
    // entry that hit it. `dismissible: false` hides the close button AND the OK
    // button (which renders only when `dismissible || isLastPage`) while the same
    // flag locks the pager — so a non-dismissible notice with no CTA has no exit
    // whatsoever. The removed credentials notice was exactly that, and it was
    // also the only notice, so it never qualified as the "last page" either.
    const { SYSTEM_NOTICES } = await import('../../../src/systemNotices/registry');

    const traps = SYSTEM_NOTICES.filter((n: any) => n.dismissible === false && !n.cta && !n.secondaryCta);
    expect(traps.map((n: any) => n.id)).toEqual([]);
  });
});
