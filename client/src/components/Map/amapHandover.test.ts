import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NamedWaypoint } from './RouteCalculator'
import { amapAppScheme, generateAmapAppUrl, openAmapMaps } from './amapHandover'

const stops: NamedWaypoint[] = [
  { lat: 39.997361, lng: 116.478346, name: 'Hotel, Beijing' },
  { lat: 39.96, lng: 116.4, name: 'Louvre' },
  { lat: 39.94, lng: 116.38, name: 'Orsay' },
  { lat: 39.95, lng: 116.35, name: 'Hotel, Beijing' },
]

const setUa = (userAgent: string) => {
  Object.defineProperty(navigator, 'userAgent', { configurable: true, value: userAgent })
}

describe('AMap native app handover', () => {
  afterEach(() => vi.restoreAllMocks())

  it('selects Android, iOS, iPadOS, but never a desktop', () => {
    setUa('Mozilla/5.0 (Linux; Android 13; Pixel 7)')
    expect(amapAppScheme()).toBe('amapuri')
    setUa('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')
    expect(amapAppScheme()).toBe('iosamap')
    setUa('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)')
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 })
    expect(amapAppScheme()).toBe('iosamap')
    setUa('Mozilla/5.0 (X11; Linux x86_64)')
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 })
    expect(amapAppScheme()).toBeNull()
  })

  it('builds Android route params for every via point in order', () => {
    setUa('Mozilla/5.0 (Linux; Android 13; Pixel 7)')
    const url = generateAmapAppUrl(stops)!
    expect(url).toMatch(/^amapuri:\/\/route\/plan\/\?/)
    expect(url).toContain('dev=0')
    expect(url).toContain('m=0')
    expect(url).toContain('vian=2')
    expect(decodeURIComponent(url)).toContain('Hotel, Beijing')
    expect(decodeURIComponent(url)).toContain('Louvre|Orsay')
  })

  it('builds the iOS path and the same lossless via arrays', () => {
    setUa('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')
    const url = generateAmapAppUrl(stops)!
    expect(url).toMatch(/^iosamap:\/\/path\?/)
    expect(url).toContain('vian=2')
    expect(url).toContain('m=0')
    expect(decodeURIComponent(url)).toContain('Louvre|Orsay')
  })

  it('does not create an app URL for a desktop or a one-stop day', () => {
    setUa('Mozilla/5.0 (X11; Linux x86_64)')
    expect(generateAmapAppUrl(stops)).toBeNull()
    setUa('Mozilla/5.0 (Linux; Android 13; Pixel 7)')
    expect(generateAmapAppUrl([stops[0]])).toBeNull()
  })

  it('falls back to the web URL when the app scheme does not hide the page', () => {
    setUa('Mozilla/5.0 (Linux; Android 13; Pixel 7)')
    vi.useFakeTimers()
    const navigate = vi.fn()
    openAmapMaps(stops, 'https://ditu.amap.com/dir?fallback=1', { navigate })
    vi.advanceTimersByTime(1600)
    expect(navigate).toHaveBeenLastCalledWith('https://ditu.amap.com/dir?fallback=1')
    vi.useRealTimers()
  })
})
