import type { TranslationStrings } from '../types';

const trips: TranslationStrings = {
  'trips.memberRemoved': '{username} удалён',
  'trips.memberRemoveError': 'Не удалось удалить',
  'trips.memberAdded': '{username} добавлен',
  'trips.memberAddError': 'Не удалось добавить',
  'trips.reminder': 'Напоминание',
  'trips.reminderNone': 'Нет',
  'trips.reminderDay': 'день',
  'trips.reminderDays': 'дней',
  'trips.reminderCustom': 'Другое',
  'trips.reminderDaysBefore': 'дней до отъезда',
  'trips.reminderDisabledHint': 'Напоминания о поездках отключены. Включите их в Админ > Настройки > Уведомления.',
  'trips.importTrekTab': 'Импорт из TREK',
  'trips.importTrekIntro':
    'Загрузите резервную копию TREK (.zip) и выберите поездки для копирования в TT — дни, места, брони, бюджет и фото приедут вместе с ними.',
  'trips.importTrekPick': 'Выбрать резервную копию TREK (.zip)',
  'trips.importTrekScanning': 'Чтение копии…',
  'trips.importTrekImport': 'Импортировать выбранные поездки',
  'trips.importTrekSuccess': 'Импортировано поездок: {count}',
  'trips.importTrekNone': 'В этой копии поездки не найдены',
  'trips.importTrekFailed': 'Ошибка импорта — это точно файл резервной копии TREK?',
  'trips.importTrekStats': '{days} дн. · {places} мест · {photos} фото · {budget} статей',
  'trips.importTrekUntitled': 'Поездка без названия',
};
export default trips;
