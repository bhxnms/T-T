import type { TranslationStrings } from '../types';

const trips: TranslationStrings = {
  'trips.memberRemoved': '{username} supprimé',
  'trips.memberRemoveError': 'Échec de la suppression',
  'trips.memberAdded': '{username} ajouté',
  'trips.memberAddError': "Échec de l'ajout",
  'trips.reminder': 'Rappel',
  'trips.reminderNone': 'Aucun',
  'trips.reminderDay': 'jour',
  'trips.reminderDays': 'jours',
  'trips.reminderCustom': 'Personnalisé',
  'trips.reminderDaysBefore': 'jours avant le départ',
  'trips.reminderDisabledHint':
    'Les rappels de voyage sont désactivés. Activez-les dans Admin > Paramètres > Notifications.',
  'trips.importTrekTab': 'Importer depuis TREK',
  'trips.importTrekIntro':
    'Téléversez une sauvegarde TREK (.zip) et choisissez les voyages à copier dans TT — jours, lieux, réservations, budget et photos inclus.',
  'trips.importTrekPick': 'Choisir une sauvegarde TREK (.zip)',
  'trips.importTrekScanning': 'Lecture de la sauvegarde…',
  'trips.importTrekImport': 'Importer les voyages sélectionnés',
  'trips.importTrekSuccess': '{count} voyage(s) importé(s)',
  'trips.importTrekNone': 'Aucun voyage trouvé dans cette sauvegarde',
  'trips.importTrekFailed': "Échec de l'import — est-ce bien un fichier de sauvegarde TREK ?",
  'trips.importTrekStats': '{days} jours · {places} lieux · {photos} photos · {budget} postes',
  'trips.importTrekUntitled': 'Voyage sans titre',
};
export default trips;
