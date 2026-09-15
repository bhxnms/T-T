import type { TranslationStrings } from '../types';

const trips: TranslationStrings = {
  'trips.memberRemoved': '{username} borttagen',
  'trips.memberRemoveError': 'Det gick inte att ta bort',
  'trips.memberAdded': '{username} tillagd',
  'trips.memberAddError': 'Det gick inte att lägga till',
  'trips.reminder': 'Påminnelse',
  'trips.reminderNone': 'Ingen',
  'trips.reminderDay': 'dag',
  'trips.reminderDays': 'dagar',
  'trips.reminderCustom': 'Anpassad',
  'trips.reminderDaysBefore': 'dagar innan avresa',
  'trips.reminderDisabledHint':
    'Resepåminnelser är inaktiverade. Aktivera dem under Admin > Inställningar > Meddelanden.',
  'trips.importTrekTab': '',
  'trips.importTrekIntro': '',
  'trips.importTrekPick': '',
  'trips.importTrekScanning': '',
  'trips.importTrekImport': '',
  'trips.importTrekSuccess': 'Imported {count} trip(s)',
  'trips.importTrekNone': '',
  'trips.importTrekFailed': '',
  'trips.importTrekStats': '{days} days · {places} places · {photos} photos · {budget} budget items',
  'trips.importTrekUntitled': '',
};
export default trips;
