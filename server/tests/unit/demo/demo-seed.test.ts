/**
 * Demo mode boot seeding.
 *
 * DEMO_MODE=true creates a role=admin account on first boot. When
 * DEMO_ADMIN_PASS is unset that account gets the password published in
 * demo-seed itself, so the seeder has to say so out loud.
 */
import { seedDemoData } from '../../../src/demo/demo-seed';
import { DEMO_EMAIL_PRIMARY } from '../../../src/nest/common/demo';
import { createTestDb } from '../../helpers/test-db';

import type Database from 'better-sqlite3';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Baseline handling is demo-reset's job and touches the file system.
vi.mock('../../../src/demo/demo-reset', () => ({
  saveBaseline: vi.fn(),
  hasBaseline: vi.fn(() => true),
  resetDemoUser: vi.fn(),
}));

describe('demo seeding', () => {
  let db: Database.Database;
  const realPass = process.env.DEMO_ADMIN_PASS;

  beforeEach(() => {
    db = createTestDb();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    db.close();
    if (realPass === undefined) delete process.env.DEMO_ADMIN_PASS;
    else process.env.DEMO_ADMIN_PASS = realPass;
  });

  it('DEMOSEED-001: warns when the admin account is created with the default password', () => {
    delete process.env.DEMO_ADMIN_PASS;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    seedDemoData(db);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('DEMO_ADMIN_PASS is not set'));
  });

  it('DEMOSEED-002: stays quiet when the operator set DEMO_ADMIN_PASS', () => {
    process.env.DEMO_ADMIN_PASS = 'a-real-password';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    seedDemoData(db);

    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('DEMO_ADMIN_PASS is not set'));
  });

  it('DEMOSEED-003: does not warn again once the admin account exists', () => {
    delete process.env.DEMO_ADMIN_PASS;
    seedDemoData(db);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    seedDemoData(db);

    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('DEMO_ADMIN_PASS is not set'));
  });

  it('DEMOSEED-004: recognises accounts seeded by an older build instead of duplicating them', () => {
    // An instance that upgraded in place already holds rows under the addresses
    // an earlier build seeded, and the hourly reset keeps restoring them from
    // that baseline. Seeding has to find those rows and leave them alone: the
    // address is the account's identity, and username is UNIQUE, so a second
    // INSERT for 'demo' would abort the whole seed — example trips included.
    for (const legacy of [
      ['demo@trek.app', 'admin@trek.app'],
      ['demo@nomad.app', 'admin@nomad.app'],
    ]) {
      const [demoEmail, adminEmail] = legacy;
      const fresh = createTestDb();
      const insert = fresh.prepare(
        'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
      );
      insert.run('demo', demoEmail, 'x', 'user');
      insert.run('admin', adminEmail, 'x', 'admin');

      seedDemoData(fresh);

      const users = fresh.prepare('SELECT username, email FROM users ORDER BY id').all() as Array<{
        username: string;
        email: string;
      }>;
      expect(users, `upgrading from ${demoEmail}`).toEqual([
        { username: 'demo', email: demoEmail },
        { username: 'admin', email: adminEmail },
      ]);
      fresh.close();
    }
  });

  it('DEMOSEED-005: a fresh database still gets the current addresses', () => {
    seedDemoData(db);

    const emails = (db.prepare('SELECT email FROM users ORDER BY id').all() as Array<{ email: string }>).map(
      (u) => u.email,
    );
    expect(emails).toContain(DEMO_EMAIL_PRIMARY);
    expect(emails).toContain('admin@tt.local');
  });
});
