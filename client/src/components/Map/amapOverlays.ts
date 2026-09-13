import type { Reservation, ReservationEndpoint } from '../../types'
import type { GeoPosition } from '../../hooks/useGeolocation'
import { geodesicArcs } from './flightGeodesy'
import { getTransitMapSegments } from './transitGeometry'
import { cleanEndpointName } from './reservationName'
import { wgs84ToGcj02 } from './engines/amap'

/** Minimal AMap surface used by these managers; keeps the module independently testable. */
export interface AMapOverlayApi {
  Marker: new (options?: Record<string, unknown>) => AMapOverlay
  Polyline: new (options?: Record<string, unknown>) => AMapOverlay
  Circle?: new (options?: Record<string, unknown>) => AMapOverlay
}
export interface AMapOverlayMap {
  setCenter?: (center: [number, number]) => void
}
export interface AMapOverlay {
  setMap: (map: AMapOverlayMap | null) => void
  setPosition?: (position: [number, number]) => void
  setPath?: (path: [number, number][]) => void
  setCenter?: (center: [number, number]) => void
  setRadius?: (radius: number) => void
  setAngle?: (angle: number) => void
  setContent?: (content: string | HTMLElement) => void
  on?: (event: string, handler: (event: any) => void) => void
  getElement?: () => HTMLElement
}

type LngLat = [number, number]
const transportTypes = new Set(['flight', 'train', 'cruise', 'car', 'bus', 'taxi', 'bicycle', 'ferry', 'transit', 'transport_other'])
const geodesicTypes = new Set(['flight', 'cruise', 'ferry'])
const blue = '#3b82f6'

function amapPoint(lng: number, lat: number): LngLat {
  const p = wgs84ToGcj02(lng, lat)
  return [p.lng, p.lat]
}

function endpointList(r: Reservation): ReservationEndpoint[] {
  return (r.endpoints || []).filter(e => e.role === 'from' || e.role === 'to' || e.role === 'stop').slice().sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
}

function markerContent(type: string, label: string): HTMLElement {
  const el = document.createElement('div')
  el.style.cssText = 'display:inline-flex;align-items:center;gap:4px;height:22px;padding:0 8px;border-radius:999px;background:#3b82f6;border:1.5px solid #fff;color:#fff;box-shadow:0 2px 6px rgba(0,0,0,.25);font:600 11px/1 var(--font-system,sans-serif);white-space:nowrap;cursor:pointer;'
  el.textContent = label || type
  return el
}

export interface ReservationAMapOverlayOptions {
  showConnections?: boolean
  showEndpointLabels?: boolean
  onEndpointClick?: (reservationId: number) => void
}

/** Imperative reservation route/endpoint overlay for an AMap instance. */
export class ReservationAMapOverlay {
  private readonly map: AMapOverlayMap
  private readonly AMap: AMapOverlayApi
  private overlays: AMapOverlay[] = []
  private options: ReservationAMapOverlayOptions = {}

  constructor(map: AMapOverlayMap, AMap: AMapOverlayApi, options: ReservationAMapOverlayOptions = {}) {
    this.map = map
    this.AMap = AMap
    this.options = options
  }

  update(reservations: Reservation[], options: ReservationAMapOverlayOptions = this.options, roadRoutes?: Map<number, [number, number][]>) {
    this.options = options
    this.clear()
    if (options.showConnections === false) return
    for (const reservation of reservations) {
      if (!transportTypes.has(reservation.type)) continue
      const waypoints = endpointList(reservation)
      if (waypoints.length < 2) continue
      const transit = reservation.type === 'transit' ? getTransitMapSegments(reservation) : []
      if (transit.length) {
        for (const segment of transit) this.addLine(segment.coords.map(([lat, lng]) => amapPoint(lng, lat)), segment.walk ? '#64748b' : (segment.color || '#7c3aed'), segment.walk ? '1,7' : undefined, 3.5)
      } else {
        const road = roadRoutes?.get(reservation.id)
        const paths = road && road.length >= 2
          ? [road.map(([lat, lng]) => amapPoint(lng, lat))]
          : waypoints.slice(0, -1).flatMap((from, i) => geodesicTypes.has(reservation.type)
            ? geodesicArcs([from.lat, from.lng], [waypoints[i + 1].lat, waypoints[i + 1].lng], false).map(path => path.map(([lat, lng]) => amapPoint(lng, lat)))
            : [[amapPoint(from.lng, from.lat), amapPoint(waypoints[i + 1].lng, waypoints[i + 1].lat)]])
        for (const path of paths) this.addLine(path, blue, reservation.status === 'confirmed' ? undefined : '6,6', 2.5)
      }
      for (const point of waypoints) {
        const label = options.showEndpointLabels ? (point.code || cleanEndpointName(point.name)) : ''
        const marker = new this.AMap.Marker({ position: amapPoint(point.lng, point.lat), content: markerContent(reservation.type, label) })
        marker.setMap(this.map)
        marker.on?.('click', () => options.onEndpointClick?.(reservation.id))
        this.overlays.push(marker)
      }
    }
  }

  destroy() { this.clear() }

  private addLine(path: LngLat[], color: string, dash?: string, weight = 3) {
    const line = new this.AMap.Polyline({ path, strokeColor: color, strokeWeight: weight, strokeOpacity: 0.85, lineJoin: 'round', lineCap: 'round', ...(dash ? { strokeStyle: 'dashed', strokeDasharray: dash } : {}) })
    line.setMap(this.map)
    this.overlays.push(line)
  }

  private clear() { for (const overlay of this.overlays) overlay.setMap(null); this.overlays = [] }
}

export interface LocationAMapOverlayOptions {
  follow?: boolean
  onFollowCenter?: (position: GeoPosition) => void
}

export interface LocationAMapOverlayHandle {
  update: (position: GeoPosition | null, options?: LocationAMapOverlayOptions) => void
  destroy: () => void
}

/** Blue location dot, accuracy circle, heading cone, and optional follow behavior. */
export class LocationAMapOverlay implements LocationAMapOverlayHandle {
  private readonly map: AMapOverlayMap
  private readonly AMap: AMapOverlayApi
  private readonly marker: AMapOverlay
  private circle: AMapOverlay | null = null
  private last: GeoPosition | null = null

  constructor(map: AMapOverlayMap, AMap: AMapOverlayApi) {
    this.map = map
    this.AMap = AMap
    const content = document.createElement('div')
    content.style.cssText = 'width:28px;height:28px;border-radius:50%;background:rgba(59,130,246,.22);position:relative;'
    content.innerHTML = '<span style="position:absolute;left:50%;top:50%;width:16px;height:16px;transform:translate(-50%,-50%);border-radius:50%;background:#3b82f6;border:3px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.15),0 2px 6px rgba(0,0,0,.3)"></span><span data-heading style="display:none;position:absolute;left:50%;top:-8px;width:3px;height:22px;transform-origin:50% 22px;background:#2563eb;border-radius:3px"></span>'
    this.marker = new AMap.Marker({ content, anchor: 'center' })
  }

  update(position: GeoPosition | null, options: LocationAMapOverlayOptions = {}) {
    this.last = position
    if (!position) { this.marker.setMap(null); this.circle?.setMap(null); return }
    const center = amapPoint(position.lng, position.lat)
    this.marker.setPosition?.(center)
    this.marker.setMap(this.map)
    const heading = this.marker.getElement?.()?.querySelector('[data-heading]') as HTMLElement | null
    if (heading) { heading.style.display = position.heading == null ? 'none' : 'block'; if (position.heading != null) heading.style.transform = `translateX(-50%) rotate(${position.heading}deg)` }
    if (this.AMap.Circle && position.accuracy >= 1) {
      if (!this.circle) this.circle = new this.AMap.Circle({ fillColor: blue, fillOpacity: 0.14, strokeColor: blue, strokeOpacity: 0.35, strokeWeight: 1 })
      this.circle.setCenter?.(center); this.circle.setRadius?.(position.accuracy); this.circle.setMap(this.map)
    } else this.circle?.setMap(null)
    if (options.follow) {
      if (options.onFollowCenter) options.onFollowCenter(position)
      else this.map.setCenter?.(center)
    }
  }

  destroy() { this.marker.setMap(null); this.circle?.setMap(null); this.circle = null; this.last = null }
}

export function attachLocationAMapOverlay(map: AMapOverlayMap, AMap: AMapOverlayApi): LocationAMapOverlayHandle {
  return new LocationAMapOverlay(map, AMap)
}
