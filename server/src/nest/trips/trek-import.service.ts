import { DatabaseService } from '../database/database.service';
import { StorageService } from '../storage/storage.service';
import type { ServedCategory } from '../storage/storage.types';
import { Injectable, OnModuleDestroy } from '@nestjs/common';

import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import unzipper from 'unzipper';

/**
 * One-click import of trips from a TREK instance's backup zip.
 *
 * TT is a TREK fork, so the backup's travel.db speaks (nearly) the same
 * schema as our own database. The service opens the snapshot read-only,
 * lets the user pick trips in the UI, and copies everything trip-scoped
 * across with fresh ids: the trip itself, days, places, day assignments,
 * reservations, day notes, packing items, budget items, photos, trip
 * files, day accommodations, plus the tags/categories those places
 * reference and the uploads (covers, place images, photos, files) the
 * rows point at.
 *
 * People cannot be remapped — TREK user ids mean nothing here — so the
 * importer becomes the owner of every imported trip. Member-scoped rows
 * (trip_members, collaboration notes/polls, assignment participants)
 * are deliberately left behind, and other members' place ratings land
 * as the importer's rating so the aggregate survives the move.
 */

const PREVIEW_TTL_MS = 30 * 60 * 1000;
/** Zip upload cap; matches a generous TREK instance with years of photos. */
export const MAX_TREK_ZIP_BYTES = 512 * 1024 * 1024;
/** Decompressed-total cap — a zip bomb can under-report sizes, so count bytes as they land. */
const MAX_DECOMPRESSED_BYTES = 2 * 1024 * 1024 * 1024;
/** Upload categories worth carrying over. avatars is skipped on purpose: the
 *  import must never overwrite an existing TT user's avatar file. */
const UPLOAD_CATEGORIES: ServedCategory[] = ['covers', 'places', 'files', 'journey', 'photos'];

interface PreviewEntry {
  dir: string;
  dbPath: string;
  expiresAt: number;
}

export interface TrekTripSummary {
  id: number;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  currency: string | null;
  cover_image: string | null;
  is_archived: number;
  day_count: number;
  place_count: number;
  photo_count: number;
  budget_count: number;
}

/** Rows of `table` selected by `where`, with FK columns remapped to the new ids. */
type FkRemap = Record<string, (old: unknown) => unknown>;

@Injectable()
export class TrekImportService implements OnModuleDestroy {
  private previews = new Map<string, PreviewEntry>();

  constructor(
    private db: DatabaseService,
    private storage: StorageService,
  ) {}

  onModuleDestroy() {
    for (const entry of this.previews.values()) this.rmDir(entry.dir);
    this.previews.clear();
  }

  /** Extract a backup zip into a token-addressed temp dir and list its trips. */
  async previewFromZip(zipPath: string): Promise<{ token: string; trips: TrekTripSummary[] }> {
    const token = crypto.randomBytes(16).toString('hex');
    const dir = path.join(this.storage.tempDir(), `trek-import-${token}`);
    this.sweepExpired();
    try {
      await this.extractZip(zipPath, dir);
    } catch (err) {
      this.rmDir(dir);
      throw err;
    } finally {
      fs.rmSync(zipPath, { force: true });
    }

    const dbPath = this.findSnapshotDb(dir);
    if (!dbPath) {
      this.rmDir(dir);
      throw new Error('Invalid backup: travel.db not found');
    }

    let src: InstanceType<typeof Database> | null = null;
    try {
      src = new Database(dbPath, { readonly: true, fileMustExist: true });
      const tables = new Set(
        (src.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map(
          (t) => t.name,
        ),
      );
      for (const required of ['trips', 'days', 'places']) {
        if (!tables.has(required)) throw new Error(`Invalid backup: missing table ${required}`);
      }
      const trips = src.prepare('SELECT * FROM trips ORDER BY start_date DESC, id DESC').all() as Record<
        string,
        unknown
      >[];
      const summaries = trips.map((t) => {
        const id = Number(t.id);
        const count = (sql: string) => (src!.prepare(sql).get(id) as { n: number } | undefined)?.n ?? 0;
        return {
          id,
          title: String(t.title ?? ''),
          description: (t.description as string | null) ?? null,
          start_date: (t.start_date as string | null) ?? null,
          end_date: (t.end_date as string | null) ?? null,
          currency: (t.currency as string | null) ?? null,
          cover_image: (t.cover_image as string | null) ?? null,
          is_archived: Number(t.is_archived ?? 0),
          day_count: count('SELECT COUNT(*) AS n FROM days WHERE trip_id = ?'),
          place_count: count('SELECT COUNT(*) AS n FROM places WHERE trip_id = ?'),
          photo_count: tables.has('photos') ? count('SELECT COUNT(*) AS n FROM photos WHERE trip_id = ?') : 0,
          budget_count: tables.has('budget_items')
            ? count('SELECT COUNT(*) AS n FROM budget_items WHERE trip_id = ?')
            : 0,
        };
      });
      this.previews.set(token, { dir, dbPath, expiresAt: Date.now() + PREVIEW_TTL_MS });
      this.scheduleExpiry(token);
      return { token, trips: summaries };
    } catch (err) {
      src?.close();
      this.rmDir(dir);
      throw err;
    }
  }

  /**
   * Copy the selected trips (and everything hanging off them) into TT.
   * Each trip commits in its own transaction; returns the new trips in input order.
   */
  importTrips(userId: number, token: string, tripIds: number[]): { imported: { id: number; title: string }[] } {
    const entry = this.previews.get(token);
    if (!entry || entry.expiresAt < Date.now()) {
      if (entry) {
        this.previews.delete(token);
        this.rmDir(entry.dir);
      }
      throw new Error('Import session expired — upload the backup again');
    }

    const src = new Database(entry.dbPath, { readonly: true, fileMustExist: true });
    try {
      const srcTables = new Set(
        (src.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map(
          (t) => t.name,
        ),
      );
      this.copyUploads(entry.dir);

      const imported: { id: number; title: string }[] = [];
      for (const oldTripId of tripIds) {
        const newId = this.db.transaction(() => this.importOneTrip(userId, src, srcTables, Number(oldTripId)));
        imported.push(this.db.get('SELECT id, title FROM trips WHERE id = ?', newId) as { id: number; title: string });
      }
      this.previews.delete(token);
      this.rmDir(entry.dir);
      return { imported };
    } finally {
      src.close();
    }
  }

  // ── per-trip copy ───────────────────────────────────────────────────────────

  private importOneTrip(
    userId: number,
    src: InstanceType<typeof Database>,
    srcTables: Set<string>,
    oldTripId: number,
  ): number {
    const srcTrip = src.prepare('SELECT * FROM trips WHERE id = ?').get(oldTripId) as
      | Record<string, unknown>
      | undefined;
    if (!srcTrip) throw new Error(`Trip ${oldTripId} not found in backup`);
    const tripCols = this.commonCols('trips', src, 'trips', ['id', 'user_id']);
    const tripRow: Record<string, unknown> = { ...srcTrip };
    // A fresh share token: the old one may be circulating among TREK users.
    if (tripCols.includes('feed_token') && srcTrip.feed_token != null)
      tripRow.feed_token = crypto.randomBytes(16).toString('hex');
    // user_id is excluded from the copied columns (TREK user ids mean nothing
    // here) and re-added with the importer's id.
    const newTripId = this.insertRow('trips', [...tripCols, 'user_id'], { ...tripRow, user_id: userId });

    const tripOf = () => newTripId;
    const dayMap = this.copyScoped(src, srcTables, 'days', { trip_id: tripOf });
    const dayOf = (v: unknown) => dayMap.get(Number(v)) ?? null;

    // Places reference the backup's categories; map them onto the importer's
    // own categories by name (create the missing ones with their colour/icon).
    const catMap = new Map<number, number>();
    // trip_id is dropped from the source-mapped columns and re-added with the new id.
    const placeCols = [...this.commonCols('places', src, 'places', ['id', 'trip_id']), 'trip_id'];
    const placeMap = new Map<number, number>();
    const srcPlaces = src.prepare('SELECT * FROM places WHERE trip_id = ?').all(oldTripId) as Record<string, unknown>[];
    for (const p of srcPlaces) {
      const row: Record<string, unknown> = { ...p, trip_id: newTripId };
      if (p.category_id != null) {
        const oldCatId = Number(p.category_id);
        let newCatId = catMap.get(oldCatId);
        if (newCatId === undefined) {
          newCatId = this.mapCategory(userId, src, oldCatId);
          catMap.set(oldCatId, newCatId);
        }
        row.category_id = newCatId;
      }
      placeMap.set(Number(p.id), this.insertRow('places', placeCols, row));
    }
    const placeOf = (v: unknown) => (v == null ? null : (placeMap.get(Number(v)) ?? null));

    const assignMap = this.copyScoped(
      src,
      srcTables,
      'day_assignments',
      { day_id: dayOf, place_id: placeOf },
      `WHERE day_id IN (SELECT id FROM days WHERE trip_id = ${Number(oldTripId)})`,
    );
    const assignOf = (v: unknown) => (v == null ? null : (assignMap.get(Number(v)) ?? null));

    const reservationMap = this.copyScoped(
      src,
      srcTables,
      'reservations',
      {
        trip_id: tripOf,
        day_id: dayOf,
        end_day_id: dayOf,
        place_id: placeOf,
        assignment_id: assignOf,
      },
      `WHERE trip_id = ${Number(oldTripId)}`,
    );
    const reservationOf = (v: unknown) => (v == null ? null : (reservationMap.get(Number(v)) ?? null));

    this.copyScoped(
      src,
      srcTables,
      'day_notes',
      { trip_id: tripOf, day_id: dayOf },
      `WHERE trip_id = ${Number(oldTripId)}`,
    );
    this.copyScoped(src, srcTables, 'packing_items', { trip_id: tripOf }, `WHERE trip_id = ${Number(oldTripId)}`);
    this.copyScoped(src, srcTables, 'budget_items', { trip_id: tripOf }, `WHERE trip_id = ${Number(oldTripId)}`);
    this.copyScoped(
      src,
      srcTables,
      'photos',
      { trip_id: tripOf, day_id: dayOf, place_id: placeOf },
      `WHERE trip_id = ${Number(oldTripId)}`,
    );
    this.copyScoped(
      src,
      srcTables,
      'trip_files',
      { trip_id: tripOf, place_id: placeOf, reservation_id: reservationOf },
      `WHERE trip_id = ${Number(oldTripId)}`,
    );
    this.copyScoped(
      src,
      srcTables,
      'day_accommodations',
      { trip_id: tripOf, place_id: placeOf, start_day_id: dayOf, end_day_id: dayOf },
      `WHERE trip_id = ${Number(oldTripId)}`,
    );

    // Ratings by other TREK members cannot be attributed — they land as the
    // importer's rating so the aggregate survives the move.
    if (srcTables.has('place_ratings') && placeMap.size > 0) {
      const ratingCols = this.commonCols('place_ratings', src, 'place_ratings', ['id']);
      const ids = [...placeMap.keys()].join(',');
      for (const r of src.prepare(`SELECT * FROM place_ratings WHERE place_id IN (${ids})`).all() as Record<
        string,
        unknown
      >[]) {
        const placeId = placeMap.get(Number(r.place_id));
        if (!placeId) continue;
        this.insertRow('place_ratings', ratingCols, { ...r, place_id: placeId, user_id: userId });
      }
    }

    // Tags: reuse the importer's tag with the same name, else clone the TREK one.
    if (srcTables.has('place_tags') && placeMap.size > 0) {
      const ptCols = this.commonCols('place_tags', src, 'place_tags', []);
      const tagMap = new Map<number, number>();
      const ids = [...placeMap.keys()].join(',');
      const rels = src.prepare(`SELECT * FROM place_tags WHERE place_id IN (${ids})`).all() as Record<
        string,
        unknown
      >[];
      for (const rel of rels) {
        const placeId = placeMap.get(Number(rel.place_id));
        if (!placeId) continue;
        const oldTagId = Number(rel.tag_id);
        let tagId = tagMap.get(oldTagId);
        if (tagId === undefined) {
          const srcTag = src.prepare('SELECT * FROM tags WHERE id = ?').get(oldTagId) as
            | Record<string, unknown>
            | undefined;
          const existing = srcTag
            ? this.db.get<{ id: number }>(
                'SELECT id FROM tags WHERE user_id = ? AND name = ?',
                userId,
                String(srcTag.name ?? ''),
              )
            : undefined;
          const tagCols = this.commonCols('tags', src, 'tags', ['id', 'user_id']);
          tagId = existing?.id ?? this.insertRow('tags', [...tagCols, 'user_id'], { ...srcTag, user_id: userId });
          tagMap.set(oldTagId, tagId);
        }
        this.insertRow('place_tags', ptCols, { place_id: placeId, tag_id: tagId });
      }
    }

    return newTripId;
  }

  /**
   * Copy every row the where clause selects into TT's `table`, remapping FK
   * columns through `remap`. `id` is always dropped (fresh AUTOINCREMENT ids),
   * which is also what makes the old→new id map meaningful.
   */
  private copyScoped(
    src: InstanceType<typeof Database>,
    srcTables: Set<string>,
    table: string,
    remap: FkRemap,
    where?: string,
  ): Map<number, number> {
    const map = new Map<number, number>();
    if (!srcTables.has(table)) return map;
    const cols = this.commonCols(table, src, table, ['id']);
    const rows = src.prepare(`SELECT * FROM ${table} ${where ?? ''}`).all() as Record<string, unknown>[];
    for (const old of rows) {
      const row: Record<string, unknown> = { ...old };
      for (const [col, fn] of Object.entries(remap)) {
        if (cols.includes(col)) row[col] = fn(old[col]);
      }
      map.set(Number(old.id), this.insertRow(table, cols, row));
    }
    return map;
  }

  // ── helpers ─────────────────────────────────────────────────────────────────

  /** Columns present in BOTH the TT table and the source table, minus the skipped ones. */
  private commonCols(ttTable: string, src: InstanceType<typeof Database>, srcTable: string, skip: string[]): string[] {
    const srcCols = new Set(
      (src.prepare(`PRAGMA table_info('${srcTable}')`).all() as { name: string }[]).map((c) => c.name),
    );
    const ttCols = (this.db.prepare(`PRAGMA table_info('${ttTable}')`).all() as { name: string }[]).map((c) => c.name);
    return ttCols.filter((c) => srcCols.has(c) && !skip.includes(c));
  }

  private pragmaCache = new Map<string, { name: string; type: string; notnull: number; dflt_value: string | null }[]>();

  private tableInfo(table: string) {
    if (!this.pragmaCache.has(table)) {
      this.pragmaCache.set(
        table,
        this.db.prepare(`PRAGMA table_info('${table}')`).all() as {
          name: string;
          type: string;
          notnull: number;
          dflt_value: string | null;
        }[],
      );
    }
    return this.pragmaCache.get(table)!;
  }

  /**
   * TT columns that are NOT NULL without a default but absent from the backup's
   * (possibly older) schema. They cannot just be omitted — SQLite would reject
   * the row — so they are appended to the insert and filled below.
   */
  private completeRequired(table: string, cols: string[]): string[] {
    const missing = this.tableInfo(table)
      .filter((c) => c.notnull && c.dflt_value == null && c.name !== 'id' && !cols.includes(c.name))
      .map((c) => c.name);
    return missing.length ? [...cols, ...missing] : cols;
  }

  private insertRow(table: string, cols: string[], row: Record<string, unknown>): number {
    const finalCols = this.completeRequired(table, cols);
    const placeholders = finalCols.map(() => '?').join(',');
    const info = new Map(this.tableInfo(table).map((c) => [c.name, c]));
    const values = finalCols.map((c) => {
      const v = row[c];
      if (v !== undefined && v !== null) return v;
      const col = info.get(c);
      // An old TREK snapshot must not fail the import over a column it never
      // had: NOT NULL without default gets a type-appropriate empty value.
      if (col?.notnull && col.dflt_value == null) return /INT|REAL|FLOA|DOUB|NUM/i.test(col.type) ? 0 : '';
      return null;
    });
    const result = this.db
      .prepare(`INSERT INTO ${table} (${finalCols.join(',')}) VALUES (${placeholders})`)
      .run(...values);
    return Number(result.lastInsertRowid);
  }

  /** Find or create the importer's copy of a backup category. */
  private mapCategory(userId: number, src: InstanceType<typeof Database>, oldCatId: number): number {
    const srcCat = src.prepare('SELECT * FROM categories WHERE id = ?').get(oldCatId) as
      | Record<string, unknown>
      | undefined;
    if (srcCat) {
      const existing = this.db.get(
        'SELECT id FROM categories WHERE user_id = ? AND name = ?',
        userId,
        String(srcCat.name ?? ''),
      );
      if (existing) return Number((existing as { id: number }).id);
      const catCols = this.commonCols('categories', src, 'categories', ['id', 'user_id']);
      return this.insertRow('categories', [...catCols, 'user_id'], { ...srcCat, user_id: userId });
    }
    return this.insertRow('categories', ['name', 'color', 'icon', 'user_id'], {
      name: 'Imported',
      color: '#6366f1',
      icon: '📍',
      user_id: userId,
    });
  }

  /** Merge the backup's uploads into TT's storage (skip avatars). */
  private copyUploads(dir: string): void {
    const uploadsRoot = path.join(dir, 'uploads');
    if (!fs.existsSync(uploadsRoot)) return;
    for (const category of UPLOAD_CATEGORIES) {
      const catDir = path.join(uploadsRoot, category);
      if (!fs.existsSync(catDir)) continue;
      for (const entry of fs.readdirSync(catDir, { withFileTypes: true })) {
        if (entry.isDirectory()) continue;
        // put() commits a spooled file atomically into the storage backend, so
        // the /uploads/<category>/<key> URLs the imported rows carry resolve.
        void this.storage.put(category, entry.name, { tmpPath: path.join(catDir, entry.name) }).catch(() => {
          /* the row survives; only its image would miss */
        });
      }
    }
  }

  private findSnapshotDb(dir: string): string | null {
    const direct = path.join(dir, 'travel.db');
    if (fs.existsSync(direct)) return direct;
    const candidates: string[] = [];
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith('.db')) candidates.push(p);
      }
    };
    walk(dir);
    candidates.sort((a, b) => {
      const score = (p: string) => (/travel/i.test(path.basename(p)) ? 0 : 1);
      return score(a) - score(b);
    });
    return candidates[0] ?? null;
  }

  /** Zip-slip-safe, byte-counted extraction (same contract as the backup restore). */
  private async extractZip(zipPath: string, outDir: string): Promise<void> {
    const archive = await unzipper.Open.file(zipPath);
    const claimed = archive.files.reduce((sum, f) => sum + (f.uncompressedSize || 0), 0);
    if (claimed > MAX_DECOMPRESSED_BYTES) throw new Error('Backup exceeds the maximum decompressed size');
    fs.mkdirSync(outDir, { recursive: true });
    let written = 0;
    for (const entry of archive.files) {
      if (entry.type === 'Directory') continue;
      const dest = path.join(outDir, entry.path);
      const rel = path.relative(outDir, dest);
      if (rel.startsWith('..') || path.isAbsolute(rel))
        throw new Error('Invalid backup: entry path escapes the archive root');
      // Only the snapshot db and the upload files matter; anything else in the
      // archive is dead weight for this import.
      const isDb = rel === 'travel.db' || entry.path.endsWith('.db');
      const isUpload = entry.path.startsWith('uploads/');
      if (!isDb && !isUpload) continue;
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      await new Promise<void>((resolve, reject) => {
        const source = entry.stream();
        const out = fs.createWriteStream(dest);
        source.on('data', (chunk: Buffer) => {
          written += chunk.length;
          if (written > MAX_DECOMPRESSED_BYTES) {
            source.destroy();
            out.destroy();
            reject(new Error('Backup exceeds the maximum decompressed size'));
          }
        });
        source.on('error', reject);
        out.on('error', reject);
        out.on('finish', resolve);
        source.pipe(out);
      });
    }
  }

  private scheduleExpiry(token: string): void {
    setTimeout(() => {
      const entry = this.previews.get(token);
      if (entry && entry.expiresAt < Date.now()) {
        this.previews.delete(token);
        this.rmDir(entry.dir);
      }
    }, PREVIEW_TTL_MS + 1000).unref?.();
  }

  private sweepExpired(): void {
    const now = Date.now();
    for (const [token, entry] of this.previews) {
      if (entry.expiresAt < now) {
        this.previews.delete(token);
        this.rmDir(entry.dir);
      }
    }
  }

  private rmDir(dir: string): void {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
