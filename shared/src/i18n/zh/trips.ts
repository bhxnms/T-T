import type { TranslationStrings } from '../types';

const trips: TranslationStrings = {
  'trips.memberRemoved': '{username} 已移除',
  'trips.memberRemoveError': '移除失败',
  'trips.memberAdded': '{username} 已添加',
  'trips.memberAddError': '添加失败',
  'trips.reminder': '提醒',
  'trips.reminderNone': '无',
  'trips.reminderDay': '天',
  'trips.reminderDays': '天',
  'trips.reminderCustom': '自定义',
  'trips.reminderDaysBefore': '天前提醒',
  'trips.reminderDisabledHint': '旅行提醒已禁用。请在管理 > 设置 > 通知中启用。',
  "trips.importTrekTab": "从TREK导入",
  "trips.importTrekIntro": "上传 TREK 备份文件（.zip），选择要复制到 TT 的旅行——天数、地点、预订、预算和照片会一并带过来。",
  "trips.importTrekPick": "选择 TREK 备份文件（.zip）",
  "trips.importTrekScanning": "正在读取备份…",
  "trips.importTrekImport": "导入选中旅行",
  "trips.importTrekSuccess": "已导入 {count} 个旅行",
  "trips.importTrekNone": "备份中没有找到旅行",
  "trips.importTrekFailed": "导入失败，请确认这是 TREK 备份文件",
  "trips.importTrekStats": "{days} 天 · {places} 个地点 · {photos} 张照片 · {budget} 条预算",
  "trips.importTrekUntitled": "未命名旅行",
};
export default trips;
