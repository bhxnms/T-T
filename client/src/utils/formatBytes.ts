const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const

/** B→TB, one decimal above bytes. (FileManager's MB-capped formatSize predates this; not consolidated here.) */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${Math.round(bytes)} B`
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(1)} ${UNITS[unit]}`
}
