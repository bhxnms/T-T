import type { TranslationStrings } from '../types';

const trips: TranslationStrings = {
  'trips.memberRemoved': '{username} διαγράφηκε',
  'trips.memberRemoveError': 'Αποτυχία διαγραφής',
  'trips.memberAdded': '{username} προστέθηκε',
  'trips.memberAddError': 'Αποτυχία προσθήκης',
  'trips.reminder': 'Ειδοποίηση',
  'trips.reminderNone': 'Κανένα',
  'trips.reminderDay': 'ημέρα',
  'trips.reminderDays': 'ημέρες',
  'trips.reminderCustom': 'Προσαρμοσμένη',
  'trips.reminderDaysBefore': 'ημέρες πριν από την αναχώση',
  'trips.reminderDisabledHint':
    'Η ειδοποίηση για τις υπενθυμήσεις είναι απενεργοποιημένη. Ενεργοποιήστε την στο Διαχείριση > Ρυθμίσεις > Ανακοινώσεις.',
  'trips.importTrekTab': 'Εισαγωγή από TREK',
  'trips.importTrekIntro':
    'Ανεβάστε ένα αντίγραφο ασφαλείας TREK (.zip) και επιλέξτε τα ταξίδια προς αντιγραφή στο TT — μέρες, τοποθεσίες, κρατήσεις, προϋπολογισμός και φωτογραφίες έρχονται μαζί.',
  'trips.importTrekPick': 'Επιλογή αντιγράφου TREK (.zip)',
  'trips.importTrekScanning': 'Ανάγνωση αντιγράφου…',
  'trips.importTrekImport': 'Εισαγωγή επιλεγμένων ταξιδιών',
  'trips.importTrekSuccess': 'Εισήχθησαν {count} ταξίδια',
  'trips.importTrekNone': 'Δεν βρέθηκαν ταξίδια σε αυτό το αντίγραφο',
  'trips.importTrekFailed': 'Η εισαγωγή απέτυχε — είναι αρχείο αντιγράφου TREK;',
  'trips.importTrekStats': '{days} μέρες · {places} τοποθεσίες · {photos} φωτογραφίες · {budget} έξοδα',
  'trips.importTrekUntitled': 'Ταξίδι χωρίς τίτλο',
};
export default trips;
