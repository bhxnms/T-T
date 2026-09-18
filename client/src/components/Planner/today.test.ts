import { describe, it, expect } from 'vitest'
import { findEntryDayId, findFocusDayId, findTodayDayId, localToday } from './today'

describe('localToday', () => {
  it('FE-TODAY-001: reads the date off the local clock, not UTC', () => {
    // 08:00 in Tokyo on the 12th is still the 11th in UTC. Using toISOString()
    // here would tell a traveller in Japan that today is yesterday, every
    // morning, which is exactly who "jump to today" is for.
    const tokyoMorning = new Date(2026, 7, 12, 8, 0, 0)
    expect(localToday(tokyoMorning)).toBe('2026-08-12')

    // And the other end: late evening must not roll over into tomorrow.
    expect(localToday(new Date(2026, 7, 12, 23, 30, 0))).toBe('2026-08-12')
  })

  it('FE-TODAY-002: pads month and day to two digits', () => {
    expect(localToday(new Date(2026, 0, 5, 12, 0, 0))).toBe('2026-01-05')
  })
})

describe('findTodayDayId', () => {
  const days = [
    { id: 1, date: '2026-08-10' },
    { id: 2, date: '2026-08-11' },
    { id: 3, date: '2026-08-12' },
  ]
  const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 10, 0, 0)

  it('FE-TODAY-003: finds the day that is today', () => {
    expect(findTodayDayId(days, at(2026, 8, 11))).toBe(2)
  })

  it('FE-TODAY-004: is null when the trip is not running', () => {
    expect(findTodayDayId(days, at(2026, 8, 9))).toBeNull()
    expect(findTodayDayId(days, at(2026, 8, 13))).toBeNull()
    expect(findTodayDayId([], at(2026, 8, 11))).toBeNull()
  })

  it('FE-TODAY-005: a trip planned without dates has no today to jump to', () => {
    expect(findTodayDayId([{ id: 1, date: null }, { id: 2 }], at(2026, 8, 11))).toBeNull()
  })

  it('FE-TODAY-006: tolerates a full timestamp in the date column', () => {
    expect(findTodayDayId([{ id: 7, date: '2026-08-11T00:00:00.000Z' }], at(2026, 8, 11))).toBe(7)
  })
})

describe('findFocusDayId', () => {
  const days = [
    { id: 1, date: '2026-08-10' },
    { id: 2, date: '2026-08-12' },
    { id: 3, date: '2026-08-14' },
  ]
  const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 10, 0, 0)

  it('FE-TODAY-007: is today while the trip is running', () => {
    expect(findFocusDayId(days, at(2026, 8, 12))).toBe(2)
  })

  it('FE-TODAY-008: skips to the next dated day across a gap and before the trip', () => {
    expect(findFocusDayId(days, at(2026, 8, 11))).toBe(2)
    expect(findFocusDayId(days, at(2026, 8, 9))).toBe(1)
  })

  it('FE-TODAY-009: is null once the trip is over, leaving the caller its own fallback', () => {
    expect(findFocusDayId(days, at(2026, 8, 15))).toBeNull()
  })

  it('FE-TODAY-010: has nothing to focus without dates', () => {
    expect(findFocusDayId([{ id: 1, date: null }, { id: 2 }], at(2026, 8, 11))).toBeNull()
    expect(findFocusDayId([], at(2026, 8, 11))).toBeNull()
  })

  it('FE-TODAY-011: tolerates full timestamps and leaves the caller’s array alone', () => {
    const unordered = [
      { id: 2, date: '2026-08-12T00:00:00.000Z' },
      { id: 1, date: '2026-08-10T00:00:00.000Z' },
    ]
    expect(findFocusDayId(unordered, at(2026, 8, 11))).toBe(2)
    expect(unordered.map(d => d.id)).toEqual([2, 1])
  })
})

describe('findEntryDayId', () => {
  const days = [
    { id: 1, day_number: 1, date: '2026-08-10' },
    { id: 2, day_number: 2, date: '2026-08-11' },
    { id: 3, day_number: 3, date: '2026-08-12' },
  ]
  const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 10, 0, 0)
  const noContent = { assignments: {}, dayNotes: {}, reservations: [] }

  it('FE-TODAY-012: picks today when today has content', () => {
    const content = { ...noContent, assignments: { '2': [{ id: 1 }] } }
    expect(findEntryDayId(days, content, at(2026, 8, 11))).toBe(2)
  })

  it('FE-TODAY-013: skips an empty today to the next day with content, not to day one', () => {
    const content = { ...noContent, assignments: { '3': [{ id: 1 }] } }
    expect(findEntryDayId(days, content, at(2026, 8, 11))).toBe(3)
  })

  it('FE-TODAY-014: falls back to the next dated day ahead when no day has content', () => {
    expect(findEntryDayId(days, noContent, at(2026, 8, 9))).toBe(1)
  })

  it('FE-TODAY-015: a day with only a note or a reservation counts as content', () => {
    const withNote = { ...noContent, dayNotes: { '3': [{ id: 1 }] } }
    expect(findEntryDayId(days, withNote, at(2026, 8, 11))).toBe(3)

    const withReservation = { ...noContent, reservations: [{ type: 'flight', day_id: 1 }] }
    expect(findEntryDayId(days, withReservation, at(2026, 8, 11))).toBe(1)
  })

  it('FE-TODAY-016: hotels never count as day content', () => {
    // A hotel-only day is empty to the traveller, so it must not be picked as
    // "the day with content". With nothing else planned the pick falls through
    // to the dated-day fallback, which is null once the whole trip is over.
    const content = { ...noContent, reservations: [{ type: 'hotel', day_id: 2 }] }
    expect(findEntryDayId(days, content, at(2026, 8, 15))).toBeNull()
  })

  it('FE-TODAY-017: nothing to pick without days', () => {
    expect(findEntryDayId([], noContent, at(2026, 8, 11))).toBeNull()
  })
})
