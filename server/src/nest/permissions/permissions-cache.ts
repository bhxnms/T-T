import type { PermissionLevel } from './permissions.service';

/**
 * The permissions cache — module state on purpose, in its own home (the
 * oauth.pending-codes.ts precedent) so every path that must see one shared
 * cache actually does: the container PermissionsService singleton, the
 * permissions.bridge instance the MCP _shared helper reaches, and the plain
 * backup restore path (backup.impl.ts), which is free functions by design and
 * has nothing to hang an injected service off. A restore rewrites
 * app_settings under the request path's feet; invalidating here is what keeps
 * every reader consistent afterwards.
 */
let cache: Map<string, PermissionLevel> | null = null;

export function getPermissionsCache(): Map<string, PermissionLevel> | null {
  return cache;
}

/** Install a fresh cache map and return it (the loader fills it in place). */
export function setPermissionsCache(next: Map<string, PermissionLevel>): Map<string, PermissionLevel> {
  cache = next;
  return next;
}

export function invalidatePermissionsCache(): void {
  cache = null;
}
