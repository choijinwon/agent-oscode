# 프론트엔드 검증 워크플로

모든 단독 진단은 모델 API를 호출하지 않습니다. 선택 의존성은 `npm install`로 설치하고 브라우저는 `npx playwright install chromium`으로 준비합니다. 모델이 도구를 사용할 때는 기존 입력/출력·턴 예산을 따릅니다.

## 동작 시나리오와 접근성

```sh
oscode ui check http://localhost:3000 --scenario examples/ui-scenario.json --viewport mobile --a11y
```

시나리오 파일은 `{ "steps": [...] }` 형태로 1–20단계를 받습니다. `click`, `fill`, `press`, `visible`, `text` 액션과 CSS/Playwright `selector`를 사용합니다. fill/text는 `value`, press는 `key`가 필요합니다. 파일 내용은 실행 전 검증하며 임의 JavaScript 액션은 제공하지 않습니다. `text`는 보이는 요소에 지정 문자열이 나타날 때까지 기다립니다.

첫 단계 실패 시 후속 동작을 중단하고 결과·스크린샷·trace.zip을 `.oscode/ui-*/`에 저장합니다. trace는 `npx playwright show-trace PATH`로 열 수 있습니다. **페이지 클릭/입력은 실제 서버 요청을 발생시킬 수 있습니다.** 테스트용 앱·계정을 사용하세요. 보고서의 단계 요약에는 입력값을 넣지 않지만 trace/스크린샷에는 입력값과 페이지 데이터가 포함될 수 있습니다. 조회 결과 전체를 모델에 자동 전송하지 않습니다.

`--a11y`는 axe-core의 WCAG 2 A/AA 및 2.1 AA 자동 규칙을 실행합니다. 위반 규칙·대상 선택자·수동 확인이 필요한 규칙 수를 제공합니다. 접근성 전체 준수 또는 키보드 사용성을 보증하지 않습니다. 옵션을 빼면 접근성 검사 비용이 들지 않습니다.

## 화면 비교와 별도 기준 승인

1. `ui check` 실행 후 report.json이 가리키는 PNG를 검토합니다.
2. 결과 폴더의 이름(예: `ui-Ab12Cd`)을 지정해 기준으로 승인합니다.
3. 같은 URL·시나리오·브라우저 버전·플랫폼·화면 크기로 비교합니다.

```sh
oscode --approve-baseline ui-Ab12Cd --baseline login-v1
oscode ui check http://localhost:3000 --scenario examples/ui-scenario.json --viewport mobile --baseline login-v1
```

기준 승인은 명시적인 CLI 명령으로만 제공합니다. 에이전트 도구는 기준을 자동 생성/갱신하지 않습니다. 기존 이름을 덮어쓰지 않으므로 새 기준에는 새 이름을 쓰세요. 실패한 시나리오와 불완전한 결과는 승인할 수 없습니다. 접근성·콘솔 문제 등이 있어도 시각적 기준을 승인할 수 있으며, 승인 자체가 품질 통과를 의미하지 않습니다.

pixelmatch 색 차이 임계값 0.1로 비교하며 차이가 있으면 변경 픽셀 수·비율과 diff PNG를 남깁니다. 애니메이션은 캡처 중 비활성화하지만 시간·서버 데이터·폰트 로드 차이는 여전히 변경으로 검출될 수 있습니다. 의도된 변경인지 사람이 판단해야 합니다. 현재는 현재 뷰포트 단위 비교이며 마스킹·영역별 허용치는 제공하지 않습니다.

종료 코드: 0 관측된 문제 없음, 2 시나리오/이미지/접근성 등 진단 항목 발견, 1 실행 실패·조건 불일치·불완전 검사. 단계별 최대 대기는 5초이며 전체 브라우저 실행은 기존 60초 제한을 공유합니다.

## Tailwind 디자인 토큰

```sh
oscode --tokens
```

Tailwind 의존성 선언, CSS `@theme` 및 CSS 변수, 임의 값 유틸리티 후보를 분석합니다. 예를 들어 `bg-[#123456]`과 `--color-brand: #123456`을 발견하면 기존 토큰 후보를 표시합니다. 의미·접근성·CSS cascade까지 같다는 뜻이 아니므로 자동 교체하지 않습니다. v3 JavaScript 설정은 실행하지 않고 설정 경로를 안내합니다. 동적 클래스/플러그인 해석은 지원하지 않습니다. 최대 100파일·파일당 32,000자입니다.

## 변경 영향과 테스트 후보

```sh
oscode --impact src/components/Button.tsx
```

정식 TypeScript AST로 import, re-export, 문자열 dynamic import/require를 읽고 역방향 의존성을 추적합니다. 루트 tsconfig.json의 paths/baseUrl을 지원합니다. 최대 300파일/3,000간선이며 제한·건너뛴 파일은 partial로 표시합니다. 내부 파서는 TypeScript 5.9.3으로 고정되어 있고 새로운 문법은 건너뛸 수 있습니다. tsconfig extends, Vue/Svelte 템플릿, CSS 의존성, 암묵적 라우트는 분석하지 않으므로 결과는 테스트 선택 후보입니다.

## Storybook 상태와 검증 스타터

```sh
oscode --story src/Button.tsx --states examples/story-states.json
oscode --story src/Button.tsx --states examples/story-states.json --story-role button --story-name Save --output src/Button.stories.jsx --yes
```

React 기본 export 컴포넌트의 옆에 CSF `.stories.jsx`를 생성합니다. 기존 파일은 덮어쓰지 않습니다. `--states`는 예시처럼 사용자 지정 스토리 이름과 JSON args를 받으며 실제 컴포넌트 props에 맞춰 수정하세요. 단독 조회는 생성하지 않고, `--output ... --yes`로 생성합니다.

`--story-role`/`--story-name`은 실제 DOM에 해당 요소가 보이는지 확인하는 play 가시성 검증을 추가합니다. 프로젝트에 `storybook >=9` 또는 `@storybook/test` 선언이 있어야 합니다. role을 생략하면 렌더/상태 스타터만 만듭니다. 콜백·복잡한 클릭 동작·required props는 프로젝트에 맞춰 연결해야 합니다. 생성은 검증 실행이 아니며 기존 Storybook 테스트 스크립트로 실행하세요.

## 에이전트 및 PLAN

`--agent frontend`에서 `tailwind_tokens`, `frontend_impact`, `storybook_recipe`를 사용할 수 있고 세 도구는 PLAN에서도 읽기 전용으로 동작합니다. `ui_check`의 scenario/a11y/baseline 옵션은 BUILD 및 기존 shell 승인 정책을 따릅니다. 기준 승인·스토리 파일 생성은 PLAN이나 쓰기 금지 상태에서 차단합니다. 모델은 검사 요약과 관련 코드만 읽고 실제 실행 결과와 아직 실행하지 않은 검증을 구분하도록 안내받습니다.

## 실제 UI 상태 검증

대화창에서 실행합니다(API 키 불필요, BUILD 전용, 기존 실행 승인 적용).

```text
/states run http://localhost:3000 examples/ui-states.json
```

실행 중인 개발 서버와 프로젝트 안의 시나리오 JSON을 지정합니다. 파일 경로의 공백은 그대로 사용할 수 있습니다. 기본으로 모바일·태블릿·데스크톱에서 각각 새 브라우저 컨텍스트로 실행합니다. 특정 화면 크기만 검사하려면 기존 CLI를 사용하세요.

```sh
oscode ui check http://localhost:3000 --scenario examples/ui-states.json --viewport mobile
```

`examples/ui-states.json`은 검색 화면의 **수정해서 쓰는 예시**입니다. `data-testid` 선택자를 자신의 화면에 맞추고, 검색 결과가 비도록 테스트 데이터를 준비하세요. 로딩 확인에는 충분히 느린 테스트 응답이 필요합니다. 오류 시나리오는 실패 응답을 제공하는 테스트 환경에서 재시도 동작과 오류 안내를 지정하세요. 이 기능은 서버 응답을 자동으로 조작하거나 모든 상태를 자동 발견하지 않습니다. 로그인된 개인 브라우저 쿠키도 가져오지 않습니다.

| action | 확인/동작 | 추가 필드 |
| --- | --- | --- |
| click / fill / press | 클릭·입력·키 입력 | fill: 문자열 value, press: key |
| visible / hidden | 요소 표시 / 숨김 또는 DOM 제거 | 없음 |
| disabled / enabled | 화면에 보이는 단일 요소의 비활성 / 활성 | 없음 |
| text | 표시된 요소에 문자열 포함 | 문자열 value |
| count | 선택자에 해당하는 DOM 요소 개수 | 정수 value (0–5000) |

단계는 최대 20개이며 확인 조건은 최대 5초까지 기다립니다. 첫 실패에서 중단하고 후속 단계는 미실행으로 표시합니다. 클릭만 성공했거나 확인 조건이 없는 실행을 상태 검증 통과로 표시하지 않습니다. `hidden`은 요소가 처음부터 없어도 성공하므로 전환 검증은 먼저 `visible`을 사용하세요. `count`는 숨겨진 요소도 포함합니다. `disabled`는 브라우저의 비활성 의미를 검사하므로 단순 CSS 스타일을 검증하지 않습니다.

`.oscode/ui-*/report.json`, 화면 PNG, 뷰포트별 trace ZIP에 실제 결과를 저장합니다. 시나리오 실패 시점도 캡처합니다. 실행 기록은 `npx playwright show-trace 경로/desktop-trace.zip`으로 확인할 수 있습니다. 기록과 화면에는 입력한 테스트 데이터가 담길 수 있습니다. 실제 클릭이 실행되므로 테스트 계정·테스트 서버를 사용하세요. 결과는 지정한 조건에 한정되며 전체 서비스 정상 동작을 보장하지 않습니다. 전체 실행 제한은 60초입니다.
