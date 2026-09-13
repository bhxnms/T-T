import { RuntimeEnvService } from '../app-config/runtime-env.service';
import { DatabaseService } from '../database/database.service';
import { isDemoEmail } from './demo';

/** The exact 403 body the six upload endpoints have always returned. */
export const DEMO_WRITE_ERROR = {
  error: 'Uploads are disabled in demo mode. Self-host TREK for full functionality.',
} as const;

/**
 * Whether this user's writes are blocked because the instance runs in demo mode.
 *
 * The condition was copy-pasted into six upload handlers, each with its own copy
 * of the message. It lives here once now, and every one of them calls it.
 *
 * Deliberately a function and not a guard, though all six sites are handlers and
 * a guard is the obvious shape. Guards run before the multipart parser, so
 * throwing from one leaves the request body unread and Node resets the
 * connection: the client sees ECONNRESET instead of the 403. PROFILE-015 catches
 * exactly that. Checking inside the handler, after the interceptor has drained
 * the upload, is what makes the response arrive.
 */
export function isDemoWriteBlocked(env: RuntimeEnvService, email: string | null | undefined): boolean {
  return env.isDemoMode() && isDemoEmail(email);
}

/**
 * The user-id flavour of the demo guard — the AuthService.isDemoUser body,
 * relocated so surfaces that hold only a user id (the *.mcp.ts demo guards)
 * don't need the whole auth graph for one check.
 */
export function isDemoUserId(env: RuntimeEnvService, db: DatabaseService, userId: number): boolean {
  if (!env.isDemoMode()) return false;
  const user = db.get<{ email: string }>('SELECT email FROM users WHERE id = ?', userId);
  return isDemoEmail(user?.email);
}
