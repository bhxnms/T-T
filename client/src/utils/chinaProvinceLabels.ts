/**
 * China Province Labels for Atlas
 * 中国省份标签系统 - 在中国区域内显示中文省份名称
 */

import L from 'leaflet'
import { CHINA_PROVINCES } from '../data/chinaProvinces'

/**
 * Create a label layer for China provinces
 * 为中国省份创建标签层
 */
export function createChinaProvinceLabelLayer(map: L.Map): L.LayerGroup {
  const labelLayer = L.layerGroup()

  Object.values(CHINA_PROVINCES).forEach((province) => {
    const [lat, lng] = province.center

    // Create a DivIcon for the province label
    const icon = L.divIcon({
      html: `<div style="
        font-size: 13px;
        font-weight: 600;
        color: #333;
        text-shadow:
          1px 1px 0 white,
          -1px -1px 0 white,
          1px -1px 0 white,
          -1px 1px 0 white,
          2px 2px 3px rgba(0,0,0,0.2);
        white-space: nowrap;
        pointer-events: none;
        user-select: none;
      ">${province.name}</div>`,
      className: 'province-label',
      iconSize: [100, 20],
      iconAnchor: [50, 10],
    })

    const marker = L.marker([lat, lng], {
      icon,
      interactive: false,
      keyboard: false,
    })

    marker.addTo(labelLayer)
  })

  return labelLayer
}

/**
 * Update province label layer visibility based on zoom level
 * 根据缩放级别更新省份标签层的可见性
 */
export function updateProvinceLabelVisibility(
  map: L.Map,
  labelLayer: L.LayerGroup | null,
  minZoom: number = 5
): void {
  if (!labelLayer) return

  const currentZoom = map.getZoom()

  if (currentZoom >= minZoom) {
    if (!map.hasLayer(labelLayer)) {
      labelLayer.addTo(map)
    }
  } else {
    if (map.hasLayer(labelLayer)) {
      map.removeLayer(labelLayer)
    }
  }
}
