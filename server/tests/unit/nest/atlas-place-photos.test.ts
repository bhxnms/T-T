/**
 * AtlasService.placePhotos — photos reachable from a place, for the atlas
 * check-in popup: journey photos via the place's check-ins and via entries
 * imported from the trip skeleton, plus legacy trip-photo uploads. Ownership
 * is enforced per source (journey owner / trip owner-or-member).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';

const { testDb, dbMock } = vi.hoisted(() => {
  const Database = require('better-sqlite3');
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
  };
});

vi.mock('../../../src/db/database', () => dbMock);
vi.mock('../../../src/config', () => ({
  JWT_SECRET: 'test-jwt-secret-for-trek-testing-only',
  ENCRYPTION_KEY: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6a7b8c9d0e1f2a3b4c5d6a7b8c9d0e1f2',
  updateJwtSecret: () => {},
}));

import { runMigrations } from '../../../src/db/migrations';
import { createTables } from '../../../src/db/schema';
import { resetTestDb } from '../../helpers/test-db';
import { DatabaseService } from '../../../src/nest/database/database.service';
import { AtlasService } from '../../../src/nest/atlas/atlas.service';

const dbs = new DatabaseService(testDb);
const svc = new AtlasService(dbs);

let OWNER = 0;
let OTHER = 0;
let MEMBER = 0;

let seq = 0;
const IDS = { place: 0, photoCheckin: 0, photoEntry: 0, photoOther: 0, photoLegacy: 0 };

function seed(): number {
  const insUser = testDb.prepare("INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, 'x', 'user')");
  OWNER = Number(insUser.run(`owner-${Date.now()}-${Math.random()}`, `o${Math.random()}@t.t`).lastInsertRowid);
  OTHER = Number(insUser.run(`other-${Date.now()}-${Math.random()}`, `x${Math.random()}@t.t`).lastInsertRowid);
  MEMBER = Number(insUser.run(`member-${Date.now()}-${Math.random()}`, `m${Math.random()}@t.t`).lastInsertRowid);

  const ownerTripId = Number(
    testDb.prepare('INSERT INTO trips (user_id, title) VALUES (?, ?)').run(OWNER, 'Owner Trip').lastInsertRowid,
  );
  testDb.prepare('INSERT INTO trip_members (trip_id, user_id) VALUES (?, ?)').run(ownerTripId, MEMBER);

  const placeId = Number(
    testDb.prepare('INSERT INTO places (trip_id, name, lat, lng) VALUES (?, ?, 50, 8)').run(ownerTripId, 'Eiffel').lastInsertRowid,
  );

  const insTrek = testDb.prepare("INSERT INTO trek_photos (provider, owner_id) VALUES ('local', ?)");
  const photoCheckin = Number(insTrek.run(OWNER).lastInsertRowid);   // via entry photos
  const photoOther = Number(insTrek.run(OTHER).lastInsertRowid);     // someone else's journey
  const photoLegacy = Number(insTrek.run(OWNER).lastInsertRowid);    // legacy upload source

  const journeyId = Number(
    testDb.prepare(
      "INSERT INTO journeys (user_id, title, created_at, updated_at) VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%SZ','now'), strftime('%Y-%m-%dT%H:%M:%SZ','now'))",
    ).run(OWNER, 'Owner Journey').lastInsertRowid,
  );

  const entryId = Number(
    testDb.prepare('INSERT INTO journey_entries (journey_id, author_id, type, entry_date, source_trip_id, source_place_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, strftime(?, ?), strftime(?, ?))')
      .run(journeyId, OWNER, 'story', '2026-09-02', ownerTripId, placeId, '%Y-%m-%dT%H:%M:%SZ', 'now', '%Y-%m-%dT%H:%M:%SZ', 'now').lastInsertRowid,
  );
  const gpEntry = Number(
    testDb.prepare('INSERT INTO journey_photos (journey_id, photo_id, created_at) VALUES (?, ?, ?)')
      .run(journeyId, photoCheckin, Date.now()).lastInsertRowid,
  );
  testDb.prepare('INSERT INTO journey_entry_photos (entry_id, journey_photo_id, created_at) VALUES (?, ?, ?)')
    .run(entryId, gpEntry, Date.now());

  // Someone else's journey over the same place — must stay invisible to OWNER.
  const otherJourneyId = Number(
    testDb.prepare(
      "INSERT INTO journeys (user_id, title, created_at, updated_at) VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%SZ','now'), strftime('%Y-%m-%dT%H:%M:%SZ','now'))",
    ).run(OTHER, 'Other Journey').lastInsertRowid,
  );
  const otherEntryId = Number(
    testDb.prepare('INSERT INTO journey_entries (journey_id, author_id, type, entry_date, source_trip_id, source_place_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, strftime(?, ?), strftime(?, ?))')
      .run(otherJourneyId, OTHER, 'story', '2026-09-03', ownerTripId, placeId, '%Y-%m-%dT%H:%M:%SZ', 'now', '%Y-%m-%dT%H:%M:%SZ', 'now').lastInsertRowid,
  );
  const gpOther = Number(
    testDb.prepare('INSERT INTO journey_photos (journey_id, photo_id, created_at) VALUES (?, ?, ?)')
      .run(otherJourneyId, photoOther, Date.now()).lastInsertRowid,
  );
  testDb.prepare('INSERT INTO journey_entry_photos (entry_id, journey_photo_id, created_at) VALUES (?, ?, ?)')
    .run(otherEntryId, gpOther, Date.now());

  // Legacy trip-photo upload on the owner trip.
  IDS.photoLegacy = Number(
    testDb.prepare('INSERT INTO photos (trip_id, place_id, filename, original_name) VALUES (?, ?, ?, ?)')
      .run(ownerTripId, placeId, 'a.jpg', 'a.jpg').lastInsertRowid,
  );

  IDS.photoCheckin = photoCheckin;
  IDS.photoEntry = photoCheckin;
  IDS.photoOther = photoOther;
  return placeId;
}

beforeEach(() => {
  createTables(testDb);
  runMigrations(testDb);
  resetTestDb(testDb);
});

describe('AtlasService.placePhotos', () => {
  it('ATLPP-001 — gathers check-in photos, entry photos and legacy uploads, deduped', () => {
    const placeId = seed();
    const photos = svc.placePhotos(OWNER, placeId);
    const ids = photos.map((p) => p.photo_id).sort((a, b) => a - b);
    // photos and trek_photos share the numeric /api/photos namespace, so a
    // coinciding id dedupes to one row here.
    expect(ids).toEqual([...new Set([IDS.photoCheckin, IDS.photoEntry, IDS.photoLegacy])].sort((a, b) => a - b));
  });

  it('ATLPP-002 — another user sees only their own reachable photos', () => {
    const placeId = seed();
    const photos = svc.placePhotos(OTHER, placeId);
    // OTHER owns no trip with this place, so the legacy upload is out of reach;
    // their own journey check-in photo is in.
    expect(photos.map((p) => p.photo_id)).toEqual([IDS.photoOther]);
  });

  it('ATLPP-003 — a trip member sees the legacy upload', () => {
    const placeId = seed();
    const photos = svc.placePhotos(MEMBER, placeId);
    expect(photos.map((p) => p.photo_id)).toContain(IDS.photoLegacy);
    // ...but not the owner's journey photos (different feature, different owner).
    expect(photos.map((p) => p.photo_id)).not.toContain(IDS.photoCheckin);
  });

  it('ATLPP-004 — nonsense place ids answer empty', () => {
    seed();
    expect(svc.placePhotos(OWNER, Number.NaN)).toEqual([]);
    expect(svc.placePhotos(OWNER, 999999)).toEqual([]);
  });
});
