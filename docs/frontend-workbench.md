# 화면에서 시작하는 프론트엔드 작업 (최신 소스)

이 기능은 npm 0.10.0 이후 GitHub 소스에 추가됐습니다. Node.js 22+, 선택 의존성 Playwright와 Chromium이 필요합니다. 개발 서버를 먼저 실행하고, 해당 프로젝트 폴더에서 OSCODE를 시작하세요. `/demo`가 아닌 일반 실행에서 키 없이 진단할 수 있습니다. AI 수정만 모델 연결이 필요합니다.

```sh
npm install
npx playwright install chromium
node bin/oscode.js --agent frontend
```

모든 브라우저 동작은 BUILD와 기존 실행 승인 설정을 따릅니다. 페이지 스크립트·실제 네트워크 요청이 실행되며 격리된 브라우저를 사용합니다. 평소 브라우저의 로그인 쿠키를 가져오지 않습니다. 결과는 `.oscode/`에 보관하며 Git에 포함하지 않습니다.

## 1. 화면 요소 선택 → 소스 후보 → 수정 → 재진단

```text
/inspect http://localhost:3000
/inspect http://localhost:3000 #checkout
/inspect fix 모바일에서도 버튼과 텍스트가 잘리지 않게 수정해줘
```

첫 명령은 별도 브라우저에 선택 안내를 표시합니다. 마우스를 움직이면 대상이 강조되고, 클릭하면 해당 요소를 선택합니다. 버튼 안의 아이콘은 가장 가까운 버튼으로 선택합니다. 안내의 취소 버튼 또는 창 닫기로 종료할 수 있고 최대 대기는 3분입니다. iframe과 Shadow DOM 내부 선택은 지원하지 않습니다. 민감한 실제 서비스 대신 테스트 화면을 사용하세요. 이미 앱에 등록된 최상위 이벤트 핸들러까지 차단하는 샌드박스는 아닙니다.

선택자가 있으면 창 없이 검사합니다. CSS 선택자는 URL 뒤 공백 다음부터 전부 사용하므로 `#card > button`도 사용할 수 있습니다. UI는 기본 desktop이며 모델의 `ui_inspect` 도구에서 mobile/tablet/desktop을 지정할 수 있습니다.

관찰 자료에는 선택자의 크기, 계산 스타일, 상위 4개 요소의 레이아웃, 대응 CSS 선언, 소스 후보, 요소 PNG가 포함됩니다. 소스 후보는 id·data-testid·클래스의 문자열 일치 결과입니다. 최대 250개 파일·파일당 32,000자, 상위 8개 후보입니다. 정확한 컴포넌트 소유 관계나 source map 추적을 보장하지 않습니다.

`/inspect fix`는 **현재 세션에서 마지막으로 선택한 요소**를 대상으로 사용자 요청과 제한된 근거만 모델에 전달합니다. 기존 파일 읽기·변경 승인·토큰 예산을 따릅니다. 모델 작업이 완료되면 원래 URL·선택자·화면 크기로 다시 검사해 전후 JSON을 저장합니다. 작업 취소나 실패 시 자동 재시도하지 않습니다. 선택자가 사라지면 재검증 미완료입니다. 계산 스타일 변화는 요구사항 충족을 뜻하지 않으므로 추가 동작 시나리오로 확인하세요.

## 2. CSS 원인 조사

```text
/css http://localhost:3000 #card
```

Chromium DevTools Protocol로 실제 일치하는 스타일 선언·선언 위치를 읽고 `getComputedStyle`로 최종 계산값을 확인합니다. 고정 너비·화면 넘침·nowrap·flex 최소 너비 등 관찰 가능한 원인 후보를 표시합니다. 부모의 flex/grid·overflow·너비도 함께 기록합니다. 일치한 선언을 모두 승리한 CSS 규칙이라고 표시하지 않으며, 원본 소스 위치는 빌드된 스타일 위치일 수 있습니다. `/css`로 선택한 요소에도 `/inspect fix`를 사용할 수 있습니다.

## 3. 까다로운 상황 검사

```text
/stress http://localhost:3000
/stress http://localhost:3000 examples/frontend-lab/stress.json
```

설정을 생략하면 320px 너비, 다크 모드, 글자 2배를 각각 검사합니다. 명시적인 행동 확인 조건이 없으므로 `observed-only` 또는 발견 항목으로 표시하며 동작 통과로 표시하지 않습니다.

설정의 `cases`에는 최대 6개 고유 이름을 지정합니다. 각 테스트는 독립 컨텍스트를 사용하고 각각 실행 승인을 받습니다.

- `viewport`: mobile/tablet/desktop. 기본 mobile.
- `probe.width`: 280–1920px.
- `probe.colorScheme`: light/dark.
- `probe.locale`: 예: ko-KR.
- `probe.textScale`: 1–2. 현재 DOM의 글자를 임시로 키웁니다. 브라우저 줌과 동일하지 않습니다.
- `probe.text`: 최대 5개의 `{selector,value}`. 텍스트만 가진 단일 말단 요소에 최대 2,000자 문자열을 주입합니다. 앱 상태·자식 DOM은 변경하지 않습니다. 재렌더링이 테스트 문자열을 제거하면 미완료입니다.
- `probe.settleMs`: 시나리오 뒤 관찰 전 0–3,000ms 대기.
- `scenario`: 기존 steps/routes 형식. API 응답·지연을 명시합니다.
- `a11y`: 선택적 접근성 검사.

시나리오에 `clickMany`(value 2–5회)와 `wait`(value 0–3,000ms)를 추가했습니다. clickMany는 Playwright의 실제 클릭을 연속 실행하며 버튼이 비활성화되면 기다립니다. 모든 조합의 동시성을 보장하지 않습니다. 테스트 응답의 지연을 서로 다르게 지정하면 응답 순서 역전을 재현할 수 있습니다. 늦은 응답까지 기다린 **뒤** 최종 결과를 검사하세요.

```json
{"steps":[
  {"action":"clickMany","selector":"#search","value":2},
  {"action":"wait","value":1600},
  {"action":"text","selector":"#result","value":"최신 결과"}
]}
```

원래 API 모의 응답 제한(동일 origin fetch/XHR, 5개 경로, 경로당 5개 응답·3초 지연)이 적용됩니다. 장시간·무작위 부하 테스트가 아닙니다. 각 테스트는 최대 60초입니다. `passed`는 지정한 확인 조건과 활성화한 진단에만 해당합니다.

## 4. 기존 컴포넌트 재사용

```text
/reuse button
/reuse 검색 필터
```

로컬 파일명·내용으로 후보를 찾고 React/Vue/Angular/Svelte 구분, export, props/input/output 관련 줄, import를 요약합니다. 최대 200파일·24,000자이며 모델에는 상위 8개만 제공합니다. 한국어 검색은 프로젝트에 실제로 있는 표현을 찾으므로 프로젝트가 영어 식별자를 쓰면 Button·Search 같은 이름으로 검색하세요. 의미 기반 검색·타입 호환 판정은 아닙니다.

프론트엔드 에이전트에 `frontend_reuse` 도구와 재사용 지침을 제공합니다. PLAN에서도 읽기 전용으로 사용할 수 있습니다. 후보를 찾은 후 실제 소스·사용처·Provider를 읽고 변경합니다. 새로운 라이브러리를 자동 설치하지 않습니다.

## 5. 재현 가능한 버그 묶음

```text
/bug ui-Ab12Cd
/replay http://localhost:3000 shared-bug/replay.json
```

스트레스 결과나 `ui check`가 출력한 `.oscode/ui-실행ID`의 마지막 폴더명을 `/bug`에 지정합니다. 쓰기 승인 후 `.oscode/bug-.../`에 보고서, 실행 조건, PNG, 시나리오 trace, SHA-256 파일 목록과 재현 안내를 복사합니다. 최대 40 MiB이며 링크 파일은 거부합니다. 외부 업로드·이슈 등록은 하지 않습니다.

묶음에는 화면·테스트 입력·콘솔 로그·모의 API 데이터가 포함될 수 있습니다. 내용 확인 후 폴더를 전달하세요. 앱 소스·쿠키·인증 정보·서버 데이터는 따로 수집하지 않습니다. 실행 URL의 쿼리/해시는 replay 파일에서 제거하므로 필요한 테스트 URL은 `/replay`에서 다시 지정하세요. 이미지 기준은 공유에 포함하지 않으며 별도로 승인해야 합니다.

다른 개발자는 같은 앱 버전과 데이터를 준비하고 묶음을 프로젝트 내부 폴더에 복사한 뒤 `/replay URL 경로/replay.json`으로 실행합니다. 자신의 생성 묶음은 `/replay URL .oscode/bug-ID/replay.json`도 가능합니다. 실제 클릭·요청 승인이 적용됩니다. 출처를 모르는 묶음의 시나리오는 먼저 확인하세요. 실행 조건을 보존하는 기능이며 다른 OS·브라우저·백엔드에서도 동일한 결과를 보증하지 않습니다.

## 6. SSR·하이드레이션 진단

```text
/hydrate http://localhost:3000
/hydrate http://localhost:3000 #app
```

JavaScript 비활성 페이지, 활성 페이지, 새로고침의 세 로드를 비교합니다. React/Vue/Angular/Svelte의 알려진 하이드레이션 콘솔 신호와 일반 오류를 수집하고 DOM 텍스트·태그 변화, HTTP 상태를 기록합니다. Date/Math.random/브라우저 API를 사용하는 소스 줄도 조사 후보로 제공합니다.

서로 다른 응답을 받은 독립 로드의 비교입니다. 같은 HTML 응답의 하이드레이션 직전/직후 스냅샷이 아니므로 동적 데이터·클라이언트 전용 렌더링은 정상적인 차이를 만들 수 있습니다. `no-hydration-signal`은 수집 구간에 알려진 신호가 없었다는 뜻입니다. 최초 load 후와 reload 후 각각 500ms 관찰하므로 지연된 문제는 별도 시나리오로 확인하세요. 각 프레임워크의 실제 프로젝트별 정확도는 추가 검증이 필요합니다.

## 직접 실행하는 예제

```sh
node examples/frontend-lab/server.js
```

OSCODE 프로젝트에서 대화창에 다음을 입력합니다.

```text
/inspect http://127.0.0.1:4196
/css http://127.0.0.1:4196 #title
/reuse button
/stress http://127.0.0.1:4196 examples/frontend-lab/stress.json
/hydrate http://127.0.0.1:4196/?hydration
```

예제는 의도적인 긴 제목 잘림과 오래된 응답 덮어쓰기 버그, 명시적으로 발생시킨 하이드레이션 메시지를 포함한 테스트 앱입니다. 실제 프레임워크의 성공 사례나 실사용 성능 증명이 아닙니다.
