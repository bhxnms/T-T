const COMMON_PASSWORDS = new Set([
  'password',
  '12345678',
  '123456789',
  '1234567890',
  'password1',
  'qwerty123',
  'iloveyou',
  'admin123',
  'letmein12',
  'welcome1',
  'monkey123',
  'dragon12',
  'master12',
  'qwerty12',
  'abc12345',
  'trustno1',
  'baseball',
  'football',
  'shadow12',
  'michael1',
  'jennifer',
  'superman',
  'abcdefgh',
  'abcd1234',
  'password123',
  'admin1234',
  'changeme',
  'welcome123',
  'passw0rd',
  'p@ssword',
]);

/**
 * Why a password was rejected, as a stable identifier.
 *
 * The client renders this through its own translation bundles, so the reasons
 * travel as codes rather than as prose. They used to be English sentences
 * returned from the server, which meant a Chinese (or any non-English) user got
 * an English error on an otherwise translated form — the one string the UI had
 * no way to localize because it never passed through the i18n layer.
 */
export type PasswordRejection = 'tooShort' | 'tooRepetitive' | 'tooCommon' | 'weak';

export interface PasswordCheck {
  ok: boolean;
  /** Present when `ok` is false. */
  code?: PasswordRejection;
  /**
   * English prose for this rejection. Kept for logs, CLI paths and the MCP
   * surface, which have no translation layer; the HTTP API sends `code` and lets
   * the client translate.
   */
  reason?: string;
}

export function validatePassword(password: string): PasswordCheck {
  if (password.length < 8) {
    return { ok: false, code: 'tooShort', reason: 'Password must be at least 8 characters' };
  }

  if (/^(.)\1+$/.test(password)) {
    return { ok: false, code: 'tooRepetitive', reason: 'Password is too repetitive' };
  }

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return {
      ok: false,
      code: 'tooCommon',
      reason: 'Password is too common. Please choose a unique password.',
    };
  }

  const requirementsMessage =
    'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character';
  if (!/[A-Z]/.test(password)) return { ok: false, code: 'weak', reason: requirementsMessage };
  if (!/[a-z]/.test(password)) return { ok: false, code: 'weak', reason: requirementsMessage };
  if (!/[0-9]/.test(password)) return { ok: false, code: 'weak', reason: requirementsMessage };
  if (!/[^A-Za-z0-9]/.test(password)) return { ok: false, code: 'weak', reason: requirementsMessage };

  return { ok: true };
}
