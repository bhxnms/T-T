export interface AMapClusterPoint<T> {
  item: T
  lat: number
  lng: number
}

export interface AMapPlaceCluster<T> {
  lat: number
  lng: number
  members: T[]
}

const TILE_SIZE = 256

function project(lng: number, lat: number, zoom: number): [number, number] {
  const scale = TILE_SIZE * 2 ** zoom
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, lat))
  const sin = Math.sin(clampedLat * Math.PI / 180)
  return [
    ((lng + 180) / 360) * scale,
    (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  ]
}

/**
 * Groups WGS-84 points using a screen-space grid. AMap's public marker API
 * does not expose a stable DOM-marker clustering contract, so this keeps the
 * behaviour identical regardless of marker content.
 */
export function clusterAMapPoints<T>(points: AMapClusterPoint<T>[], zoom: number, radius = 30, maxZoom = 10): AMapPlaceCluster<T>[] {
  if (zoom > maxZoom) return points.map(({ item, lat, lng }) => ({ lat, lng, members: [item] }))

  const buckets = new Map<string, { sumLat: number; sumLng: number; members: T[] }>()
  for (const point of points) {
    const [x, y] = project(point.lng, point.lat, zoom)
    const key = `${Math.floor(x / radius)}:${Math.floor(y / radius)}`
    const bucket = buckets.get(key) || { sumLat: 0, sumLng: 0, members: [] }
    bucket.sumLat += point.lat
    bucket.sumLng += point.lng
    bucket.members.push(point.item)
    buckets.set(key, bucket)
  }

  return [...buckets.values()].map(bucket => ({
    lat: bucket.sumLat / bucket.members.length,
    lng: bucket.sumLng / bucket.members.length,
    members: bucket.members,
  }))
}
