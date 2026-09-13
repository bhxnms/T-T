import type { TranslationStrings } from '../types';

const trips: TranslationStrings = {
  'trips.memberRemoved': '{username} kaldırıldı',
  'trips.memberRemoveError': 'Kaldırılamadı',
  'trips.memberAdded': '{username} eklendi',
  'trips.memberAddError': 'Eklenemedi',
  'trips.reminder': 'Hatırlatıcı',
  'trips.reminderNone': 'Yok',
  'trips.reminderDay': 'gün',
  'trips.reminderDays': 'gün',
  'trips.reminderCustom': 'Özel',
  'trips.reminderDaysBefore': 'hareketten önce gün',
  'trips.reminderDisabledHint': 'Seyahat hatırlatıcıları kapalı. Yönetici > Ayarlar > Bildirimler bölümünden açın.',
  "trips.importTrekTab": "TREK'den içe aktar",
  "trips.importTrekIntro": "Bir TREK yedeği (.zip) yükleyin ve TT'ye kopyalanacak gezileri seçin — günler, yerler, rezervasyonlar, bütçe ve fotoğraflar birlikte gelir.",
  "trips.importTrekPick": "TREK yedeği (.zip) seç",
  "trips.importTrekScanning": "Yedek okunuyor…",
  "trips.importTrekImport": "Seçilen gezileri içe aktar",
  "trips.importTrekSuccess": "{count} gezi içe aktarıldı",
  "trips.importTrekNone": "Bu yedekte gezi bulunamadı",
  "trips.importTrekFailed": "İçe aktarma başarısız — bu bir TREK yedek dosyası mı?",
  "trips.importTrekStats": "{days} gün · {places} yer · {photos} fotoğraf · {budget} kalem",
  "trips.importTrekUntitled": "Adsız gezi",
};
export default trips;
