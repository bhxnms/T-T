import type { TranslationStrings } from '../types';

const trips: TranslationStrings = {
  'trips.memberRemoved': '{username} を削除しました',
  'trips.memberRemoveError': '削除に失敗しました',
  'trips.memberAdded': '{username} を追加しました',
  'trips.memberAddError': '追加に失敗しました',
  'trips.reminder': 'リマインダー',
  'trips.reminderNone': 'なし',
  'trips.reminderDay': '日',
  'trips.reminderDays': '日',
  'trips.reminderCustom': 'カスタム',
  'trips.reminderDaysBefore': '出発前',
  'trips.reminderDisabledHint': '旅行のリマインダーは無効です。管理 > 設定 > 通知から有効にしてください。',
  "trips.importTrekTab": "TREK からインポート",
  "trips.importTrekIntro": "TREK のバックアップ（.zip）をアップロードし、TT にコピーする旅行を選択してください。日程・場所・予約・予算・写真も一緒に取り込みます。",
  "trips.importTrekPick": "TREK バックアップ（.zip）を選択",
  "trips.importTrekScanning": "バックアップを読み込み中…",
  "trips.importTrekImport": "選択した旅行をインポート",
  "trips.importTrekSuccess": "{count} 件の旅行をインポートしました",
  "trips.importTrekNone": "このバックアップには旅行が見つかりません",
  "trips.importTrekFailed": "インポートに失敗しました — TREK のバックアップファイルか確認してください",
  "trips.importTrekStats": "{days} 日 · {places} 箇所 · {photos} 枚 · {budget} 件の予算",
  "trips.importTrekUntitled": "無題の旅行",
};
export default trips;
