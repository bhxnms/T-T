import type { TranslationStrings } from '../types';

const trips: TranslationStrings = {
  'trips.memberRemoved': '{username} 已移除',
  'trips.memberRemoveError': '移除失敗',
  'trips.memberAdded': '{username} 已新增',
  'trips.memberAddError': '新增失敗',
  'trips.reminder': '提醒',
  'trips.reminderNone': '無',
  'trips.reminderDay': '天',
  'trips.reminderDays': '天',
  'trips.reminderCustom': '自定義',
  'trips.reminderDaysBefore': '天前提醒',
  'trips.reminderDisabledHint': '旅行提醒已停用。請在管理 > 設定 > 通知中啟用。',
  'trips.importTrekTab': '從TREK匯入',
  'trips.importTrekIntro':
    '上傳 TREK 備份檔（.zip），選擇要複製到 TT 的旅行——天數、地點、預訂、預算和照片會一併帶過來。',
  'trips.importTrekPick': '選擇 TREK 備份檔（.zip）',
  'trips.importTrekScanning': '正在讀取備份…',
  'trips.importTrekImport': '匯入所選旅行',
  'trips.importTrekSuccess': '已匯入 {count} 個旅行',
  'trips.importTrekNone': '備份中沒有找到旅行',
  'trips.importTrekFailed': '匯入失敗，請確認這是 TREK 備份檔',
  'trips.importTrekStats': '{days} 天 · {places} 個地點 · {photos} 張照片 · {budget} 筆預算',
  'trips.importTrekUntitled': '未命名旅行',
};
export default trips;
