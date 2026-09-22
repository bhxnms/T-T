// FE-W4UTL-001 to FE-W4UTL-006, plus FE-W4UTL-007..011 for the policy codes.
import { describe, it, expect } from 'vitest'
import { getApiErrorMessage, apiErrorCode, passwordPolicyMessages } from './apiError'

describe('getApiErrorMessage', () => {
  it('FE-W4UTL-001: returns the server-provided error string', () => {
    const err = { response: { data: { error: 'Places API (New) has not been used in project 42' } } }
    expect(getApiErrorMessage(err, 'fallback')).toBe('Places API (New) has not been used in project 42')
  })

  it('FE-W4UTL-002: falls back when the error field is missing', () => {
    expect(getApiErrorMessage({ response: { data: {} } }, 'fallback')).toBe('fallback')
    expect(getApiErrorMessage({ response: {} }, 'fallback')).toBe('fallback')
    expect(getApiErrorMessage({}, 'fallback')).toBe('fallback')
  })

  it('FE-W4UTL-003: falls back for null/undefined errors', () => {
    expect(getApiErrorMessage(null, 'fallback')).toBe('fallback')
    expect(getApiErrorMessage(undefined, 'fallback')).toBe('fallback')
  })

  it('FE-W4UTL-004: falls back for a whitespace-only server message', () => {
    expect(getApiErrorMessage({ response: { data: { error: '   ' } } }, 'fallback')).toBe('fallback')
    expect(getApiErrorMessage({ response: { data: { error: '' } } }, 'fallback')).toBe('fallback')
  })

  it('FE-W4UTL-005: falls back for a non-string server message', () => {
    expect(getApiErrorMessage({ response: { data: { error: { code: 500 } } } }, 'fallback')).toBe('fallback')
    expect(getApiErrorMessage({ response: { data: { error: 42 } } }, 'fallback')).toBe('fallback')
  })

  it('FE-W4UTL-006: keeps surrounding whitespace of a real message', () => {
    expect(getApiErrorMessage({ response: { data: { error: ' boom ' } } }, 'fallback')).toBe(' boom ')
  })

  it('FE-W4UTL-007: a known policy code beats the server’s English prose', () => {
    const err = { response: { data: { error: 'Password is too common.', code: 'tooCommon' } } }
    expect(getApiErrorMessage(err, 'fallback', { tooCommon: '密码太常见' })).toBe('密码太常见')
  })

  it('FE-W4UTL-008: an unmapped code still falls back to the server message', () => {
    const err = { response: { data: { error: 'Server said so', code: 'something_new' } } }
    expect(getApiErrorMessage(err, 'fallback', { weak: 'x' })).toBe('Server said so')
  })

  it('FE-W4UTL-009: no code list behaves exactly as before', () => {
    const err = { response: { data: { error: 'Server said so', code: 'weak' } } }
    expect(getApiErrorMessage(err, 'fallback')).toBe('Server said so')
  })

  it('FE-W4UTL-010: apiErrorCode reads the code off a re-thrown Error too', () => {
    // The store turns an axios failure into an Error; the code has to survive
    // that, or the register form loses the translation.
    expect(apiErrorCode({ response: { data: { code: 'weak' } } })).toBe('weak')
    expect(apiErrorCode(Object.assign(new Error('nope'), { code: 'tooShort' }))).toBe('tooShort')
    expect(apiErrorCode(new Error('nope'))).toBeNull()
    expect(apiErrorCode(null)).toBeNull()
  })

  it('FE-W4UTL-011: passwordPolicyMessages builds one entry per rejection code', () => {
    const messages = passwordPolicyMessages((k) => `t:${k}`)
    expect(messages).toEqual({
      tooShort: 't:settings.passwordTooShort',
      tooRepetitive: 't:settings.passwordWeak',
      tooCommon: 't:settings.passwordWeak',
      weak: 't:settings.passwordWeak',
    })
  })
})
