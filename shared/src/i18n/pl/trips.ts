import type { TranslationStrings } from '../types';

const trips: TranslationStrings = {
  'trips.memberRemoved': '{username} usunięty',
  'trips.memberRemoveError': 'Nie udało się usunąć',
  'trips.memberAdded': '{username} dodany',
  'trips.memberAddError': 'Nie udało się dodać',
  'trips.reminder': 'Przypomnienie',
  'trips.reminderNone': 'Brak',
  'trips.reminderDay': 'dzień',
  'trips.reminderDays': 'dni',
  'trips.reminderCustom': 'Niestandardowe',
  'trips.reminderDaysBefore': 'dni przed wyjazdem',
  'trips.reminderDisabledHint': 'Przypomnienia o podróżach są wyłączone.',
  "trips.importTrekTab": "Importuj z TREK",
  "trips.importTrekIntro": "Prześlij kopię zapasową TREK (.zip) i wybierz podróże do skopiowania do TT — dni, miejsca, rezerwacje, budżet i zdjęcia przyjadą z nimi.",
  "trips.importTrekPick": "Wybierz kopię zapasową TREK (.zip)",
  "trips.importTrekScanning": "Odczytywanie kopii…",
  "trips.importTrekImport": "Importuj wybrane podróże",
  "trips.importTrekSuccess": "Zaimportowano podróże: {count}",
  "trips.importTrekNone": "Nie znaleziono podróży w tej kopii",
  "trips.importTrekFailed": "Import nie powiódł się — czy to plik kopii zapasowej TREK?",
  "trips.importTrekStats": "{days} dni · {places} miejsc · {photos} zdjęć · {budget} pozycji",
  "trips.importTrekUntitled": "Podróż bez tytułu",
};
export default trips;
