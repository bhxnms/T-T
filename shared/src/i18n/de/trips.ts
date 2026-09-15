import type { TranslationStrings } from '../types';

const trips: TranslationStrings = {
  'trips.reminder': 'Erinnerung',
  'trips.reminderNone': 'Keine',
  'trips.reminderDay': 'Tag',
  'trips.reminderDays': 'Tage',
  'trips.reminderCustom': 'Benutzerdefiniert',
  'trips.memberRemoved': '{username} entfernt',
  'trips.memberRemoveError': 'Entfernen fehlgeschlagen',
  'trips.memberAdded': '{username} hinzugefügt',
  'trips.memberAddError': 'Hinzufügen fehlgeschlagen',
  'trips.reminderDaysBefore': 'Tage vor Abreise',
  'trips.reminderDisabledHint':
    'Reiseerinnerungen sind deaktiviert. Aktivieren Sie sie unter Admin > Einstellungen > Benachrichtigungen.',
  'trips.importTrekTab': 'Aus TREK importieren',
  'trips.importTrekIntro':
    'Lade ein TREK-Backup (.zip) hoch und wähle die Reisen, die nach TT kopiert werden sollen — Tage, Orte, Buchungen, Budget und Fotos kommen mit.',
  'trips.importTrekPick': 'TREK-Backup (.zip) auswählen',
  'trips.importTrekScanning': 'Backup wird gelesen…',
  'trips.importTrekImport': 'Ausgewählte Reisen importieren',
  'trips.importTrekSuccess': '{count} Reise(n) importiert',
  'trips.importTrekNone': 'Keine Reisen in diesem Backup gefunden',
  'trips.importTrekFailed': 'Import fehlgeschlagen — ist das eine TREK-Backup-Datei?',
  'trips.importTrekStats': '{days} Tage · {places} Orte · {photos} Fotos · {budget} Budgetposten',
  'trips.importTrekUntitled': 'Unbenannte Reise',
};
export default trips;
