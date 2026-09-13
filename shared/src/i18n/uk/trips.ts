import type { TranslationStrings } from '../types';

const trips: TranslationStrings = {
  'trips.memberRemoved': '{username} видалений',
  'trips.memberRemoveError': 'Не вдалося видалити',
  'trips.memberAdded': '{username} доданий',
  'trips.memberAddError': 'Не вдалося додати',
  'trips.reminder': 'Нагадування',
  'trips.reminderNone': 'Немає',
  'trips.reminderDay': 'день',
  'trips.reminderDays': 'днів',
  'trips.reminderCustom': 'Інше',
  'trips.reminderDaysBefore': "днів до від'їзду",
  'trips.reminderDisabledHint': 'Нагадування про поїздки вимкнено. Увімкніть їх в Адмін > Налаштування > Сповіщення.',
  "trips.importTrekTab": "Імпорт з TREK",
  "trips.importTrekIntro": "Завантажте резервну копію TREK (.zip) і виберіть поїздки для копіювання до TT — дні, місця, бронювання, бюджет і фото приїдуть разом.",
  "trips.importTrekPick": "Вибрати резервну копію TREK (.zip)",
  "trips.importTrekScanning": "Читання копії…",
  "trips.importTrekImport": "Імпортувати вибрані поїздки",
  "trips.importTrekSuccess": "Імпортовано поїздок: {count}",
  "trips.importTrekNone": "У цій копії поїздок не знайдено",
  "trips.importTrekFailed": "Помилка імпорту — це точно файл резервної копії TREK?",
  "trips.importTrekStats": "{days} дн. · {places} місць · {photos} фото · {budget} статей",
  "trips.importTrekUntitled": "Поїздка без назви",
};
export default trips;
