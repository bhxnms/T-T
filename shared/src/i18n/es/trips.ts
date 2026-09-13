import type { TranslationStrings } from '../types';

const trips: TranslationStrings = {
  'trips.reminder': 'Recordatorio',
  'trips.reminderNone': 'Ninguno',
  'trips.reminderDay': 'día',
  'trips.reminderDays': 'días',
  'trips.reminderCustom': 'Personalizado',
  'trips.memberRemoved': '{username} eliminado',
  'trips.memberRemoveError': 'Error al eliminar',
  'trips.memberAdded': '{username} añadido',
  'trips.memberAddError': 'Error al añadir',
  'trips.reminderDaysBefore': 'días antes de la salida',
  'trips.reminderDisabledHint':
    'Los recordatorios de viaje están desactivados. Actívalos en Admin > Configuración > Notificaciones.',
  "trips.importTrekTab": "Importar de TREK",
  "trips.importTrekIntro": "Sube una copia de seguridad de TREK (.zip) y elige los viajes a copiar a TT — días, lugares, reservas, presupuesto y fotos vienen incluidos.",
  "trips.importTrekPick": "Elegir copia de TREK (.zip)",
  "trips.importTrekScanning": "Leyendo copia…",
  "trips.importTrekImport": "Importar viajes seleccionados",
  "trips.importTrekSuccess": "{count} viaje(s) importado(s)",
  "trips.importTrekNone": "No se encontraron viajes en esta copia",
  "trips.importTrekFailed": "Error al importar — ¿es un archivo de copia de TREK?",
  "trips.importTrekStats": "{days} días · {places} lugares · {photos} fotos · {budget} partidas",
  "trips.importTrekUntitled": "Viaje sin título",
};
export default trips;
