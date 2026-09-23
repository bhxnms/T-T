import { readEnv } from '../../app-config';

import fs from 'node:fs';
import path from 'node:path';

// Whether this server process should serve the built client itself.
//
// Deliberately a leaf module: platform.routes.ts (the static mount), the SPA
// fallback filter and the OIDC callback all need this answer, and routing them
// through platform.routes.ts would drag its Express/storage/db import graph
// into every one of them.
//
// IMPORTANT — path resolution: this file lives three levels below src/ (here:
// dist/nest/platform/), so '../../../public' anchors at the same directory the
// legacy one-level '../public' did in src/app.ts. rootDir/outDir preserve the
// tree, so the offset holds in both source/test and compiled/dist execution.

export const PUBLIC_DIR = path.join(__dirname, '../../../public');

/**
 * Whether a built client has been staged into PUBLIC_DIR.
 *
 * This — not NODE_ENV — is what decides whether the server serves the frontend.
 * The original gate conflated two different questions ("is this a production
 * deployment?" and "is there a built client to serve?"), and the portable
 * Windows package is where that conflation breaks: its launcher deliberately
 * leaves NODE_ENV unset, because production ALSO switches on `Secure` session
 * cookies and HSTS, which silently break a plain-HTTP localhost install (the
 * browser drops the cookie, so login appears to succeed and then bounces back).
 * So the package shipped a fully built client while the server refused to serve
 * it: /api/health answered 200 and every page 404'd.
 *
 * The file's presence is exactly the condition we mean, in every distribution
 * shape, with nothing for anyone to remember to set:
 *   - dev checkout    → only .gitkeep here, client served by Vite on 5173 → skip
 *   - Docker image    → client/dist copied in by the Dockerfile          → serve
 *   - Windows package → client/dist copied in by build-windows.mjs       → serve
 */
export function hasBuiltClient(): boolean {
  return fs.existsSync(path.join(PUBLIC_DIR, 'index.html'));
}

/**
 * The single gate the static mount, the SPA catch-all and the OIDC callback
 * all consult.
 *
 * `production` is kept as an explicit disjunct so a production deployment with
 * no staged client behaves exactly as it did before this change (the static
 * mount registers as a harmless no-op) — this fix only ever ADDS serving, never
 * removes it.
 */
export function shouldServeClient(): boolean {
  return readEnv().app.nodeEnv === 'production' || hasBuiltClient();
}
