export const commandPalette = [
  ['/states record ', '화면 클릭·입력 녹화와 검증 조건 선택'],
  ['/states run ', '브라우저에서 시나리오 실행·실제 UI 상태 검증'],
  ['/states ', '컴포넌트 로딩·오류·빈 결과·비활성 상태 점검'],
  ['/architecture', '프론트엔드 폴더 역할·의존 관계·순환 참조 분석'],
  ['/review', '변경 파일·프로젝트 검사·반응형·접근성 검증'], ['/review show', '마지막 검증 결과 보기'],
  ['/summary', '작업 결과·도구 실행 근거 확인'], ['/handoff', '작업 인계 파일 저장'], ['/handoff copy', '작업 인계 내용 복사'],
  ['/map', '관련 파일·함수·컴포넌트 코드 지도'],
  ['/approval', '나 대신 승인·자동 승인·나에게 묻기 선택'],
  ['/style', '글자 굵기·테마·답변 서식 선택'],
  ['/skills', '.oscode 프로젝트 스킬 선택'], ['/skills off', '선택한 스킬 해제'],
  ['/preview', '개발 중인 웹 화면 열기'],
  ['/workspace', '작업 폴더 지정·변경'], ['/cwd', '현재 작업 폴더 확인'],
  ['/ocr ', '이미지·PDF 텍스트 추출'],
  ['/settings', '모델 설정 변경'], ['/key', 'API 키 숨김 입력'],
  ['/context', '컨텍스트 파일과 토큰 확인'], ['/context history off', '이전 대화 제외'],
  ['/frontend', '프론트엔드 프로젝트 분석'], ['/files', '파일 목록 보기'],
  ['/diagnose', '오류 검사 실행'], ['/fix', '검사 실패 수정 및 재검사'],
  ['/plan', '계획 모드 켜기'], ['/plan off', '구현 모드 전환'],
  ['/plan show', '저장된 계획 보기'], ['/apply', '계획 적용'],
  ['/diff', '코드 변경 비교'], ['/usage', '토큰 사용량 보기'],
  ['/copy', '마지막 답변 복사 · F6'], ['/copy code', '코드 블록만 복사 · F7'], ['/help', '도움말'], ['/exit', '종료']
];
export function searchCommands(query) {
  const words = query.trim().toLowerCase().split(/\s+/);
  return commandPalette.filter(item => words.every(word => item.join(' ').toLowerCase().includes(word)));
}
