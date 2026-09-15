import type { TranslationStrings } from '../types';

const trips: TranslationStrings = {
  'trips.reminder': 'Lembrete',
  'trips.reminderNone': 'Nenhum',
  'trips.reminderDay': 'dia',
  'trips.reminderDays': 'dias',
  'trips.reminderCustom': 'Personalizado',
  'trips.memberRemoved': '{username} removido',
  'trips.memberRemoveError': 'Falha ao remover',
  'trips.memberAdded': '{username} adicionado',
  'trips.memberAddError': 'Falha ao adicionar',
  'trips.reminderDaysBefore': 'dias antes da partida',
  'trips.reminderDisabledHint':
    'Os lembretes de viagem estão desativados. Ative-os em Admin > Configurações > Notificações.',
  'trips.importTrekTab': 'Importar do TREK',
  'trips.importTrekIntro':
    'Envie um backup do TREK (.zip) e escolha as viagens a copiar para o TT — dias, lugares, reservas, orçamento e fotos vêm juntos.',
  'trips.importTrekPick': 'Escolher backup do TREK (.zip)',
  'trips.importTrekScanning': 'Lendo backup…',
  'trips.importTrekImport': 'Importar viagens selecionadas',
  'trips.importTrekSuccess': '{count} viagem(ns) importada(s)',
  'trips.importTrekNone': 'Nenhuma viagem encontrada neste backup',
  'trips.importTrekFailed': 'Falha na importação — este é um arquivo de backup do TREK?',
  'trips.importTrekStats': '{days} dias · {places} lugares · {photos} fotos · {budget} itens',
  'trips.importTrekUntitled': 'Viagem sem título',
};
export default trips;
