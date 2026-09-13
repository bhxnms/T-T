/**
 * TrekImportService — extracts a TREK backup zip, lists its trips, and copies a
 * trip with everything hanging off it (days, places, assignments, reservations,
 * notes, packing, budget, photos, files, accommodations, tags, categories,
 * ratings) into the live database with fresh, remapped ids.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import archiver from 'archiver';
import Database from 'better-sqlite3';
import { runMigrations } from '../../../src/db/migrations';
import { createTables } from '../../../src/db/schema';
import { resetTestDb } from '../../helpers/test-db';
import { createUser } from '../../helpers/factories';

const { testDb, dbMock, storageMock, tempRoot } = vi.hoisted(() => {
  const Database = require('better-sqlite3');
  const fs = require('node:fs');
  const os = require('node:os');
  const db = new Database(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  return {
    testDb: db,
    dbMock: {
      db,
      closeDb: () => {},
      reinitialize: () => {},
      getPlaceWithTags: () => null,
      canAccessTrip: () => null,
      isOwner: () => false,
    },
    storageMock: {
      tempDir: () => fs.mkdtempSync(path.join(os.tmpdir(), 'trek-import-test-')),
      put: vi.fn(async () => {}),
    },
    tempRoot: null as string | null,
  };
});

vi.mock('../../../src/db/database', () => dbMock);
vi.mock('../../../src/nest/storage/storage.service', () => ({ StorageService: class {} }));

import { DatabaseService } from '../../../src/nest/database/database.service';
import { TrekImportService } from '../../../src/nest/trips/trek-import.service';

const dbs = new DatabaseService(testDb);
const svc = new TrekImportService(dbs, storageMock as never);

let USER_ID = 7;

describe('TrekImportService', () => {

/** Build a realistic TREK snapshot db with one trip to import. */
function buildTrekDb(dir: string): string {
  const src = new Database(path.join(dir, 'travel.db'));
  src.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, email TEXT);
    CREATE TABLE trips (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, title TEXT, description TEXT,
      start_date TEXT, end_date TEXT, currency TEXT, cover_image TEXT, is_archived INTEGER DEFAULT 0,
      reminder_days INTEGER DEFAULT 3, feed_token TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, color TEXT, icon TEXT, user_id INTEGER);
    CREATE TABLE tags (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, name TEXT, color TEXT);
    CREATE TABLE days (id INTEGER PRIMARY KEY AUTOINCREMENT, trip_id INTEGER, day_number INTEGER, date TEXT, notes TEXT, title TEXT);
    CREATE TABLE places (
      id INTEGER PRIMARY KEY AUTOINCREMENT, trip_id INTEGER, name TEXT, description TEXT, lat REAL, lng REAL,
      address TEXT, category_id INTEGER, image_url TEXT, google_place_id TEXT, transport_mode TEXT DEFAULT 'walking'
    );
    CREATE TABLE day_assignments (id INTEGER PRIMARY KEY AUTOINCREMENT, day_id INTEGER, place_id INTEGER, order_index INTEGER, notes TEXT);
    CREATE TABLE reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT, trip_id INTEGER, day_id INTEGER, end_day_id INTEGER,
      place_id INTEGER, assignment_id INTEGER, title TEXT, status TEXT, type TEXT
    );
    CREATE TABLE day_notes (id INTEGER PRIMARY KEY AUTOINCREMENT, day_id INTEGER, trip_id INTEGER, text TEXT);
    CREATE TABLE packing_items (id INTEGER PRIMARY KEY AUTOINCREMENT, trip_id INTEGER, name TEXT, checked INTEGER);
    CREATE TABLE budget_items (id INTEGER PRIMARY KEY AUTOINCREMENT, trip_id INTEGER, category TEXT, name TEXT, total_price REAL);
    CREATE TABLE photos (id INTEGER PRIMARY KEY AUTOINCREMENT, trip_id INTEGER, day_id INTEGER, place_id INTEGER, filename TEXT);
    CREATE TABLE trip_files (id INTEGER PRIMARY KEY AUTOINCREMENT, trip_id INTEGER, place_id INTEGER, reservation_id INTEGER, filename TEXT);
    CREATE TABLE day_accommodations (
      id INTEGER PRIMARY KEY AUTOINCREMENT, trip_id INTEGER, place_id INTEGER,
      start_day_id INTEGER, end_day_id INTEGER, confirmation TEXT
    );
    CREATE TABLE place_ratings (id INTEGER PRIMARY KEY AUTOINCREMENT, place_id INTEGER, user_id INTEGER, rating INTEGER);
    CREATE TABLE place_tags (place_id INTEGER, tag_id INTEGER);
    CREATE TABLE trip_members (id INTEGER PRIMARY KEY AUTOINCREMENT, trip_id INTEGER, user_id INTEGER);

    INSERT INTO trips (id, user_id, title, description, start_date, end_date, currency, cover_image, feed_token)
      VALUES (1, 42, 'Old TREK Trip', 'from the archive', '2024-05-01', '2024-05-07', 'EUR', '/uploads/covers/old-cover.jpg', 'leaky-token');
    INSERT INTO categories (id, name, color, icon) VALUES (5, 'Sight', '#123456', '🏯');
    INSERT INTO tags (id, user_id, name, color) VALUES (9, 42, 'must-see', '#10b981');
    INSERT INTO days (id, trip_id, day_number, date, title) VALUES (100, 1, 1, '2024-05-01', 'Arrival'), (101, 1, 2, '2024-05-02', 'Old Town');
    INSERT INTO places (id, trip_id, name, lat, lng, category_id, image_url) VALUES
      (200, 1, 'Some Castle', 50.0, 8.0, 5, '/uploads/places/castle.jpg'),
      (201, 1, 'Riverside', 50.1, 8.1, NULL, NULL);
    INSERT INTO day_assignments (id, day_id, place_id, order_index) VALUES (300, 100, 200, 0), (301, 101, 201, 0);
    INSERT INTO reservations (id, trip_id, day_id, end_day_id, place_id, assignment_id, title, status, type)
      VALUES (400, 1, 100, 101, 200, 300, 'Castle Hotel', 'confirmed', 'hotel');
    INSERT INTO day_notes (id, day_id, trip_id, text) VALUES (500, 100, 1, 'buy transit card');
    INSERT INTO packing_items (id, trip_id, name, checked) VALUES (600, 1, 'Adapter', 0);
    INSERT INTO budget_items (id, trip_id, category, name, total_price) VALUES (700, 1, 'Food', 'Dinner', 42.5);
    INSERT INTO photos (id, trip_id, day_id, place_id, filename) VALUES (800, 1, 100, 200, 'castle-photo.jpg');
    INSERT INTO trip_files (id, trip_id, place_id, reservation_id, filename) VALUES (900, 1, 200, 400, 'booking.pdf');
    INSERT INTO day_accommodations (id, trip_id, place_id, start_day_id, end_day_id, confirmation) VALUES (950, 1, 200, 100, 101, 'CONF-1');
    INSERT INTO place_ratings (id, place_id, user_id, rating) VALUES (960, 200, 42, 5);
    INSERT INTO place_tags (place_id, tag_id) VALUES (200, 9);
    INSERT INTO trip_members (id, trip_id, user_id) VALUES (990, 1, 42);
    -- A second trip that must NOT be imported when only the first is selected.
  `);
    src.prepare('INSERT INTO trips (id, user_id, title) VALUES (2, 42, ?)').run('Unrelated Trip');
    src.close();
    return path.join(dir, 'travel.db');
  }

  let workDir: string;

  beforeEach(() => {
    createTables(testDb);
    runMigrations(testDb);
    resetTestDb(testDb);
    USER_ID = createUser(testDb).user.id;
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trek-src-'));
  });

  afterEach(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  async function makeBackupZip(): Promise<string> {
    const dbPath = buildTrekDb(workDir);
    // A cover file the import must carry into storage.
    const covers = path.join(workDir, 'uploads', 'covers');
    fs.mkdirSync(covers, { recursive: true });
    fs.writeFileSync(path.join(covers, 'old-cover.jpg'), 'jpeg-bytes');
    const zipPath = path.join(workDir, 'backup.zip');
    await new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip');
      output.on('close', resolve);
      archive.on('error', reject);
      archive.pipe(output);
      archive.file(dbPath, { name: 'travel.db' });
      archive.file(path.join(covers, 'old-cover.jpg'), { name: 'uploads/covers/old-cover.jpg' });
      void archive.finalize();
    });
    return zipPath;
  }

  it('TREKIMP-001 — preview lists the backup trips with counts and hands out a token', async () => {
    const zipPath = await makeBackupZip();
    const { token, trips } = await svc.previewFromZip(zipPath);
    expect(token).toBeTruthy();
    expect(trips).toHaveLength(2);
    const first = trips.find((t) => t.title === 'Old TREK Trip')!;
    expect(first.day_count).toBe(2);
    expect(first.place_count).toBe(2);
    expect(first.photo_count).toBe(1);
    expect(first.budget_count).toBe(1);
  });

  it('TREKIMP-002 — import copies everything with remapped ids and the importer as owner', async () => {
    const zipPath = await makeBackupZip();
    const { token, trips } = await svc.previewFromZip(zipPath);
    const oldTrip = trips.find((t) => t.title === 'Old TREK Trip')!;

    const { imported } = svc.importTrips(USER_ID, token, [oldTrip.id]);
    expect(imported).toHaveLength(1);
    const newTripId = imported[0].id;
    // On an empty TT database the autoincrement can legitimately coincide with
    // the source id — identity comes from user_id + content, not the number.

    const trip = testDb.prepare('SELECT * FROM trips WHERE id = ?').get(newTripId) as any;
    expect(trip.title).toBe('Old TREK Trip');
    expect(trip.user_id).toBe(USER_ID);
    expect(trip.feed_token).not.toBe('leaky-token');

    const days = testDb.prepare('SELECT * FROM days WHERE trip_id = ? ORDER BY day_number').all(newTripId) as any[];
    expect(days.map((d) => d.title)).toEqual(['Arrival', 'Old Town']);

    const places = testDb.prepare('SELECT * FROM places WHERE trip_id = ?').all(newTripId) as any[];
    expect(places.map((p) => p.name).sort()).toEqual(['Riverside', 'Some Castle']);
    const castle = places.find((p) => p.name === 'Some Castle')!;
    // The category came over and was attached to the importer.
    const cat = testDb.prepare('SELECT * FROM categories WHERE id = ?').get(castle.category_id) as any;
    expect(cat.name).toBe('Sight');
    expect(cat.user_id).toBe(USER_ID);

    const assignments = testDb.prepare(`
      SELECT a.* FROM day_assignments a JOIN days d ON d.id = a.day_id WHERE d.trip_id = ?
    `).all(newTripId) as any[];
    expect(assignments).toHaveLength(2);

    const reservation = testDb.prepare('SELECT * FROM reservations WHERE trip_id = ?').get(newTripId) as any;
    expect(reservation.title).toBe('Castle Hotel');
    expect(reservation.day_id).toBe(days[0].id);
    expect(reservation.end_day_id).toBe(days[1].id);
    expect(reservation.place_id).toBe(castle.id);
    expect(reservation.assignment_id).toBe(assignments[0].id);

    expect((testDb.prepare('SELECT text FROM day_notes WHERE trip_id = ?').get(newTripId) as any).text).toBe('buy transit card');
    expect(testDb.prepare('SELECT COUNT(*) AS n FROM packing_items WHERE trip_id = ?').get(newTripId)).toEqual({ n: 1 });
    expect(testDb.prepare('SELECT total_price AS n FROM budget_items WHERE trip_id = ?').get(newTripId)).toEqual({ n: 42.5 });
    expect(testDb.prepare('SELECT filename AS n FROM photos WHERE trip_id = ?').get(newTripId)).toEqual({ n: 'castle-photo.jpg' });

    const file = testDb.prepare('SELECT * FROM trip_files WHERE trip_id = ?').get(newTripId) as any;
    expect(file.reservation_id).toBe(reservation.id);

    const accom = testDb.prepare('SELECT * FROM day_accommodations WHERE trip_id = ?').get(newTripId) as any;
    expect(accom.start_day_id).toBe(days[0].id);
    expect(accom.end_day_id).toBe(days[1].id);

    // The other member's rating survives, attributed to the importer.
    const rating = testDb.prepare('SELECT * FROM place_ratings WHERE place_id = ?').get(castle.id) as any;
    expect(rating.rating).toBe(5);
    expect(rating.user_id).toBe(USER_ID);

    // Tags dedupe by name onto the importer's own set.
    const tag = testDb.prepare(`
      SELECT t.name, t.user_id FROM place_tags pt JOIN tags t ON t.id = pt.tag_id
      JOIN places p ON p.id = pt.place_id WHERE p.trip_id = ?
    `).get(newTripId) as any;
    expect(tag.name).toBe('must-see');
    expect(tag.user_id).toBe(USER_ID);

    // Unselected trips stay behind, and no member rows leak in.
    expect(testDb.prepare("SELECT COUNT(*) AS n FROM trips WHERE title = 'Unrelated Trip'").get()).toEqual({ n: 0 });
    expect(testDb.prepare('SELECT COUNT(*) AS n FROM trip_members').get()).toEqual({ n: 0 });
  });

  it('TREKIMP-003 — the cover upload is committed to storage', async () => {
    const zipPath = await makeBackupZip();
    const { token, trips } = await svc.previewFromZip(zipPath);
    svc.importTrips(USER_ID, token, [trips[0].id]);
    expect(storageMock.put).toHaveBeenCalledWith('covers', 'old-cover.jpg', expect.objectContaining({ tmpPath: expect.stringContaining('old-cover.jpg') }));
  });

  it('TREKIMP-004 — an unknown or expired token is refused', () => {
    expect(() => svc.importTrips(USER_ID, 'no-such-token', [1])).toThrow(/expired/);
  });

  it('TREKIMP-005 — a non-backup archive is rejected at preview', async () => {
    const zipPath = path.join(workDir, 'junk.zip');
    fs.writeFileSync(zipPath, 'not a zip at all');
    await expect(svc.previewFromZip(zipPath)).rejects.toThrow();
  });
});
