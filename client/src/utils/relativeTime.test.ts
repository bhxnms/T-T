import { describe, expect, it } from 'vitest';
import { relativeTime } from './relativeTime';

describe('relativeTime', () => {
  const now = 1_700_000_000_000;

  it('FE-UTIL-RELTIME-001: formats seconds, minutes, hours and days', () => {
    expect(relativeTime(now - 30_000, 'en', now)).toBe('30 seconds ago');
    expect(relativeTime(now - 120_000, 'en', now)).toBe('2 minutes ago');
    expect(relativeTime(now - 2 * 3_600_000, 'en', now)).toBe('2 hours ago');
    expect(relativeTime(now - 3 * 86_400_000, 'en', now)).toBe('3 days ago');
  });

  it('FE-UTIL-RELTIME-002: clamps future timestamps to "now"', () => {
    expect(relativeTime(now + 5_000, 'en', now)).toBe('now');
  });

  it('FE-UTIL-RELTIME-003: localizes via Intl (de)', () => {
    expect(relativeTime(now - 120_000, 'de', now)).toBe('vor 2 Minuten');
  });
});
