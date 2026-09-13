/**
 * Landmark Icons for China Atlas
 * 中国地标图标系统 - 现代化线条风格
 */

export type LandmarkType =
  | 'mountain'
  | 'lake'
  | 'river'
  | 'waterfall'
  | 'temple'
  | 'palace'
  | 'ancient-town'
  | 'museum'
  | 'memorial'
  | 'tower'
  | 'garden'
  | 'grassland'
  | 'desert'
  | 'cave'
  | 'building'
  | 'bridge'
  | 'beach'
  | 'glacier'
  | 'village'
  | 'fortress'

/**
 * Modern, unified landmark icons - 24x24 viewBox, 2px stroke
 * 现代化统一风格图标
 */
export const LANDMARK_ICONS: Record<LandmarkType, string> = {
  // 山峰 - 三角山峰形状
  mountain: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 3l5 10h-10l5-10z"/>
    <path d="M3 21h18"/>
    <path d="M8 13l-5 8h18l-5-8"/>
  </svg>`,

  // 湖泊 - 水滴形状
  lake: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <ellipse cx="12" cy="13" rx="8" ry="5"/>
    <path d="M12 8c0 0 2-3 2-5s-2-2-2-2s-2 0-2 2s2 5 2 5"/>
    <line x1="8" y1="11" x2="9" y2="12"/>
    <line x1="15" y1="11" x2="16" y2="12"/>
  </svg>`,

  // 河流 - 波浪形
  river: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 7c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2"/>
    <path d="M3 13c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2"/>
    <path d="M3 19c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2"/>
  </svg>`,

  // 瀑布 - 垂直水流
  waterfall: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 3h16"/>
    <path d="M7 3v6c0 3-1 4-1 4"/>
    <path d="M12 3v8c0 4-1 5-1 5"/>
    <path d="M17 3v10c0 5-1 6-1 6"/>
    <ellipse cx="12" cy="20" rx="8" ry="2"/>
  </svg>`,

  // 寺庙 - 中式建筑屋顶
  temple: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2 9l10-6 10 6"/>
    <path d="M4 11v8h16v-8"/>
    <rect x="9" y="14" width="6" height="5"/>
    <line x1="12" y1="3" x2="12" y2="9"/>
    <circle cx="12" cy="2" r="1" fill="currentColor"/>
  </svg>`,

  // 宫殿 - 宏伟建筑
  palace: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="11" width="18" height="10"/>
    <path d="M2 9l10-6 10 6"/>
    <rect x="8" y="15" width="3" height="6"/>
    <rect x="13" y="15" width="3" height="6"/>
    <line x1="3" y1="9" x2="21" y2="9"/>
    <line x1="6" y1="11" x2="6" y2="21"/>
    <line x1="18" y1="11" x2="18" y2="21"/>
  </svg>`,

  // 古镇 - 传统房屋群
  'ancient-town': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 21v-7l4-3v10"/>
    <path d="M7 11l3-2v12"/>
    <path d="M10 9l4-3v15"/>
    <path d="M14 6l4-3v18"/>
    <line x1="2" y1="21" x2="22" y2="21"/>
  </svg>`,

  // 博物馆 - 展示柱建筑
  museum: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2 8l10-5 10 5"/>
    <line x1="2" y1="10" x2="22" y2="10"/>
    <line x1="5" y1="10" x2="5" y2="19"/>
    <line x1="9" y1="10" x2="9" y2="19"/>
    <line x1="15" y1="10" x2="15" y2="19"/>
    <line x1="19" y1="10" x2="19" y2="19"/>
    <line x1="2" y1="19" x2="22" y2="19"/>
    <line x1="2" y1="21" x2="22" y2="21"/>
  </svg>`,

  // 纪念馆 - 纪念碑形状
  memorial: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 2l3 6h-6l3-6z"/>
    <rect x="8" y="8" width="8" height="11"/>
    <rect x="6" y="19" width="12" height="2"/>
    <rect x="4" y="21" width="16" height="1"/>
    <line x1="10" y1="11" x2="14" y2="11"/>
    <line x1="10" y1="14" x2="14" y2="14"/>
  </svg>`,

  // 塔 - 多层宝塔
  tower: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 2l2 3h-4l2-3z"/>
    <rect x="9" y="5" width="6" height="3"/>
    <rect x="8" y="8" width="8" height="3"/>
    <rect x="7" y="11" width="10" height="4"/>
    <rect x="6" y="15" width="12" height="6"/>
    <line x1="12" y1="15" x2="12" y2="21"/>
  </svg>`,

  // 园林 - 花朵和树木
  garden: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="8" cy="8" r="3"/>
    <circle cx="8" cy="12" r="1" fill="currentColor"/>
    <circle cx="16" cy="10" r="4"/>
    <circle cx="16" cy="14" r="1" fill="currentColor"/>
    <path d="M8 11v7"/>
    <path d="M16 14v6"/>
    <line x1="3" y1="20" x2="21" y2="20"/>
  </svg>`,

  // 草原 - 起伏的草地
  grassland: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2 17c3-2 4-5 6-5s3 3 6 3 3-3 6-3 3 3 4 5"/>
    <path d="M2 20c3-1 4-3 6-3s3 2 6 2 3-2 6-2 3 2 4 3"/>
    <path d="M6 14v-3"/>
    <path d="M10 15v-4"/>
    <path d="M14 14v-2"/>
    <path d="M18 13v-3"/>
  </svg>`,

  // 沙漠 - 沙丘
  desert: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2 17l4-5 4 3 5-6 7 8"/>
    <path d="M2 20h20"/>
    <circle cx="18" cy="8" r="3"/>
    <line x1="16" y1="7" x2="20" y2="7"/>
    <line x1="18" y1="5" x2="18" y2="9"/>
  </svg>`,

  // 洞穴 - 山洞入口
  cave: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 21h18"/>
    <path d="M5 21v-7c0-3 2-5 7-5s7 2 7 5v7"/>
    <path d="M5 14c0-4 3-8 7-8s7 4 7 8"/>
    <circle cx="10" cy="4" r="1" fill="currentColor"/>
    <circle cx="14" cy="3" r="1" fill="currentColor"/>
  </svg>`,

  // 建筑 - 现代建筑
  building: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="4" y="7" width="16" height="14"/>
    <line x1="8" y1="3" x2="8" y2="7"/>
    <line x1="12" y1="2" x2="12" y2="7"/>
    <line x1="16" y1="3" x2="16" y2="7"/>
    <line x1="8" y1="11" x2="16" y2="11"/>
    <line x1="8" y1="15" x2="16" y2="15"/>
    <rect x="10" y="17" width="4" height="4"/>
  </svg>`,

  // 桥 - 拱桥
  bridge: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 18v3m16-3v3"/>
    <path d="M2 18h20"/>
    <path d="M6 18c0-6 2-9 6-9s6 3 6 9"/>
    <line x1="9" y1="13" x2="9" y2="18"/>
    <line x1="12" y1="11" x2="12" y2="18"/>
    <line x1="15" y1="13" x2="15" y2="18"/>
  </svg>`,

  // 海滩 - 海浪和沙滩
  beach: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="6" cy="6" r="3"/>
    <line x1="4" y1="4" x2="8" y2="8"/>
    <path d="M2 14c4 0 4-2 8-2s4 2 8 2 4-2 6-2"/>
    <path d="M2 18c4 0 4-2 8-2s4 2 8 2 4-2 6-2"/>
    <line x1="2" y1="22" x2="22" y2="22"/>
  </svg>`,

  // 冰川 - 冰山
  glacier: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 2l4 9h-8l4-9z"/>
    <path d="M8 11l-6 10h20l-6-10"/>
    <line x1="2" y1="21" x2="22" y2="21"/>
    <path d="M12 6v5m-2-3l2 2 2-2"/>
  </svg>`,

  // 村落 - 房屋
  village: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 21v-8l4-3v11"/>
    <path d="M7 10l5-4v15"/>
    <path d="M12 6l5 4v11"/>
    <rect x="14" y="14" width="2" height="4"/>
    <line x1="2" y1="21" x2="22" y2="21"/>
  </svg>`,

  // 堡垒 - 城墙
  fortress: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="4" y="9" width="16" height="12"/>
    <path d="M4 9v-3l2-2h2v2h2v-2h4v2h2v-2h2l2 2v3"/>
    <rect x="10" y="15" width="4" height="6"/>
    <line x1="8" y1="13" x2="8" y2="15"/>
    <line x1="16" y1="13" x2="16" y2="15"/>
  </svg>`,
}

/**
 * Get color for landmark type
 * 根据地标类型获取颜色
 */
export function getLandmarkColor(type: LandmarkType): string {
  const colors: Record<LandmarkType, string> = {
    // 自然景观 - 绿色/蓝色系
    mountain: '#10b981', // 翠绿
    lake: '#3b82f6', // 湖蓝
    river: '#06b6d4', // 青色
    waterfall: '#0ea5e9', // 天蓝
    grassland: '#84cc16', // 草绿
    desert: '#f59e0b', // 沙黄
    glacier: '#60a5fa', // 冰蓝
    beach: '#14b8a6', // 海蓝
    cave: '#78716c', // 石灰

    // 文化遗产 - 紫色/橙色系
    temple: '#a855f7', // 紫色
    palace: '#dc2626', // 宫红
    'ancient-town': '#f97316', // 橙色
    museum: '#8b5cf6', // 深紫
    memorial: '#6366f1', // 靛蓝
    tower: '#ec4899', // 粉红
    garden: '#22c55e', // 园绿
    fortress: '#ef4444', // 堡红

    // 现代建筑 - 灰色/蓝色系
    building: '#64748b', // 灰蓝
    bridge: '#0891b2', // 桥蓝
    village: '#ea580c', // 村橙
  }
  return colors[type] || '#6b7280'
}

/**
 * Get landmark icon SVG
 * 获取地标图标SVG
 */
export function getLandmarkIcon(type: LandmarkType): string {
  return LANDMARK_ICONS[type] || LANDMARK_ICONS.building
}

/**
 * Classify landmark by name
 * 根据名称自动分类地标
 */
export function classifyLandmark(name: string, nameEn: string): LandmarkType {
  const text = name + nameEn

  if (/(山|峰|岭|Mountain|Peak)/i.test(text)) return 'mountain'
  if (/(湖|Lake)/i.test(text)) return 'lake'
  if (/(江|河|River)/i.test(text)) return 'river'
  if (/(瀑布|Waterfall)/i.test(text)) return 'waterfall'
  if (/(寺|庙|Temple)/i.test(text)) return 'temple'
  if (/(宫|Palace|Imperial)/i.test(text)) return 'palace'
  if (/(古城|古镇|Ancient|Town)/i.test(text)) return 'ancient-town'
  if (/(博物馆|Museum)/i.test(text)) return 'museum'
  if (/(纪念|Memorial)/i.test(text)) return 'memorial'
  if (/(塔|Tower|Pagoda)/i.test(text)) return 'tower'
  if (/(园|Garden|Park)/i.test(text)) return 'garden'
  if (/(草原|Grassland)/i.test(text)) return 'grassland'
  if (/(沙漠|Desert)/i.test(text)) return 'desert'
  if (/(洞|Cave|Grotto)/i.test(text)) return 'cave'
  if (/(桥|Bridge)/i.test(text)) return 'bridge'
  if (/(滩|海|Beach|Bay)/i.test(text)) return 'beach'
  if (/(冰川|Glacier)/i.test(text)) return 'glacier'
  if (/(村|Village)/i.test(text)) return 'village'
  if (/(城|堡|关|Wall|Fortress|Fort)/i.test(text)) return 'fortress'

  return 'building'
}
