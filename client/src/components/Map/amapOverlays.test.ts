import { describe, expect, it, vi } from 'vitest'
import { LocationAMapOverlay, ReservationAMapOverlay } from './amapOverlays'
import type { AMapOverlayApi, AMapOverlayMap } from './amapOverlays'
import type { GeoPosition } from '../../hooks/useGeolocation'
import type { Reservation } from '../../types'

type MockOverlay = {
  options: Record<string, unknown>
  setMap: ReturnType<typeof vi.fn>
  setPosition: ReturnType<typeof vi.fn>
  setPath: ReturnType<typeof vi.fn>
  setCenter: ReturnType<typeof vi.fn>
  setRadius: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
  getElement?: ReturnType<typeof vi.fn>
}

function overlay(options: Record<string, unknown> = {}): MockOverlay {
  return {
    options,
    setMap: vi.fn(), setPosition: vi.fn(), setPath: vi.fn(), setCenter: vi.fn(),
    setRadius: vi.fn(), on: vi.fn(),
  }
}

function amapMocks() {
  const markers: MockOverlay[] = []
  const lines: MockOverlay[] = []
  const circles: MockOverlay[] = []
  const AMap: AMapOverlayApi = {
    Marker: class { constructor(options?: Record<string, unknown>) { const item = overlay(options); markers.push(item); return item as unknown as this } } as never,
    Polyline: class { constructor(options?: Record<string, unknown>) { const item = overlay(options); lines.push(item); return item as unknown as this } } as never,
    Circle: class { constructor(options?: Record<string, unknown>) { const item = overlay(options); circles.push(item); return item as unknown as this } } as never,
  }
  return { AMap, markers, lines, circles }
}

const map: AMapOverlayMap = { setCenter: vi.fn() }
const endpoint = (role: 'from' | 'to' | 'stop', sequence: number, name: string, lat: number, lng: number) => ({ role, sequence, name, code: null, lat, lng, timezone: null, local_time: null, local_date: null })
const reservation = (endpoints: ReturnType<typeof endpoint>[], type = 'flight'): Reservation => ({ id: 7, trip_id: 1, title: 'Trip', status: 'confirmed', type, endpoints })

function position(overrides: Partial<GeoPosition> = {}): GeoPosition {
  return { lat: 39.908, lng: 116.397, accuracy: 20, heading: 90, speed: null, timestamp: 1, ...overrides }
}

describe('ReservationAMapOverlay', () => {
  it('creates a line and endpoint markers for multiple ordered waypoints', () => {
    const mocks = amapMocks()
    const manager = new ReservationAMapOverlay(map, mocks.AMap, { showEndpointLabels: true })
    manager.update([reservation([
      endpoint('to', 2, 'C', 40, 118), endpoint('from', 0, 'A', 39, 116), endpoint('stop', 1, 'B', 39.5, 117),
    ])])

    expect(mocks.lines).toHaveLength(2)
    expect(mocks.markers).toHaveLength(3)
    expect(mocks.lines.every(line => line.setMap.mock.calls[0][0] === map)).toBe(true)
    expect(mocks.markers[0].options.content).toBeInstanceOf(HTMLElement)
  })

  it('clears old overlays on update and destroy, and honors hidden connections', () => {
    const mocks = amapMocks()
    const manager = new ReservationAMapOverlay(map, mocks.AMap)
    manager.update([reservation([endpoint('from', 0, 'A', 39, 116), endpoint('to', 1, 'B', 40, 118)])])
    manager.update([reservation([endpoint('from', 0, 'A', 39, 116), endpoint('to', 1, 'B', 40, 118)])], { showConnections: false })
    expect(mocks.lines[0].setMap).toHaveBeenLastCalledWith(null)
    expect(mocks.markers[0].setMap).toHaveBeenLastCalledWith(null)
    manager.destroy()
  })
})

describe('LocationAMapOverlay', () => {
  it('mounts, updates position/accuracy, follows, removes, and destroys', () => {
    const mocks = amapMocks()
    const onFollowCenter = vi.fn()
    const manager = new LocationAMapOverlay(map, mocks.AMap)
    manager.update(position(), { follow: true, onFollowCenter })

    expect(mocks.markers).toHaveLength(1)
    expect(mocks.markers[0].setPosition).toHaveBeenCalled()
    expect(mocks.markers[0].setMap).toHaveBeenLastCalledWith(map)
    expect(mocks.circles).toHaveLength(1)
    expect(onFollowCenter).toHaveBeenCalledWith(expect.objectContaining({ lat: 39.908 }))

    manager.update(null)
    expect(mocks.markers[0].setMap).toHaveBeenLastCalledWith(null)
    expect(mocks.circles[0].setMap).toHaveBeenLastCalledWith(null)
    manager.destroy()
    expect(mocks.markers[0].setMap).toHaveBeenLastCalledWith(null)
  })

  it('hides the accuracy circle when accuracy is below one meter', () => {
    const mocks = amapMocks()
    const manager = new LocationAMapOverlay(map, mocks.AMap)
    manager.update(position({ accuracy: 0.5 }), { follow: true })
    expect(mocks.circles).toHaveLength(0)
    expect(map.setCenter).toHaveBeenCalled()
  })
})
