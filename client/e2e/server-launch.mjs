// Boots the TREK backend for the Playwright E2E run against a fresh, isolated
// SQLite database. The DB file is deleted first so every run starts clean, then
// the server's own startup seeds a known admin from ADMIN_EMAIL/ADMIN_PASSWORD.
//
// The server is built once and launched as a SINGLE node process (not the
// watch-mode `npm run dev`, which spawns tsc -w + node --watch grandchildren
// that survive Playwright's teardown and then linger on :3001 with stale DB
// state). A single child is killed cleanly when Playwright tears the run down.
import { execSync, spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dbFile = path.join(here, '.tmp', 'e2e.db');
const serverDir = path.join(here, '..', '..', 'server');

for (const f of [dbFile, `${dbFile}-wal`, `${dbFile}-shm`]) {
  try {
    rmSync(f, { force: true });
  } catch {}
}

// Build once (no watcher) — the resulting process is a single killable node.
execSync('node scripts/build.mjs', { cwd: serverDir, stdio: 'inherit' });

const env = {
  ...process.env,
  TREK_DB_FILE: dbFile,
  ADMIN_EMAIL: 'e2e@trek.local',
  ADMIN_PASSWORD: 'E2eTest12345!',
  PORT: '3001',
  NODE_ENV: 'development',
};

const child = spawn(process.execPath, ['--require', 'tsconfig-paths/register', 'dist/index.js'], {
  cwd: serverDir,
  env,
  stdio: 'inherit',
});
let stopping = false;
let forceTimer;
const stop = () => {
  if (stopping) return;
  stopping = true;
  child.kill('SIGTERM');
  forceTimer = setTimeout(() => {
    if (!child.killed) child.kill('SIGKILL');
  }, 5000);
  forceTimer.unref();
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
process.on('exit', () => {
  if (!stopping) child.kill('SIGTERM');
});
child.on('exit', (code) => {
  if (forceTimer) clearTimeout(forceTimer);
  process.exit(code ?? 0);
});
