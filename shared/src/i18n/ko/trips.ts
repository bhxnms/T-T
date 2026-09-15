import type { TranslationStrings } from '../types';

const trips: TranslationStrings = {
  'trips.memberRemoved': '{username} 제거됨',
  'trips.memberRemoveError': '제거 실패',
  'trips.memberAdded': '{username} 추가됨',
  'trips.memberAddError': '추가 실패',
  'trips.reminder': '리마인더',
  'trips.reminderNone': '없음',
  'trips.reminderDay': '일',
  'trips.reminderDays': '일',
  'trips.reminderCustom': '직접 설정',
  'trips.reminderDaysBefore': '일 전 출발',
  'trips.reminderDisabledHint': '여행 리마인더가 비활성화되어 있습니다. 관리자 > 설정 > 알림에서 활성화하세요.',
  'trips.importTrekTab': 'TREK에서 가져오기',
  'trips.importTrekIntro':
    'TREK 백업(.zip)을 업로드하고 TT로 복사할 여행을 선택하세요 — 일정, 장소, 예약, 예산, 사진이 함께 가져와집니다.',
  'trips.importTrekPick': 'TREK 백업(.zip) 선택',
  'trips.importTrekScanning': '백업 읽는 중…',
  'trips.importTrekImport': '선택한 여행 가져오기',
  'trips.importTrekSuccess': '{count}개의 여행을 가져왔습니다',
  'trips.importTrekNone': '이 백업에서 여행을 찾을 수 없습니다',
  'trips.importTrekFailed': '가져오기 실패 — TREK 백업 파일이 맞는지 확인하세요',
  'trips.importTrekStats': '{days}일 · {places}곳 · {photos}장 · {budget}개 예산',
  'trips.importTrekUntitled': '제목 없는 여행',
};
export default trips;
