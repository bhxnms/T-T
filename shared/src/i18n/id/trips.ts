import type { TranslationStrings } from '../types';

const trips: TranslationStrings = {
  'trips.memberRemoved': '{username} dihapus',
  'trips.memberRemoveError': 'Gagal menghapus',
  'trips.memberAdded': '{username} ditambahkan',
  'trips.memberAddError': 'Gagal menambahkan',
  'trips.reminder': 'Pengingat',
  'trips.reminderNone': 'Tidak ada',
  'trips.reminderDay': 'hari',
  'trips.reminderDays': 'hari',
  'trips.reminderCustom': 'Kustom',
  'trips.reminderDaysBefore': 'hari sebelum keberangkatan',
  'trips.reminderDisabledHint': 'Pengingat perjalanan dinonaktifkan. Aktifkan di Admin > Pengaturan > Notifikasi.',
  'trips.importTrekTab': 'Impor dari TREK',
  'trips.importTrekIntro':
    'Unggah cadangan TREK (.zip) dan pilih perjalanan yang akan disalin ke TT — hari, tempat, pemesanan, anggaran, dan foto ikut serta.',
  'trips.importTrekPick': 'Pilih cadangan TREK (.zip)',
  'trips.importTrekScanning': 'Membaca cadangan…',
  'trips.importTrekImport': 'Impor perjalanan terpilih',
  'trips.importTrekSuccess': '{count} perjalanan diimpor',
  'trips.importTrekNone': 'Tidak ada perjalanan ditemukan di cadangan ini',
  'trips.importTrekFailed': 'Impor gagal — apakah ini file cadangan TREK?',
  'trips.importTrekStats': '{days} hari · {places} tempat · {photos} foto · {budget} item',
  'trips.importTrekUntitled': 'Perjalanan tanpa judul',
};
export default trips;
