import { describe, expect, it } from 'vitest'
import { formatBytes } from './formatBytes'

describe('formatBytes', () => {
  it('FE-UTIL-BYTES-001: scales B→TB with one decimal above bytes', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(3_174)).toBe('3.1 KB')
    expect(formatBytes(2 * 1024 * 1024)).toBe('2.0 MB')
    expect(formatBytes(1.5 * 1024 ** 3)).toBe('1.5 GB')
    expect(formatBytes(1.2 * 1024 ** 4)).toBe('1.2 TB')
  })
})
