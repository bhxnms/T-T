import path from 'node:path';

/**
 * The storage domain's one `__dirname` anchor (the uploads-root.ts idiom, and
 * eventually its replacement: the registry's defaults make this the single
 * source of truth the other 16 copies collapse onto in later slices).
 *
 * `__dirname` moves with the file — `server/{src,dist}/nest/storage` sits
 * three levels under `server/`, so three `..` hops resolve to `<server>/`
 * under both the src (vitest) and dist (runtime) layouts. The depth is stated
 * rather than counted by hand and pinned by storage-keys.test.ts, exactly
 * like uploads-root.test.ts pins UPLOADS_ROOT. In Docker both anchors are
 * symlinks (`/app/server/uploads → /app/uploads`, `/app/server/data →
 * /app/data`), which is why LocalDriver realpaths its root at init.
 */
export const DEFAULT_UPLOADS_ROOT = path.resolve(__dirname, '..', '..', '..', 'uploads');
export const DATA_ROOT = path.resolve(__dirname, '..', '..', '..', 'data');
export const DEFAULT_BACKUPS_ROOT = path.join(DATA_ROOT, 'backups');
/** Driver-agnostic global scratch space (`data/tmp`) — see StorageService.tempDir(). */
export const GLOBAL_TEMP_DIR = path.join(DATA_ROOT, 'tmp');
/** Seed-once boot provisioning file — imported only when no storage.* row exists. */
export const SEED_CONFIG_PATH = path.join(DATA_ROOT, 'storage-config.json');
