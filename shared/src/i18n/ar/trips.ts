import type { TranslationStrings } from '../types';

const trips: TranslationStrings = {
  'trips.memberRemoved': '{username} تمت إزالته',
  'trips.memberRemoveError': 'فشل في الإزالة',
  'trips.memberAdded': '{username} تمت إضافته',
  'trips.memberAddError': 'فشل في الإضافة',
  'trips.reminder': 'تذكير',
  'trips.reminderNone': 'بدون',
  'trips.reminderDay': 'يوم',
  'trips.reminderDays': 'أيام',
  'trips.reminderCustom': 'مخصص',
  'trips.reminderDaysBefore': 'أيام قبل المغادرة',
  'trips.reminderDisabledHint': 'تذكيرات الرحلة معطلة. قم بتفعيلها من الإدارة > الإعدادات > الإشعارات.',
  'trips.importTrekTab': 'استيراد من TREK',
  'trips.importTrekIntro':
    'قم بتحميل نسخة احتياطية من TREK (.zip) واختر الرحلات المراد نسخها إلى TT — الأيام والأماكن والحجوزات والميزانية والصور تأتي معها.',
  'trips.importTrekPick': 'اختر نسخة احتياطية TREK (.zip)',
  'trips.importTrekScanning': 'جارٍ قراءة النسخة الاحتياطية…',
  'trips.importTrekImport': 'استيراد الرحلات المحددة',
  'trips.importTrekSuccess': 'تم استيراد {count} رحلة',
  'trips.importTrekNone': 'لم يتم العثور على رحلات في هذه النسخة',
  'trips.importTrekFailed': 'فشل الاستيراد — هل هذا ملف نسخة احتياطية من TREK؟',
  'trips.importTrekStats': '{days} أيام · {places} أماكن · {photos} صور · {budget} بنود',
  'trips.importTrekUntitled': 'رحلة بدون عنوان',
};
export default trips;
