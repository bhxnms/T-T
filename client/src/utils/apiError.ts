/**
 * Pulls the server-provided error string out of an axios-style error so the UI can
 * surface the real reason (e.g. a Google Places API message such as "Places API (New)
 * has not been used in project … or it is disabled") instead of a generic fallback.
 *
 * `codeMessages` maps a stable server error `code` to a translated string. It is
 * how a password-policy rejection reaches a non-English user in their own
 * language: the server sends `{ error: <English prose>, code: 'weak' }`, and the
 * English text is only the fallback for callers with no translation layer.
 */
export function getApiErrorMessage(
  err: unknown,
  fallback: string,
  codeMessages?: Record<string, string>,
): string {
  const code = apiErrorCode(err)
  if (code && codeMessages?.[code]) return codeMessages[code]
  const message = (err as { response?: { data?: { error?: unknown } } })?.response?.data?.error
  return typeof message === 'string' && message.trim() ? message : fallback
}

/**
 * The server's stable error `code`, from the raw axios error or from a plain
 * `Error` that a store re-threw while carrying it. Reading both means a code
 * survives the layer that turns an axios failure into an `Error` — without it
 * the register path lost the code on the way to the login form, and a weak
 * password came back as the server's English sentence.
 */
export function apiErrorCode(err: unknown): string | null {
  const fromResponse = (err as { response?: { data?: { code?: unknown } } })?.response?.data?.code
  if (typeof fromResponse === 'string' && fromResponse) return fromResponse
  const carried = (err as { code?: unknown })?.code
  return typeof carried === 'string' && carried ? carried : null
}

/**
 * The server's password-policy rejection codes, mapped to the i18n keys that
 * say the same thing in the reader's language. The server sends an English
 * sentence alongside the code, so a caller that forgets this map shows English
 * prose on an otherwise translated form — the bug this exists to close.
 *
 * One definition, so a new rejection code is added once rather than at every
 * password field in the app.
 */
const PASSWORD_POLICY_KEYS: Record<string, string> = {
  tooShort: 'settings.passwordTooShort',
  tooRepetitive: 'settings.passwordWeak',
  tooCommon: 'settings.passwordWeak',
  weak: 'settings.passwordWeak',
}

/** Build the `codeMessages` argument for `getApiErrorMessage` from a `t`. */
export function passwordPolicyMessages(t: (key: string) => string): Record<string, string> {
  const messages: Record<string, string> = {}
  for (const [code, key] of Object.entries(PASSWORD_POLICY_KEYS)) messages[code] = t(key)
  return messages
}
