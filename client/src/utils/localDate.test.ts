import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { localIsoDate } from './localDate'

/**
 * "Today" must be the user's local calendar date. `toISOString()` is the UTC
 * date — between local midnight and the UTC rollover it is YESTERDAY for any
 * TZ ahead of UTC, which misclassified trips/journeys in that window. On a UTC
 * machine local == UTC, so the distinction is vacuous there; these tests pin
 * the clock at 00:30 local, where any positive offset separates the two.
 */
describe('localIsoDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 25, 0, 30)) // local 2026-08-25 00:30
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('formats the local calendar date, zero-padded', () => {
    expect(localIsoDate()).toBe('2026-08-25')
    expect(localIsoDate(new Date(2026, 0, 3, 12))).toBe('2026-01-03')
  })

  it('defaults to now', () => {
    expect(localIsoDate()).toBe(localIsoDate(new Date()))
  })
})
