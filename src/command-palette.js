export const commandPalette = [
  ['/settings', '모델 설정 변경'], ['/key', 'API 키 숨김 입력'],
  ['/context', '컨텍스트 파일과 토큰 확인'], ['/context history off', '이전 대화 제외'],
  ['/frontend', '프론트엔드 프로젝트 분석'], ['/files', '파일 목록 보기'],
  ['/diagnose', '오류 검사 실행'], ['/fix', '검사 실패 수정 및 재검사'],
  ['/plan', '계획 모드 켜기'], ['/plan off', '구현 모드 전환'],
  ['/plan show', '저장된 계획 보기'], ['/apply', '계획 적용'],
  ['/diff', '코드 변경 비교'], ['/usage', '토큰 사용량 보기'],
  ['/copy', '마지막 답변 복사'], ['/help', '도움말'], ['/exit', '종료']
];
export function searchCommands(query) {
  const words = query.trim().toLowerCase().split(/\s+/);
  return commandPalette.filter(item => words.every(word => item.join(' ').toLowerCase().includes(word)));
}
