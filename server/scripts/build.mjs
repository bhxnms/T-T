import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

// Resolve tsc through its own package rather than by name.
//
// `execFileSync('tsc', …)` works on Linux and fails on Windows with
// `spawnSync tsc ENOENT`: npm installs a `tsc.cmd` shim, not an executable, and
// execFileSync does not consult PATHEXT. Resolving `typescript/bin/tsc` gives
// the actual JavaScript entry point, which the running Node executes directly —
// so the same command works on every platform, with no shell involved (a shell
// would reintroduce quoting problems for paths containing spaces).
const require = createRequire(import.meta.url);
const tsc = require.resolve('typescript/bin/tsc');
const serverDir = path.resolve(import.meta.dirname, '..');

execFileSync(process.execPath, [tsc, '-p', 'tsconfig.build.json'], {
  stdio: 'inherit',
  // tsc resolves `-p` and every relative path in the tsconfig from its CWD.
  cwd: serverDir,
});
console.log('[build] dist ready.');
