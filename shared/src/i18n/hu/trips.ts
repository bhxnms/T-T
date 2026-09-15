import type { TranslationStrings } from '../types';

const trips: TranslationStrings = {
  'trips.memberRemoved': '{username} eltávolítva',
  'trips.memberRemoveError': 'Eltávolítás sikertelen',
  'trips.memberAdded': '{username} hozzáadva',
  'trips.memberAddError': 'Hozzáadás sikertelen',
  'trips.reminder': 'Emlékeztető',
  'trips.reminderNone': 'Nincs',
  'trips.reminderDay': 'nap',
  'trips.reminderDays': 'nap',
  'trips.reminderCustom': 'Egyéni',
  'trips.reminderDaysBefore': 'nappal indulás előtt',
  'trips.reminderDisabledHint':
    'Az utazási emlékeztetők ki vannak kapcsolva. Kapcsold be az Admin > Beállítások > Értesítések menüben.',
  'trips.importTrekTab': 'Importálás TREK-ből',
  'trips.importTrekIntro':
    'Töltsön fel egy TREK biztonsági mentést (.zip), és válassza ki a TT-be másolandó utakat — napok, helyek, foglalások, költségvetés és fényképek együtt jönnek.',
  'trips.importTrekPick': 'TREK biztonsági mentés (.zip) kiválasztása',
  'trips.importTrekScanning': 'Mentés olvasása…',
  'trips.importTrekImport': 'Kiválasztott utak importálása',
  'trips.importTrekSuccess': '{count} út importálva',
  'trips.importTrekNone': 'Nem található út a mentésben',
  'trips.importTrekFailed': 'Importálás sikertelen — biztos TREK mentésfájl?',
  'trips.importTrekStats': '{days} nap · {places} hely · {photos} fotó · {budget} tétel',
  'trips.importTrekUntitled': 'Névtelen út',
};
export default trips;
