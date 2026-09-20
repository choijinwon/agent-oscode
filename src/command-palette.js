export const primaryCommands = ['/states record ', '/states run ', '/states fix ', '/preview', '/settings', '/workspace', '/review', '/help'];
export const commandPalette = [
  ['/design motion ', '인터랙션 강도 auto·reduced·off 선택'],
  ['/design interact ', '아코디언·작업 메뉴·되돌리기·단계 폼·선택·순서 변경'],
  ['/design admin ', '관리자 대시보드·필터 테이블·사용자 초대 디자인'],
  ['/design gallery ', '디자인 갤러리·색상·크기·상태별 미리보기'],
  ['/design mobile ', '모바일 탭바·바텀시트·폼과 화면 크기 미리보기'],
  ['/design', '디자인 스튜디오·테마·팀 컴포넌트 사용법'],
  ['/design apply ', '선택한 컴포넌트와 CSS 생성'],
  ['/design theme', '프로젝트 디자인 토큰 확인·설정'],
  ['/design register ', '팀 컴포넌트 등록'],
  ['/inspect ', '화면 요소 선택·관련 소스·스타일 진단'],
  ['/inspect fix ', '선택한 요소 수정·같은 조건 재진단'],
  ['/css ', '선택자의 실제 CSS·부모 레이아웃 진단'],
  ['/stress ', '긴 글·좁은 화면·다크·연속 클릭·지연 응답 검사'],
  ['/reuse ', '프로젝트 기존 컴포넌트·API·사용 후보 찾기'],
  ['/bug ', 'UI 실패 화면·시나리오·실행 기록 공유 묶음 저장'],
  ['/replay ', '공유 시나리오를 개발 서버에서 재현'],
  ['/hydrate ', 'SSR·하이드레이션·새로고침 차이 진단'],
  ['/mcp', '외부 MCP 서버 연결·도구 선택·해제'],
  ['/states fix ', '실패 확인 → AI 수정 → 동일 조건 재검증·전후 보고서'],
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
  ['/intranet', '폐쇄망·내부 LLM 주소와 모델 설정·연결 확인'],
  ['/context', '컨텍스트 파일과 토큰 확인'], ['/context history off', '이전 대화 제외'],
  ['/frontend', '프론트엔드 프로젝트 분석'], ['/files', '파일 목록 보기'],
  ['/diagnose', '오류 검사 실행'], ['/fix', '검사 실패 수정 및 재검사'],
  ['/plan', '계획 모드 켜기'], ['/plan off', '구현 모드 전환'],
  ['/plan show', '저장된 계획 보기'], ['/apply', '계획 적용'],
  ['/diff', '코드 변경 비교'], ['/usage', '토큰 사용량 보기'],
  ['/copy', '마지막 답변 복사 · F6'], ['/copy code', '코드 블록만 복사 · F7'], ['/help', '도움말'], ['/exit', '종료']
];
export function searchCommands(query) {
  if(!query.trim()||query.trim()==='/')return primaryCommands.map(command=>commandPalette.find(item=>item[0]===command));
  const words = query.trim().toLowerCase().split(/\s+/);
  return commandPalette.filter(item => words.every(word => item.join(' ').toLowerCase().includes(word)));
}
