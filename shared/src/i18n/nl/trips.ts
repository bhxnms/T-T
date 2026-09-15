import type { TranslationStrings } from '../types';

const trips: TranslationStrings = {
  'trips.memberRemoved': '{username} verwijderd',
  'trips.memberRemoveError': 'Verwijderen mislukt',
  'trips.memberAdded': '{username} toegevoegd',
  'trips.memberAddError': 'Toevoegen mislukt',
  'trips.reminder': 'Herinnering',
  'trips.reminderNone': 'Geen',
  'trips.reminderDay': 'dag',
  'trips.reminderDays': 'dagen',
  'trips.reminderCustom': 'Aangepast',
  'trips.reminderDaysBefore': 'dagen voor vertrek',
  'trips.reminderDisabledHint':
    'Reisherinneringen zijn uitgeschakeld. Schakel ze in via Admin > Instellingen > Meldingen.',
  'trips.importTrekTab': 'Importeren vanuit TREK',
  'trips.importTrekIntro':
    "Upload een TREK-backup (.zip) en kies de reizen om naar TT te kopiëren — dagen, plaatsen, boekingen, budget en foto's komen mee.",
  'trips.importTrekPick': 'Kies een TREK-backup (.zip)',
  'trips.importTrekScanning': 'Backup lezen…',
  'trips.importTrekImport': 'Geselecteerde reizen importeren',
  'trips.importTrekSuccess': '{count} reis/reizen geïmporteerd',
  'trips.importTrekNone': 'Geen reizen gevonden in deze backup',
  'trips.importTrekFailed': 'Import mislukt — is dit een TREK-backupbestand?',
  'trips.importTrekStats': "{days} dagen · {places} plaatsen · {photos} foto's · {budget} posten",
  'trips.importTrekUntitled': 'Reis zonder titel',
};
export default trips;
