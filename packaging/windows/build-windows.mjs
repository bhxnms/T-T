/**
 * Build the Windows portable package.
 *
 * Produces `TT-Travel-Planner-<version>-win-x64.zip`, which a user extracts and
 * runs by double-clicking `TT Travel Planner.exe`. Nothing is installed and no
 * Node has to be present on the machine.
 *
 * Layout of the produced folder:
 *
 *   TT Travel Planner.exe     launcher: port preflight, starts the server, opens the browser
 *   runtime/node.exe          the Node runtime the launcher and server run on
 *   app/server/               server dist + its node_modules + assets
 *   app/server/public/        the built client (index.html + assets)
 *   app/server/data/          database, logs, secrets   (created on first run)
 *   app/server/uploads/       photos, documents, covers (created on first run)
 *   app/wiki/                 the in-app help pages
 *   tt-port.json              the chosen port, written on first run
 *   README.txt                the same instructions, offline
 *
 * Why the app lives under `app/server/` rather than at the root: the server
 * derives `data/`, `uploads/`, `public/` and `wiki/` from `__dirname`
 * (see storage-paths.ts and help/wiki.ts), so the depth it expects has to be
 * reproduced exactly. In Docker those are symlinks to mounted volumes; here they
 * are simply real directories inside `app/server/`, which is why no symlinks —
 * and therefore nothing a zip has to preserve — are involved.
 *
 * Run: node packaging/windows/build-windows.mjs
 * CI:  .github/workflows/windows-package.yml (on windows-latest, which supplies
 *      a real Windows node.exe to embed and can run better-sqlite3's installer).
 */

import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const OUT_ROOT = path.join(HERE, 'out');
const STAGE = path.join(OUT_ROOT, 'TT-Travel-Planner');

const isWindows = process.platform === 'win32';
/** The exe name the launcher is built as — also the README's instruction. */
const LAUNCHER_NAME = 'TT Travel Planner.exe';

/**
 * The Node build embedded as `runtime/node.exe` when cross-building.
 *
 * One constant because two things must agree exactly: the runtime the user
 * executes, and the ABI better-sqlite3's binary is fetched for (node-v137 for
 * Node 24.x). They are used together — a runtime whose ABI differs from the
 * native module's is rejected at require() with a message about a version
 * mismatch that names neither the offender nor the fix.
 *
 * Kept on the Node 24 line to match the Dockerfile's `node:24-*`.
 */
const WINDOWS_NODE_VERSION = process.env.WINDOWS_NODE_VERSION || 'v24.11.0';

const say = (msg) => process.stdout.write(`${msg}\n`);
const step = (msg) => say(`\n[build] ${msg}`);

/**
 * Run a command, inheriting stdio.
 *
 * On Windows this goes through cmd.exe, which splits arguments on spaces — so
 * anything containing one has to be quoted or it arrives as two arguments. That
 * is not hypothetical: `-ldflags=-s -w` reached Go as `-ldflags=-s` plus a bare
 * `-w`, which Go rejects, and the launcher output path contains the space in
 * "TT Travel Planner.exe". Quoting here rather than at each call site means a
 * future argument with a space cannot silently reintroduce the same failure.
 *
 * On Linux no shell is involved, so argv is passed through verbatim and the
 * function is a plain passthrough.
 */
function run(cmd, args, opts = {}) {
  const finalArgs = isWindows ? args.map((a) => (/\s/.test(a) ? `"${a}"` : a)) : args;
  execFileSync(cmd, finalArgs, { stdio: 'inherit', cwd: REPO, shell: isWindows, ...opts });
}

function version() {
  return JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8')).version;
}

/** Copy a tree, resolving symlinks to real files/directories. */
function copyTree(from, to, filter) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (filter && !filter(src, entry)) continue;
    // statSync (not the dirent) so a workspace symlink is followed: npm links
    // `node_modules/@trek/shared` to `../../shared`, and a zip cannot carry that
    // link. Following it materialises the package where Node will look for it.
    const stat = fs.statSync(src);
    if (stat.isDirectory()) copyTree(src, dest, filter);
    else fs.copyFileSync(src, dest);
  }
}

/**
 * Build the app (shared → server → client) exactly as the Docker image does, so
 * the two artifacts cannot drift in what they contain.
 */
function buildApp() {
  step('building shared, server and client');
  run('npm', ['run', 'build', '--workspace=shared']);
  run('npm', ['run', 'build', '--workspace=server']);
  run('npm', ['run', 'build', '--workspace=client']);
}

/**
 * Install the server's production dependencies into the staging tree.
 *
 * `--omit=dev` drops the toolchain (eslint, vitest, typescript), which is most
 * of the size.
 *
 * `--ignore-scripts` matters more than it looks. With scripts enabled,
 * better-sqlite3's install step runs prebuild-install, which resolves the
 * prebuilt binary from the HOST platform — so cross-building on Linux stages a
 * Linux ELF file that fails on the user's Windows machine at the first query,
 * with an error that names neither the file nor the cause. Installing with
 * scripts off and fetching the Windows binary explicitly (below) is what makes
 * the cross-build correct rather than merely successful.
 *
 * On windows-latest the host IS the target, so the explicit fetch is skipped and
 * the normal install path is used.
 */
function installServerDeps(appServer) {
  step('installing server production dependencies');
  const appShared = path.join(STAGE, 'app', 'shared');
  fs.mkdirSync(appShared, { recursive: true });
  fs.copyFileSync(path.join(REPO, 'shared', 'package.json'), path.join(appShared, 'package.json'));
  // `shared/dist` is what the server actually imports (@trek/shared resolves to
  // it through the package exports map), so it has to be in place before the
  // workspace links are materialised below.
  copyTree(path.join(REPO, 'shared', 'dist'), path.join(appShared, 'dist'));
  fs.copyFileSync(path.join(REPO, 'server', 'package.json'), path.join(appServer, 'package.json'));

  // A minimal workspaces manifest: npm needs to know these two are workspaces so
  // it links them and installs their deps, and nothing else should be touched.
  const rootPkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));
  fs.writeFileSync(
    path.join(STAGE, 'package.json'),
    `${JSON.stringify(
      {
        name: rootPkg.name,
        private: true,
        version: rootPkg.version,
        workspaces: ['app/server', 'app/shared'],
      },
      null,
      2,
    )}\n`,
  );

  const args = ['install', '--omit=dev', '--no-audit', '--no-fund'];
  if (!isWindows) args.push('--ignore-scripts');
  run('npm', args, { cwd: STAGE });

  materialiseWorkspaceLinks(appServer);
  if (!isWindows) installWindowsSqlite();
  // Order matters: the hoist moves the tree the symlink strip walks.
  hoistModulesUnderApp();
  stripBinSymlinks();
}

/**
 * Move the hoisted `node_modules` from the package root to `app/`.
 *
 * `server/tsconfig.json` maps the MCP SDK to `../node_modules/...`, resolved
 * against its own `baseUrl: "."` — i.e. a `node_modules` **beside** `server/`.
 * The Docker image satisfies that (`/app/node_modules` next to `/app/server`),
 * and `tsconfig-paths/register` runs before Node's own resolution, so when the
 * mapping points at a path that does not exist it does not fall through to the
 * hoisted tree: the boot dies with MODULE_NOT_FOUND on a module that is plainly
 * present two levels up.
 *
 * npm hoists a workspace's dependencies to the workspace ROOT, which here is the
 * package root — one level too high. Moving the directory reproduces the layout
 * the tsconfig was written against, which is why this is a move rather than a
 * change to the tsconfig: the mapping is correct for every other install shape
 * (repo checkout, Docker), and editing it to suit the zip would break those.
 */
function hoistModulesUnderApp() {
  const from = path.join(STAGE, 'node_modules');
  const to = path.join(STAGE, 'app', 'node_modules');
  if (!fs.existsSync(from)) return;
  fs.rmSync(to, { recursive: true, force: true });
  fs.renameSync(from, to);
  say(`[build]   moved node_modules under app/ (matches server/tsconfig.json's ../node_modules)`);
}

/**
 * Drop every `node_modules/.bin` directory from the staged tree.
 *
 * These hold symlinks to package CLI binaries. The server never uses them — it
 * loads libraries by package name, not through the shell — but they would not
 * survive the zip: Windows' extractor turns a symlink into either a broken entry
 * or a copy of nothing, and `npm` created 20 of them here.
 *
 * Removing them is not cosmetic. The build's own verification rejects symlinks,
 * because a materialised workspace link is exactly the failure this packaging
 * exists to avoid, and distinguishing "harmless .bin link" from "the @trek link
 * that breaks the boot" by inspecting targets is fragile. Deleting a directory
 * nothing reads is the simpler, safer rule.
 *
 * Must run after the last npm install: npm recreates .bin on every run.
 */
function stripBinSymlinks() {
  const removed = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      // lstat so a symlink is not silently followed into the target tree.
      let isDir = e.isDirectory();
      let isLink = e.isSymbolicLink();
      if (isLink) {
        try {
          isDir = fs.statSync(full).isDirectory();
        } catch {
          continue; // already dangling
        }
      }
      if (isDir) {
        if (e.name === '.bin') {
          fs.rmSync(full, { recursive: true, force: true });
          removed.push(full.replace(STAGE, ''));
          continue;
        }
        walk(full);
      }
    }
  };
  walk(path.join(STAGE, 'app', 'node_modules'));
  if (removed.length > 0) say(`[build]   removed ${removed.length} .bin director${removed.length === 1 ? 'y' : 'ies'}`);
}

/**
 * Replace the workspace symlinks npm creates with real directories.
 *
 * npm links a workspace (`node_modules/@trek/shared -> ../../app/shared`) rather
 * than copying it. That is correct on a filesystem and fatal in a zip: the
 * archive format has no portable way to express a symlink, so Windows'
 * extractor either drops it or produces a broken entry, and `require('@trek/shared')`
 * then fails at boot with MODULE_NOT_FOUND on a folder that looks present.
 *
 * The server reads `shared/dist` (the built package), so that is what gets
 * copied in. Every link under `node_modules/@trek/` is handled, not just the one
 * name, so adding a workspace later cannot silently reintroduce the problem.
 */
function materialiseWorkspaceLinks(appServer) {
  const scope = path.join(STAGE, 'node_modules', '@trek');
  if (!fs.existsSync(scope)) return;

  for (const entry of fs.readdirSync(scope)) {
    const link = path.join(scope, entry);
    if (!fs.lstatSync(link).isSymbolicLink()) continue;

    const real = fs.realpathSync(link);
    const dist = path.join(real, 'dist');
    const pkgJson = path.join(real, 'package.json');
    if (!fs.existsSync(pkgJson)) continue;

    // Only what the runtime needs: the manifest, the built output, and — for
    // shared — the i18n subpath its exports map points at (inside dist already).
    fs.rmSync(link, { recursive: true, force: true });
    fs.mkdirSync(link, { recursive: true });
    fs.copyFileSync(pkgJson, path.join(link, 'package.json'));
    if (fs.existsSync(dist)) copyTree(dist, path.join(link, 'dist'));
    say(`[build]   materialised workspace link: @trek/${entry}`);
  }
  void appServer;
}

/**
 * Fetch the win32-x64 prebuilt for better-sqlite3 into the staged tree.
 *
 * Only used when cross-building. `prebuild-install --platform=win32` asks
 * better-sqlite3's release page for the binary built for the Windows Node ABI,
 * which is the one the embedded runtime will load. The target version must match
 * runtime/node.exe exactly — a mismatch (say node-v127 against a Node 24 runtime)
 * is rejected at require() time with "was compiled against a different Node.js
 * version", so the version is pinned in one place and used for both.
 *
 * The package sits at the staging ROOT's node_modules: npm hoists a workspace's
 * dependencies there, and Node's upward resolution from `app/server/` finds it.
 */
function installWindowsSqlite() {
  step('fetching the win32 better-sqlite3 prebuilt (cross-build)');
  const pkgDir = path.join(STAGE, 'node_modules', 'better-sqlite3');
  if (!fs.existsSync(pkgDir)) {
    say(`[build] better-sqlite3 is not installed at ${pkgDir} — cannot fetch its binary.`);
    process.exit(1);
  }
  const cli = path.join(STAGE, 'node_modules', '.bin', 'prebuild-install');
  if (!fs.existsSync(cli)) {
    say(`[build] prebuild-install is missing at ${cli}.`);
    process.exit(1);
  }
  run(
    cli,
    ['--platform=win32', '--arch=x64', `--target=${WINDOWS_NODE_VERSION.replace(/^v/, '')}`, '--force'],
    { cwd: pkgDir, shell: false },
  );
}

/** Copy the runtime data the server reads at boot (assets, wiki) into place. */
function copyRuntimeAssets(appServer) {
  step('copying runtime assets and wiki');
  copyTree(path.join(REPO, 'server', 'assets'), path.join(appServer, 'assets'));
  copyTree(path.join(REPO, 'client', 'dist'), path.join(appServer, 'public'));
  // The server expects `wiki/` one level above `server/` (help/wiki.ts resolves
  // four levels up from dist/nest/help), which is `app/wiki` here.
  copyTree(path.join(REPO, 'wiki'), path.join(STAGE, 'app', 'wiki'));

  // tsconfig.json so tsconfig-paths/register can resolve the MCP SDK paths the
  // Docker image also copies for this reason.
  fs.copyFileSync(path.join(REPO, 'server', 'tsconfig.json'), path.join(appServer, 'tsconfig.json'));
}

/**
 * Extract one file out of a zip archive.
 *
 * Three hosts, three available tools: PowerShell expands archives on Windows,
 * `unzip` exists on most Linux images but not all, and Python is the last
 * resort. Falling back rather than failing keeps the cross-build usable from a
 * minimal container, and the Windows CI path never needs any of them (it embeds
 * the host's own node.exe).
 */
function extractFromZip(zipPath, innerPath, destDir) {
  const has = (cmd) => {
    try {
      execFileSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  };

  if (has('unzip')) {
    execSync(`unzip -o -j "${zipPath}" "${innerPath}" -d "${destDir}"`, { stdio: 'inherit' });
    return;
  }
  if (has('python3')) {
    execFileSync(
      'python3',
      [
        '-c',
        [
          'import sys, zipfile, os, shutil',
          'zf, inner, dest = sys.argv[1], sys.argv[2], sys.argv[3]',
          'os.makedirs(dest, exist_ok=True)',
          'with zipfile.ZipFile(zf) as z:',
          '    with z.open(inner) as src, open(os.path.join(dest, os.path.basename(inner)), "wb") as out:',
          '        shutil.copyfileobj(src, out)',
        ].join('\n'),
        zipPath,
        innerPath,
        destDir,
      ],
      { stdio: 'inherit' },
    );
    return;
  }
  say('[build] none of unzip/python3 is available to extract the Node runtime.');
  say('[build]   On Windows this never happens (the host node.exe is embedded).');
  process.exit(1);
}

/** The Node runtime to embed. On Windows it is the host's own; CI provides one. */
function copyRuntime() {
  step('embedding the Node runtime');
  const dest = path.join(STAGE, 'runtime');

  if (isWindows) {
    const src = process.execPath;
    fs.mkdirSync(dest, { recursive: true });
    fs.copyFileSync(src, path.join(dest, 'node.exe'));
    say(`[build]   embedded ${src}`);
    return;
  }

  // Cross-building on Linux: the build host cannot supply a Windows node.exe, so
  // one is downloaded. Kept in lockstep with the Dockerfile's `node:24-*` so the
  // same major runs in every artifact.
  const version = WINDOWS_NODE_VERSION;
  const archive = `node-${version}-win-x64.zip`;
  const cache = path.join(OUT_ROOT, '.cache');
  const zip = path.join(cache, archive);
  fs.mkdirSync(cache, { recursive: true });
  if (!fs.existsSync(zip)) {
    const url = `https://nodejs.org/dist/${version}/${archive}`;
    say(`[build]   downloading ${url}`);
    execSync(`curl -fsSL -o "${zip}" "${url}"`, { stdio: 'inherit' });
  }
  fs.mkdirSync(dest, { recursive: true });
  // Extract just node.exe: the rest of the archive (npm, docs, headers) is
  // ~60 MB the server never touches.
  extractFromZip(zip, `node-${version}-win-x64/node.exe`, dest);
  say(`[build]   extracted node.exe from ${archive}`);
}

/**
 * Compile the launcher exe.
 *
 * `run` quotes what needs it, so `-ldflags=-s -w` and the spaced output path
 * survive cmd.exe intact on Windows.
 */
function buildLauncher() {
  step('building the launcher');
  const dir = path.join(HERE, 'launcher');
  const go = process.env.GO_BINARY || 'go';
  const env = { ...process.env, CGO_ENABLED: '0', GOOS: 'windows', GOARCH: 'amd64' };
  if (process.env.GOCACHE) env.GOCACHE = process.env.GOCACHE;
  run(go, ['build', '-trimpath', '-ldflags=-s -w', '-o', path.join(STAGE, LAUNCHER_NAME), '.'], { cwd: dir, env });
}

/** The instructions a user needs when GitHub is not in front of them. */
function writeReadme() {
  const v = version();
  fs.writeFileSync(
    path.join(STAGE, 'README.txt'),
    `TT Travel Planner ${v} — Windows (portable)

HOW TO RUN
  1. Keep every file in this folder together. Nothing is installed.
  2. Double-click "${LAUNCHER_NAME}".
  3. A console window opens and your browser follows. The first run takes a
     minute while it sets up its database.

WHERE THINGS ARE
  data\\     Your trips, photos and settings. Back this folder up.
  uploads\\  Uploaded files.
  tt-port.json  The port in use, written automatically. See below.

IF PORT 3001 IS ALREADY IN USE
  The app checks before starting and moves to the next free port (up to 20
  along), then tells you which one it picked. To pin a specific port instead,
  edit tt-port.json and set it:

      { "port": 8080 }

  If that port is taken too, the app moves on and says so.

FIRST-RUN ADMIN ACCOUNT
  The console window prints the generated admin e-mail and password the first
  time you start. Write them down — the password is only shown there. You will
  be asked to change it on first sign-in.

STOPPING THE APP
  Close the console window, or press Ctrl+C in it. The browser tab is just a
  front end; the console window is the app.

TROUBLESHOOTING
  - Windows Firewall may ask for permission the first time. Allow it for
    private networks; the app only needs to be reachable from this machine
    unless you deliberately expose it.
  - If the browser does not open by itself, the console window prints the
    address to open (for example http://localhost:3001).
  - Booking-import from e-mail/PDF files is unavailable on Windows: it needs a
    KDE helper that does not exist here. Everything else works.
  - Logs are in app\\server\\data\\logs\\.

Documentation and newer versions: https://github.com/bhxnms/T-T
`,
    'utf8',
  );
}

/**
 * Zip the staged folder.
 *
 * PowerShell on Windows, `zip` on Linux, and a Python fallback for a host with
 * neither — the fallback matters because the CI image and a minimal dev box
 * disagree about which of the two they ship, and failing the whole build over
 * the archive step after everything else succeeded would be a poor trade.
 */
function makeZip() {
  step('packaging the zip');
  const name = `TT-Travel-Planner-${version()}-win-x64.zip`;
  const target = path.join(OUT_ROOT, name);
  fs.rmSync(target, { force: true });

  const has = (cmd) => {
    try {
      execFileSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  };

  if (isWindows) {
    execFileSync(
      'powershell',
      ['-NoProfile', '-Command', `Compress-Archive -Path '${STAGE}' -DestinationPath '${target}' -Force`],
      { stdio: 'inherit' },
    );
  } else if (has('zip')) {
    // -r from the parent so the archive contains the folder itself, which is
    // what makes "extract here" produce one directory instead of a mess.
    execSync(`cd "${OUT_ROOT}" && zip -qr "${name}" "${path.basename(STAGE)}"`, { stdio: 'inherit' });
  } else {
    execFileSync(
      'python3',
      [
        '-c',
        // zipfile rather than shelling out: no extra dependency, and it writes
        // forward-slash entry names, which Windows' own extractor accepts.
        `import shutil, sys; shutil.make_archive(sys.argv[1], 'zip', sys.argv[2], sys.argv[3])`,
        target.replace(/\.zip$/, ''),
        OUT_ROOT,
        path.basename(STAGE),
      ],
      { stdio: 'inherit' },
    );
  }

  const mb = (fs.statSync(target).size / 1024 / 1024).toFixed(1);
  say(`\n[build] ${name} (${mb} MB)`);
  say(`[build] staged tree: ${STAGE}`);
  return target;
}

function main() {
  if (!isWindows && !fs.existsSync('/tmp/go/bin/go') && !process.env.GO_BINARY) {
    // A clear message beats a confusing "go: not found" halfway through.
    say('[build] Go is required to build the launcher.');
    say('[build]   Windows CI provides it; locally set GO_BINARY or install Go.');
    process.exit(1);
  }

  fs.rmSync(STAGE, { recursive: true, force: true });
  fs.mkdirSync(path.join(STAGE, 'app', 'server'), { recursive: true });

  buildApp();

  const appServer = path.join(STAGE, 'app', 'server');
  copyTree(path.join(REPO, 'server', 'dist'), path.join(appServer, 'dist'));
  installServerDeps(appServer);
  copyRuntimeAssets(appServer);
  copyRuntime();
  buildLauncher();
  writeReadme();

  // Sanity checks on the artifact itself, so a packaging regression fails here
  // rather than on a user's machine.
  step('verifying the staged tree');
  const modules = path.join(STAGE, 'app', 'node_modules');
  const mustExist = [
    path.join(STAGE, LAUNCHER_NAME),
    path.join(STAGE, 'runtime', 'node.exe'),
    path.join(appServer, 'dist', 'index.js'),
    path.join(appServer, 'public', 'index.html'),
    path.join(appServer, 'assets', 'atlas', 'admin0.geojson.gz'),
    path.join(STAGE, 'app', 'wiki', 'Home.md'),
    path.join(modules, 'better-sqlite3', 'package.json'),
    path.join(modules, 'tsconfig-paths', 'package.json'),
    // The workspace package must be a real directory: a symlink here would not
    // survive the zip and the server would fail to boot.
    path.join(modules, '@trek', 'shared', 'dist', 'index.cjs'),
  ];
  const missing = mustExist.filter((p) => !fs.existsSync(p));
  if (missing.length > 0) {
    say('[build] MISSING from the staged tree:');
    missing.forEach((p) => say(`[build]   ${p.replace(STAGE, '')}`));
    process.exit(1);
  }

  const links = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isSymbolicLink()) links.push(full);
      else if (e.isDirectory()) walk(full);
    }
  };
  walk(modules);
  if (links.length > 0) {
    say('[build] SYMLINKS in the staged tree (a zip will not preserve these):');
    links.slice(0, 10).forEach((p) => say(`[build]   ${p.replace(STAGE, '')}`));
    process.exit(1);
  }

  // The native binary specifically: SQLite fails on the first query without it,
  // long after the launcher has already reported success.
  const releaseDir = path.join(modules, 'better-sqlite3', 'build', 'Release');
  const nativeBinary = fs.existsSync(releaseDir) ? fs.readdirSync(releaseDir).find((f) => f.endsWith('.node')) : undefined;
  if (!nativeBinary) {
    say('[build] better-sqlite3 has no compiled binary — the app would fail on its first query.');
    process.exit(1);
  }
  // When cross-building, the binary must be the Windows one. A Linux ELF file
  // here is the exact mistake that installs cleanly and fails on the user's
  // machine, so it is checked by content rather than assumed from the flags.
  const nativePath = path.join(releaseDir, nativeBinary);
  const head = fs.readFileSync(nativePath).subarray(0, 2).toString('latin1');
  if (!isWindows && head !== 'MZ') {
    say(`[build] ${nativeBinary} is not a Windows binary (first bytes "${head}") — the cross-build is wrong.`);
    process.exit(1);
  }
  say(`[build] stage verified (native module: ${nativeBinary})`);

  makeZip();
}

main();
