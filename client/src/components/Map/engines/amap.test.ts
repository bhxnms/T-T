import { afterEach, describe, expect, it, vi } from 'vitest'
import { gcj02ToWgs84, loadAmap, wgs84ToGcj02 } from './amap'

describe('AMap coordinate conversion', () => {
  it('converts WGS84 to GCJ-02 inside China and approximately back', () => {
    const converted = wgs84ToGcj02(116.397, 39.908)
    expect(converted.lng).not.toBeCloseTo(116.397, 5)
    expect(converted.lat).not.toBeCloseTo(39.908, 5)

    const restored = gcj02ToWgs84(converted.lng, converted.lat)
    expect(restored.lng).toBeCloseTo(116.397, 5)
    expect(restored.lat).toBeCloseTo(39.908, 5)
  })

  it('leaves coordinates outside mainland China unchanged', () => {
    expect(wgs84ToGcj02(-73.9857, 40.7484)).toEqual({ lng: -73.9857, lat: 40.7484 })
    expect(gcj02ToWgs84(2.3522, 48.8566)).toEqual({ lng: 2.3522, lat: 48.8566 })
  })
})

describe('loadAmap', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    delete (window as Window & { AMap?: unknown }).AMap
    document.querySelector('script[data-trek-amap]')?.remove()
  })

  it('returns an already available AMap without adding a script', async () => {
    const api = { Map: class {}, Marker: class {}, Polyline: class {}, InfoWindow: class {}, LngLat: class {} }
    ;(window as Window & { AMap?: unknown }).AMap = api
    const append = vi.spyOn(document.head, 'appendChild')

    await expect(loadAmap()).resolves.toBe(api)
    expect(append).not.toHaveBeenCalled()
  })

  it('loads an existing marked script and resolves after it exposes AMap', async () => {
    const script = document.createElement('script')
    script.dataset.trekAmap = 'true'
    document.head.appendChild(script)
    const promise = loadAmap()
    const api = { Map: class {}, Marker: class {}, Polyline: class {}, InfoWindow: class {}, LngLat: class {} }
    ;(window as Window & { AMap?: unknown }).AMap = api
    script.onload?.(new Event('load'))

    await expect(promise).resolves.toBe(api)
    expect(document.querySelectorAll('script[data-trek-amap]')).toHaveLength(1)
  })
})
