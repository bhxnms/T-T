import type { TranslationStrings } from '../types';

const trips: TranslationStrings = {
  'trips.memberRemoved': '{username} removed',
  'trips.memberRemoveError': 'Failed to remove',
  'trips.memberAdded': '{username} added',
  'trips.memberAddError': 'Failed to add',
  'trips.reminder': 'Reminder',
  'trips.reminderNone': 'None',
  'trips.reminderDay': 'day',
  'trips.reminderDays': 'days',
  'trips.reminderCustom': 'Custom',
  'trips.reminderDaysBefore': 'days before departure',
  'trips.reminderDisabledHint': 'Trip reminders are disabled. Enable them in Admin > Settings > Notifications.',
  "trips.importTrekTab": "Import from TREK",
  "trips.importTrekIntro": "Upload a TREK backup (.zip) and pick the trips to copy into TT — days, places, bookings, budget and photos come along.",
  "trips.importTrekPick": "Choose a TREK backup (.zip)",
  "trips.importTrekScanning": "Reading backup…",
  "trips.importTrekImport": "Import selected trips",
  "trips.importTrekSuccess": "Imported {count} trip(s)",
  "trips.importTrekNone": "No trips found in this backup",
  "trips.importTrekFailed": "Import failed — is this a TREK backup file?",
  "trips.importTrekStats": "{days} days · {places} places · {photos} photos · {budget} budget items",
  "trips.importTrekUntitled": "Untitled trip",
};
export default trips;
