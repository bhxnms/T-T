import { useCallback, useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import type { JourneyTrack } from '@trek/shared'
import { loadAmap, wgs84ToGcj02, type AMapInfoWindow, type AMapMap, type AMapMarker, type AMapOverlay } from '../Map/engines/amap'
import type { JourneyMapHandle, MapPhoto } from './JourneyMap'

interface MapEntry {
  id: string
  lat: number
  lng: number
  title?: string | null
  location_name?: string | null
  mood?: string | null
  entry_date: string
  dayColor?: string
  dayLabel?: number
}

interface Props {
  ref?: Ref<JourneyMapHandle>
  checkins: unknown[]
  entries: MapEntry[]
  photos?: MapPhoto[]
  onPhotoClick?: (photoIds: string[]) => void
  trail?: { lat: number; lng: number }[]
  tracks?: JourneyTrack[]
  height?: number
  dark?: boolean
  activeMarkerId?: string | null
  onMarkerClick?: (id: string, type?: string) => void
  fullScreen?: boolean
  paddingBottom?: number
}

const emptyTrail: { lat: number; lng: number }[] = []
const emptyTracks: JourneyTrack[] = []
const PHOTO_BUCKET_PX = 64
const gcj = (lat: number, lng: number): [number, number] => {
  const p = wgs84ToGcj02(lng, lat)
  return [p.lng, p.lat]
}

function photoMarkerContent(thumbUrl: string, count: number): string {
  const badge = count > 1
    ? `<span style="position:absolute;top:-6px;right:-6px;min-width:20px;height:20px;padding:0 5px;border-radius:10px;background:#fff;border:1.5px solid rgba(0,0,0,.12);box-shadow:0 1px 4px rgba(0,0,0,.22);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#111827;line-height:1;box-sizing:border-box">${count}</span>`
    : ''
  return `<div style="position:relative;width:48px;height:48px;border-radius:12px;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3);background-image:url('${encodeURI(thumbUrl)}');background-size:cover;background-position:center"></div>${badge}`
}

function markerContent(color: string, label: number, highlighted: boolean): string {
  const scale = highlighted ? 1.2 : 1
  return `<div style="width:28px;height:36px;transform:scale(${scale});transform-origin:bottom center;filter:drop-shadow(0 2px 4px rgba(0,0,0,.3));transition:transform .2s"><svg width="28" height="36" viewBox="0 0 28 36" fill="none"><path d="M14 34S26 22.36 26 13C26 6.37 20.63 1 14 1S2 6.37 2 13c0 9.36 12 21 12 21Z" fill="${color}" stroke="${highlighted ? '#fff' : 'rgba(255,255,255,.5)'}" stroke-width="1.5"/><circle cx="14" cy="13" r="8" fill="${color}"/><text x="14" y="13" text-anchor="middle" dominant-baseline="central" fill="#fff" font-size="11" font-weight="700">${label}</text></svg></div>`
}

function formatDate(value: string): string {
  if (!value) return ''
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date)
}

function JourneyMapAMap({ entries, photos, onPhotoClick, trail, tracks, height = 220, dark, activeMarkerId, onMarkerClick, paddingBottom, ref }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<AMapMap | null>(null)
  const markersRef = useRef<Map<string, AMapMarker>>(new Map())
  const overlaysRef = useRef<AMapOverlay[]>([])
  const popupRef = useRef<AMapInfoWindow | null>(null)
  const photoOverlaysRef = useRef<AMapOverlay[]>([])
  const drawPhotosRef = useRef<(() => void) | null>(null)
  const photosRef = useRef(photos || [])
  const amapRef = useRef<any>(null)
  const itemsRef = useRef(entries)
  const highlightedRef = useRef<string | null>(null)
  const onMarkerClickRef = useRef(onMarkerClick); onMarkerClickRef.current = onMarkerClick
  const onPhotoClickRef = useRef(onPhotoClick); onPhotoClickRef.current = onPhotoClick
  itemsRef.current = entries
  photosRef.current = photos || []

  const clearPhotoOverlays = useCallback(() => {
    photoOverlaysRef.current.forEach(overlay => overlay.setMap(null))
    photoOverlaysRef.current = []
  }, [])

  const drawPhotos = useCallback(() => {
    const map = mapRef.current
    const AMap = amapRef.current
    if (!map || !AMap) return
    clearPhotoOverlays()
    const currentPhotos = photosRef.current.filter(photo => Number.isFinite(photo.lat) && Number.isFinite(photo.lng))
    if (!currentPhotos.length) return
    const buckets = new Map<string, MapPhoto[]>()
    for (const photo of currentPhotos) {
      const position = gcj(photo.lat, photo.lng)
      const point = (map as any).lngLatToContainer?.(position) as { x: number; y: number } | undefined
      const x = point?.x ?? position[0]
      const y = point?.y ?? position[1]
      const key = `${Math.round(x / PHOTO_BUCKET_PX)}:${Math.round(y / PHOTO_BUCKET_PX)}`
      const bucket = buckets.get(key)
      if (bucket) bucket.push(photo)
      else buckets.set(key, [photo])
    }
    for (const members of buckets.values()) {
      const marker = new AMap.Marker({
        position: gcj(members[0].lat, members[0].lng),
        content: photoMarkerContent(members[0].thumbUrl, members.length),
        anchor: 'center',
        zIndex: -500,
      })
      marker.setMap(map)
      marker.on?.('click', () => onPhotoClickRef.current?.(members.map(photo => photo.id)))
      photoOverlaysRef.current.push(marker)
    }
  }, [clearPhotoOverlays])
  drawPhotosRef.current = drawPhotos

  const setStyle = useCallback((id: string, highlighted: boolean) => {
    const entry = itemsRef.current.find(item => item.id === id)
    const marker = markersRef.current.get(id)
    if (entry && marker?.setContent) marker.setContent(markerContent(entry.dayColor || '#52525B', entry.dayLabel ?? 1, highlighted))
    marker?.setZIndex?.(highlighted ? 1000 : 0)
  }, [])
  const popup = useCallback((id: string | null) => {
    if (id == null) { popupRef.current?.close(); return }
    const entry = itemsRef.current.find(item => item.id === id)
    const map = mapRef.current
    const AMap = amapRef.current
    if (!entry || !map || !AMap) return
    const title = entry.title || entry.location_name || 'Entry'
    const sub = [entry.title && entry.location_name, formatDate(entry.entry_date)].filter(Boolean).join(' · ')
    const html = `<div style="padding:8px 12px;min-width:130px;color:${dark ? '#fafafa' : '#18181b'};background:${dark ? '#27272a' : '#fff'};border-radius:10px"><div style="font-weight:600">${title}</div>${sub ? `<div style="margin-top:3px;font-size:11px;opacity:.65">${sub}</div>` : ''}</div>`
    const marker = markersRef.current.get(id)
    if (!marker) return
    const position = gcj(entry.lat, entry.lng)
    if (!popupRef.current) popupRef.current = new AMap.InfoWindow({ isCustom: true, offset: [0, -42], closeClick: false })
    popupRef.current.setContent(html)
    popupRef.current.open(map, position)
  }, [dark])
  const highlightMarker = useCallback((id: string | null) => {
    if (highlightedRef.current && highlightedRef.current !== id) setStyle(highlightedRef.current, false)
    highlightedRef.current = id
    if (id) { setStyle(id, true); popup(id) } else popup(null)
  }, [popup, setStyle])
  const focusMarker = useCallback((id: string) => {
    highlightMarker(id)
    const entry = itemsRef.current.find(item => item.id === id)
    const map = mapRef.current
    if (entry && map) map.setZoomAndCenter(Math.max(map.getZoom?.() || 12, 12), gcj(entry.lat, entry.lng))
  }, [highlightMarker])
  const invalidateSize = useCallback(() => { try { mapRef.current?.resize?.() } catch { /* map not ready */ } }, [])
  useImperativeHandle(ref, () => ({ highlightMarker, focusMarker, invalidateSize }), [highlightMarker, focusMarker, invalidateSize])

  useEffect(() => {
    let cancelled = false
    loadAmap().then(AMap => {
      if (cancelled || !hostRef.current) return
      amapRef.current = AMap
      const valid = entries.filter(e => Number.isFinite(e.lat) && Number.isFinite(e.lng))
      const first = valid[0]
      const map = new AMap.Map(hostRef.current, { zoom: valid.length ? 5 : 2, center: first ? gcj(first.lat, first.lng) : [0, 30], lang: 'zh_cn', resizeEnable: true })
      mapRef.current = map
      const overlays: AMapOverlay[] = []
      const boundsOverlays: AMapOverlay[] = []
      const addLine = (points: [number, number][], options: Record<string, unknown>) => { if (points.length > 1) { const line = new AMap.Polyline({ path: points, ...options }); line.setMap(map); overlays.push(line); boundsOverlays.push(line) } }
      addLine((trail || emptyTrail).map(p => gcj(p.lat, p.lng)), { strokeColor: '#6366f1', strokeWeight: 3, strokeOpacity: .4, strokeStyle: 'dashed' })
      for (const track of tracks || emptyTracks) addLine(track.points.map(([lat, lng]) => gcj(lat, lng)), { strokeColor: track.color || '#4f46e5', strokeWeight: 3.5, strokeOpacity: .95 })
      valid.forEach((entry, index) => {
        const marker = new AMap.Marker({ position: gcj(entry.lat, entry.lng), content: markerContent(entry.dayColor || '#52525B', entry.dayLabel ?? index + 1, false), anchor: 'bottom', title: entry.title || '' })
        marker.setMap(map); marker.on?.('click', () => onMarkerClickRef.current?.(entry.id)); markersRef.current.set(entry.id, marker); overlays.push(marker); boundsOverlays.push(marker)
      })
      overlaysRef.current = overlays
      if (boundsOverlays.length) map.setFitView(boundsOverlays, true, [50, 50, paddingBottom || 50, 50])
      map.on('zoomend', drawPhotos)
      map.on('moveend', drawPhotos)
      drawPhotos()
    }).catch(() => { /* ErrorBoundary handles SDK failures */ })
    return () => { cancelled = true; popupRef.current?.close(); if (mapRef.current) { mapRef.current.off?.('zoomend', drawPhotos); mapRef.current.off?.('moveend', drawPhotos) }; clearPhotoOverlays(); overlaysRef.current.forEach(o => o.setMap(null)); markersRef.current.clear(); mapRef.current?.destroy(); mapRef.current = null }
  }, [entries, trail, tracks, paddingBottom])

  useEffect(() => { if (activeMarkerId) { const timer = setTimeout(() => focusMarker(activeMarkerId), 50); return () => clearTimeout(timer) } }, [activeMarkerId, focusMarker])
  useEffect(() => { drawPhotos(); return () => { clearPhotoOverlays() } }, [photos, drawPhotos, clearPhotoOverlays])

  return <div style={{ position: 'relative', height: height === 9999 ? '100%' : height, width: '100%', borderRadius: 'inherit', overflow: 'hidden' }}><div ref={hostRef} style={{ width: '100%', height: '100%' }} /></div>
}

export default JourneyMapAMap
