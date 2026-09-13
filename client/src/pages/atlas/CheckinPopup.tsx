/**
 * Check-in Popup Component for Atlas
 * 自定义打卡点弹窗 — 与预设地标弹窗（LandmarkPopup）同一风格：
 * 名称、所在国家/地区、打卡日期，以及旅程里给这个地点添加的照片预览
 * （没有照片时整个区块不出现）。底部按钮可取消打卡。
 */

import React, { useEffect, useState } from 'react'
import { CheckCircle2, X } from 'lucide-react'
import { getCheckedPlaceById, togglePlaceCheckin, type CheckedPlace } from '../../utils/checkinStorage'

interface PlacePhoto {
  photo_id: number
  caption: string | null
  taken_at: string | null
}

interface CheckinPopupProps {
  placeId: number
  onClose: () => void
  onToggled: () => void
}

export default function CheckinPopup({ placeId, onClose, onToggled }: CheckinPopupProps) {
  const [place, setPlace] = useState<CheckedPlace | null>(() => getCheckedPlaceById(placeId))
  const [location, setLocation] = useState<string>('')
  const [photos, setPhotos] = useState<PlacePhoto[] | null>(null)

  // Fresh state at open time: the underlying place may have been unchecked elsewhere.
  useEffect(() => {
    setPlace(getCheckedPlaceById(placeId))
  }, [placeId])

  // Where is this? The atlas locate endpoint resolves against the same bundled
  // polygons the map colours, so the answer reads like the map does.
  useEffect(() => {
    const p = getCheckedPlaceById(placeId)
    if (!p || p.lat == null || p.lng == null) return
    let cancelled = false
    import('../../api/client').then(({ default: apiClient }) =>
      apiClient
        .get('/addons/atlas/locate', { params: { lat: p.lat, lng: p.lng } })
        .then(({ data }: { data: { region_name: string | null; country_code: string | null } }) => {
          if (cancelled) return
          let country = data.country_code ?? ''
          try {
            country = new Intl.DisplayNames(['zh'], { type: 'region' }).of(data.country_code ?? '') ?? country
          } catch { /* keep the code */ }
          setLocation([data.region_name, country].filter(Boolean).join(' · '))
        })
        .catch(() => {}),
    )
    return () => { cancelled = true }
  }, [placeId])

  // Photos added on the journey page for this place (none → the block stays away).
  useEffect(() => {
    let cancelled = false
    import('../../api/client').then(({ default: apiClient }) =>
      apiClient
        .get('/addons/atlas/place-photos', { params: { place_id: placeId } })
        .then(({ data }: { data: { photos: PlacePhoto[] } }) => {
          if (!cancelled) setPhotos(data.photos ?? [])
        })
        .catch(() => { if (!cancelled) setPhotos([]) }),
    )
    return () => { cancelled = true }
  }, [placeId])

  if (!place) return null

  const handleToggle = () => {
    togglePlaceCheckin(place)
    onToggled()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="relative mx-4 max-w-md rounded-xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '400px', width: '90%' }}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          aria-label="关闭"
        >
          <X size={20} />
        </button>

        {/* Icon */}
        <div
          className="mb-4 flex h-16 w-16 items-center justify-center rounded-full"
          style={{ backgroundColor: 'rgba(16,185,129,0.15)', color: '#10b981' }}
        >
          <CheckCircle2 size={32} />
        </div>

        {/* Content */}
        <div>
          <div className="mb-1 text-sm text-gray-500">{location}</div>
          <h3 className="mb-3 text-xl font-bold text-gray-900">{place.name}</h3>
          {place.checkedAt > 0 && (
            <p className="mb-3 text-sm text-gray-600">
              打卡日期：{new Date(place.checkedAt).toLocaleDateString('zh-CN')}
            </p>
          )}
        </div>

        {/* Photo preview — only when the journey actually has photos for this place */}
        {photos && photos.length > 0 && (
          <div className="mt-2">
            <p className="mb-2 text-xs font-semibold text-gray-500">旅程照片 · {photos.length}</p>
            <div className="grid grid-cols-3 gap-2">
              {photos.slice(0, 6).map((p) => (
                <a
                  key={p.photo_id}
                  href={`/api/photos/${p.photo_id}/original`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block h-20 overflow-hidden rounded-lg bg-gray-100"
                >
                  <img
                    src={`/api/photos/${p.photo_id}/thumbnail`}
                    alt={p.caption ?? ''}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform hover:scale-105"
                  />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Check-in toggle */}
        <button
          onClick={handleToggle}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 font-semibold transition-all"
          style={{
            backgroundColor: '#10b981',
            color: 'white',
            border: '2px solid #10b981',
          }}
        >
          <CheckCircle2 size={20} />
          取消打卡
        </button>
      </div>
    </div>
  )
}
