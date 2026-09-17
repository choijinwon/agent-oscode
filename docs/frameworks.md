# React · Vue · Angular · Svelte

OSCODE의 주요 대상 프레임워크는 네 가지입니다. `--inspect-frontend`는 앱 package.json의 React, Vue, @angular/core, Svelte 선언을 확인하고 버전과 프레임워크별 작업 지침을 반환합니다. 혼합 저장소에서는 `--cwd apps/web`처럼 앱 디렉터리를 지정하세요. 의존성 선언은 실제 설치나 빌드 성공을 뜻하지 않습니다.

## 네이티브 컴포넌트

각 프레임워크에 button, card, alert, pagination, dropdown 스타터를 제공합니다. 기존 MUI/Ant Design/Bootstrap 15개에 네이티브 20개를 추가했습니다.

```sh
oscode --component react/button
oscode --component vue/button --output ActionButton.vue --yes
oscode --component angular/button --output action-button.component.ts --yes
oscode --component svelte/button --output ActionButton.svelte --yes
```

- React: JSX, props·콜백·children. React 17 이상 기준.
- Vue: Vue 3.2 이상 `<script setup>`, props·emits·slot.
- Angular: Angular 14 이상 standalone 컴포넌트, Input/Output·템플릿. 기존 NgModule/standalone 설정을 확인한 뒤 import하세요.
- Svelte: Svelte 5 `$props`, 이벤트 콜백·snippet. Svelte 4 이하에는 적용하지 않습니다.

스타터는 스타일을 강제하지 않습니다. 프로젝트 CSS/Tailwind/디자인 토큰을 재사용하고 실제 화면에 import한 뒤 이벤트와 데이터를 연결하세요. 페이지네이션은 부모가 page/count를 검증하고 갱신해야 합니다. dropdown은 HTML details/summary 기반 **disclosure**이며 키보드 화살표 이동을 구현한 ARIA menu가 아닙니다. 프로젝트에 적절한 메뉴 컴포넌트가 있다면 우선 재사용합니다.

조회는 API 없이 실행됩니다. CLI 파일 생성은 감지된 프레임워크가 다르거나 단순 버전 선언이 최소 지원 버전보다 낮으면 차단합니다. 버전 범위/별칭/워크스페이스 표기가 복잡하면 확인이 필요하며 완전한 semver 해석은 아닙니다. 프레임워크 선언이 없는 경우는 호환성을 확인한 것이 아니므로 사용자가 확인해야 합니다. 에이전트에도 호환성 결과를 확인하도록 지침을 전달합니다.

## 지원 범위

| 기능 | React | Vue | Angular | Svelte |
|---|---|---|---|---|
| 의존성 감지·작업 지침 | 지원 | 지원 | 지원 | 지원 |
| 네이티브 컴포넌트 스타터 | JSX | SFC | standalone TS | Svelte 5 |
| 브라우저·시나리오·접근성·이미지 비교 | 지원 | 지원 | 지원 | 지원 |
| 통합 verify | 기존 스크립트 | 기존 스크립트 | 기존 스크립트 | 기존 스크립트 |
| AST import 영향 분석 | JS/TS | SFC 내부 제외 | TS만, 템플릿 제외 | SFC 내부 제외 |
| Storybook 자동 스타터 | React 기본 export | 후속 지원 | 후속 지원 | 후속 지원 |

네 프레임워크의 모든 기능이 동일한 수준으로 지원되는 것은 아닙니다. 생성 코드의 구문/템플릿 검증을 수행했으며 프로젝트별 런타임 동작과 테마 통합은 해당 앱의 테스트와 브라우저 검사로 확인해야 합니다. OSCODE 자체에 네 프레임워크를 런타임 의존성으로 설치하지 않습니다.
