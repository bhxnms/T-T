const STEPS: Array<{ limit: number; div: number; unit: Intl.RelativeTimeFormatUnit }> = [
  { limit: 60_000, div: 1_000, unit: 'second' },
  { limit: 3_600_000, div: 60_000, unit: 'minute' },
  { limit: 86_400_000, div: 3_600_000, unit: 'hour' },
  { limit: Number.POSITIVE_INFINITY, div: 86_400_000, unit: 'day' },
]

/** "2 minutes ago" from an epoch-ms timestamp, localized. Future stamps clamp to "now". */
export function relativeTime(at: number, locale: string, now: number = Date.now()): string {
  const elapsed = now - at
  if (elapsed < 1_000) return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(0, 'second')
  const step = STEPS.find((s) => elapsed < s.limit)!
  const value = Math.round(elapsed / step.div)
  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-value, step.unit)
}
