import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'

// Simple test to verify mock setup works at all

describe('MapViewAMap Mock Verification', () => {
  it('verifies that loadAmap mock is called', async () => {
    // Mock BEFORE importing component
    const loadAmapMock = vi.fn(async () => {
      console.log('[SIMPLE] loadAmap called!')
      await new Promise(resolve => setTimeout(resolve, 100))

      const map = {
        destroy: vi.fn(),
        setZoomAndCenter: vi.fn(),
        setFitView: vi.fn(),
        getZoom: vi.fn(() => 10),
        on: vi.fn(),
        off: vi.fn(),
      }

      return {
        Map: vi.fn(() => {
          console.log('[SIMPLE] AMap.Map constructor called!')
          return map
        }),
        Marker: vi.fn(() => ({
          setMap: vi.fn(),
          on: vi.fn(),
        })),
        InfoWindow: vi.fn(() => ({
          open: vi.fn(),
          close: vi.fn(),
          setContent: vi.fn(),
        })),
      }
    })

    vi.doMock('./engines/amap', () => ({
      loadAmap: loadAmapMock,
      wgs84ToGcj02: vi.fn((lng: number, lat: number) => ({ lng: lng + 0.006, lat: lat + 0.006 })),
      gcj02ToWgs84: vi.fn((lng: number, lat: number) => ({ lng: lng - 0.006, lat: lat - 0.006 })),
    }))

    vi.doMock('../../store/settingsStore', () => ({
      useSettingsStore: vi.fn(() => ({
        language: 'en',
        temperature_unit: 'celsius',
        distance_unit: 'metric',
      })),
    }))

    vi.doMock('./MapView', () => ({
      MapView: vi.fn(() => null),
    }))

    vi.doMock('../../api/client', () => ({
      pluginsApi: {
        mapMarkers: vi.fn(() => Promise.resolve({ markers: [] })),
        mapLayers: vi.fn(() => Promise.resolve({ layers: [] })),
      },
      mapsApi: {},
    }))

    vi.doMock('./amapOverlays', () => ({
      ReservationAMapOverlay: vi.fn().mockImplementation(() => ({
        update: vi.fn(),
        destroy: vi.fn(),
      })),
      attachLocationAMapOverlay: vi.fn(() => ({
        update: vi.fn(),
        destroy: vi.fn(),
      })),
    }))

    // NOW import component
    const { MapViewAMap } = await import('./MapViewAMap')

    render(<MapViewAMap
      places={[{ id: 1, lat: 39.908, lng: 116.397, name: 'A' }]}
      zoom={10}
      center={[39.908, 116.397]}
    />)

    await waitFor(() => {
      expect(loadAmapMock).toHaveBeenCalled()
    }, { timeout: 5000 })

    console.log('[SIMPLE] loadAmap was called:', loadAmapMock.mock.calls.length, 'times')
  })
})
