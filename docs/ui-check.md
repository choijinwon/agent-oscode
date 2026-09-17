# 브라우저 UI 진단

개발 서버를 먼저 실행한 후 URL을 지정하세요. 초기 페이지 로드만 검사하며 버튼 클릭이나 로그인은 수행하지 않습니다.

```sh
npm install
npx playwright install chromium
oscode ui check http://localhost:3000/login
oscode ui check http://localhost:3000/login --viewport mobile
# 같은 명령
oscode --ui-check http://localhost:3000/login --viewport mobile
```

Playwright는 선택 의존성입니다. 일반 CLI는 브라우저 없이 사용할 수 있습니다. 의존성을 제외해 설치했다면 `npm install playwright`가 필요합니다. Linux 시스템 라이브러리가 부족하면 `npx playwright install --with-deps chromium`을 사용하세요.

## 결과

- mobile 390×844, tablet 768×1024, desktop 1440×900의 격리된 Chromium 컨텍스트.
- 페이지 가로 넘침과 의심 요소의 CSS 선택자·좌표. 의도된 슬라이더 등도 후보로 표시될 수 있습니다.
- 콘솔 경고/오류, 런타임 오류, 실패한 요청 및 HTTP 400 이상 응답. 각 목록은 중복 제거 후 최대 20건.
- `.oscode/ui-*/report.json`과 화면 크기별 PNG. PNG는 현재 뷰포트 캡처이며 전체 긴 페이지 캡처가 아닙니다.
- CLI 종료 코드: 0 관측된 문제 없음, 2 진단 항목 발견, 1 실행 실패/불완전 검사. 0은 UI 품질 전체를 보증하지 않습니다.

API 호출이나 토큰 사용 없이 진단합니다. 터미널에는 크기별 대표 항목만 표시하고 전체 결과는 report.json에 보관합니다. URL 필드의 쿼리/해시는 제거하지만 콘솔 메시지와 화면에는 앱 데이터가 포함될 수 있습니다. 결과를 공유하기 전에 확인하세요.

## 에이전트 연결

```sh
oscode --agent frontend --prompt 'http://localhost:3000/login 의 모바일 가로 넘침을 진단하고 고친 뒤 다시 확인해줘'
```

BUILD에서 `ui_check` 도구를 사용할 수 있습니다. 모델은 요약 결과의 선택자를 단서로 관련 파일을 검색하고 기존 편집 도구로 수정한 뒤 해당 viewport를 재검사하도록 안내받습니다. 소스 파일의 정확한 위치를 자동 확정하는 기능은 아닙니다. 모델 API 사용량은 기존 예산에 포함되고 스크린샷은 모델에 자동 전송하지 않습니다.

브라우저는 페이지 JavaScript와 네트워크 요청을 실행하므로 에이전트에서는 기존 shell 승인 정책을 따릅니다. `--allow-shell`은 브라우저 실행도 자동 허용합니다. 단독 `ui check URL`은 명령 자체가 실행 요청입니다. 프로젝트 `permissions.shell: "deny"` 또는 PLAN에서는 실행을 차단합니다. 기존 프로필/쿠키를 사용하지 않으며 페이지의 자동 네트워크 요청은 발생할 수 있습니다.

## 검증 범위

로드 후 500ms를 기다린 다음 최대 5,000개 상위 문서 요소를 살펴봅니다. iframe 내부·shadow DOM·상호작용 이후 상태·모든 지연 요청은 포함하지 않습니다. 화면 겹침/잘림 전체 판정, 기준 이미지와 픽셀 비교, 접근성 전체 검사, source map 기반 소스 추적은 후속 기능입니다. 수정 전후 결과는 별도 폴더에 남습니다. 각 화면의 예산은 제한되며 전체 브라우저 실행은 최대 약 60초 후 종료를 시도합니다. Ctrl+C로 취소할 수 있습니다.
