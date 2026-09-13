import type { TranslationStrings } from '../types';

const trips: TranslationStrings = {
  'trips.memberRemoved': '{username} rimosso',
  'trips.memberRemoveError': 'Rimozione non riuscita',
  'trips.memberAdded': '{username} aggiunto',
  'trips.memberAddError': 'Aggiunta non riuscita',
  'trips.reminder': 'Promemoria',
  'trips.reminderNone': 'Nessuno',
  'trips.reminderDay': 'giorno',
  'trips.reminderDays': 'giorni',
  'trips.reminderCustom': 'Personalizzato',
  'trips.reminderDaysBefore': 'giorni prima della partenza',
  'trips.reminderDisabledHint':
    'I promemoria dei viaggi sono disabilitati. Abilitali in Admin > Impostazioni > Notifiche.',
  "trips.importTrekTab": "Importa da TREK",
  "trips.importTrekIntro": "Carica un backup TREK (.zip) e scegli i viaggi da copiare in TT — giorni, luoghi, prenotazioni, budget e foto arrivano con loro.",
  "trips.importTrekPick": "Scegli backup TREK (.zip)",
  "trips.importTrekScanning": "Lettura del backup…",
  "trips.importTrekImport": "Importa i viaggi selezionati",
  "trips.importTrekSuccess": "{count} viaggio/i importati",
  "trips.importTrekNone": "Nessun viaggio trovato in questo backup",
  "trips.importTrekFailed": "Importazione non riuscita — è un file di backup TREK?",
  "trips.importTrekStats": "{days} giorni · {places} luoghi · {photos} foto · {budget} voci",
  "trips.importTrekUntitled": "Viaggio senza titolo",
};
export default trips;
