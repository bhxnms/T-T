import type { TranslationStrings } from '../types';

const trips: TranslationStrings = {
  'trips.memberRemoved': '{username} odebrán',
  'trips.memberRemoveError': 'Odebrání se nezdařilo',
  'trips.memberAdded': '{username} přidán',
  'trips.memberAddError': 'Přidání se nezdařilo',
  'trips.reminder': 'Připomínka',
  'trips.reminderNone': 'Žádná',
  'trips.reminderDay': 'den',
  'trips.reminderDays': 'dní',
  'trips.reminderCustom': 'Vlastní',
  'trips.reminderDaysBefore': 'dní před odjezdem',
  'trips.reminderDisabledHint': 'Připomínky výletů jsou zakázány. Povolte je v Správa > Nastavení > Oznámení.',
  "trips.importTrekTab": "Importovat z TREK",
  "trips.importTrekIntro": "Nahrajte zálohu TREK (.zip) a vyberte cesty ke zkopírování do TT — dny, místa, rezervace, rozpočet a fotky přijedou s nimi.",
  "trips.importTrekPick": "Vybrat zálohu TREK (.zip)",
  "trips.importTrekScanning": "Čte se záloha…",
  "trips.importTrekImport": "Importovat vybrané cesty",
  "trips.importTrekSuccess": "Importováno cest: {count}",
  "trips.importTrekNone": "V této záloze nebyly nalezeny žádné cesty",
  "trips.importTrekFailed": "Import selhal — je to opravdu soubor zálohy TREK?",
  "trips.importTrekStats": "{days} dní · {places} míst · {photos} fotek · {budget} položek",
  "trips.importTrekUntitled": "Cesta bez názvu",
};
export default trips;
