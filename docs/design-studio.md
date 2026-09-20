# 디자인 스튜디오

최신 GitHub 소스에서 사용할 수 있습니다. **npm 0.10.0에는 포함되지 않습니다.**

OSCODE 터미널에서 디자인을 찾고, 브라우저에서 조작한 뒤 프로젝트에 컴포넌트 파일을 생성합니다. 갤러리·테마·팀 라이브러리 명령은 모델 키 없이 사용할 수 있습니다.

## 시작하기

프로젝트 폴더에서 최신 OSCODE를 실행한 뒤 입력합니다.

```text
/design gallery react
```

1. 기본 브라우저에 열린 로컬 갤러리에서 컴포넌트를 검색합니다.
2. React·Vue·Angular·Svelte, Solid·Soft·Outline, 크기·색상·모서리를 선택합니다.
3. 입력·키보드·모달을 조작하고 상태별 스타일을 살펴봅니다.
4. **이 디자인 선택**을 누르면 터미널로 선택 결과가 전달됩니다.
5. 코드를 확인하고 기존 프로젝트의 컴포넌트 폴더에 생성합니다.

```text
/design code
/design apply src/components/ProfileForm.jsx
```

출력 폴더는 미리 존재해야 합니다. 컴포넌트와 CSS를 각각 새 파일로 만들며 기존 파일은 덮어쓰지 않습니다. 각 파일은 기존 쓰기 승인·체크포인트를 따릅니다. 두 번째 파일 생성이 취소되면 먼저 생성한 파일을 안내합니다.

앱의 import, 실제 데이터·서버 연결은 이어서 수행해야 합니다. 예: “방금 생성한 ProfileForm을 설정 페이지에 연결하고 기존 테스트로 검증해줘.” AI 작업에는 연결된 모델이 필요합니다.

브라우저 없이 선택할 수도 있습니다.

```text
/design list
/design select vue/settings-form
/design code
/design apply src/components/AccountSettings.vue
```

갤러리는 선택 또는 Ctrl+C로 종료하며 5분 동안 선택이 없으면 연결을 닫습니다. `/design` 명령은 현재 에이전트 탭의 선택을 유지합니다.

## 컴포넌트와 화면 조합

| ID | 제공 동작 |
| --- | --- |
| `button` | 액션 이벤트, 세 가지 스타일과 크기 |
| `form` | 이름·이메일, 브라우저 필수 입력 검증, 제출 이벤트 |
| `checkbox` | 기본 체크 상태와 설명 |
| `tabs` | 탭 전환, 방향키·Home·End, 독립된 패널 |
| `dialog` | 네이티브 모달, Esc·닫기, 포커스 복귀 |
| `tooltip` | 마우스·키보드 도움말, Esc 닫기 |
| `toast` | 상태 알림과 닫기 |
| `combobox` | 네이티브 datalist 제안, 자유 입력 허용 |
| `table` | 제목·열/행 머리글·키보드로 접근 가능한 가로 스크롤 |
| `search-results` | 예시 데이터 검색, 결과 개수, 빈 결과 |
| `settings-form` | 표시 이름·이메일 알림 설정 |
| `login-form` | 이메일·비밀번호 입력과 기본 검증 |
| `mobile-tabs` | 모바일 하단 탭바, 화면·방향키 전환 |
| `bottom-sheet` | 하단 액션 시트, Esc·닫기·포커스 복귀 |
| `mobile-form` | 이름·이메일·연락처, 자동완성과 입력 키보드 힌트 |
| `sticky-action` | 컨테이너 하단 고정 액션 |
| `mobile-list` | 카드 선택, 로딩 스켈레톤과 상태 안내 |

갤러리의 기본·포커스·비활성·로딩·오류·다크 패널은 **스타일 예시**입니다. 실제 비동기 요청이나 프레임워크 빌드를 실행하지 않으며, 상태 예시를 생성 코드에 자동으로 넣지는 않습니다. 기본 컴포넌트는 공통 HTML과 동일한 브라우저 동작을 미리 보여줍니다. 앱에서 실제 프레임워크로 렌더링한 뒤 `/inspect`, `/states run` 등으로 검증하세요.

정렬 가능한 테이블, 선택값을 제한하는 커스텀 ARIA combobox, 서버 인증·저장 로직은 포함하지 않습니다. 기존 MUI·Ant Design·Bootstrap 생성 명령도 그대로 사용할 수 있습니다. [기존 컴포넌트 가이드](components.md)

## 모바일 웹 디자인

```text
/design mobile react
```

390px 하단 탭바 미리보기로 시작합니다. `react` 대신 `vue`, `angular`, `svelte`도 사용할 수 있습니다. 모바일 5종은 기존 12종과 같은 갤러리에 있으며 프로젝트 테마와 코드 생성 흐름을 공유합니다. React Native·Flutter용 네이티브 앱 컴포넌트는 아닙니다.

1. 미리보기 너비를 360·390·430 CSS px로 바꿉니다. 좁은 브라우저에서는 미리보기 영역만 가로로 스크롤합니다.
2. **하단 여백 34px**로 안전 영역을, **키보드 영역 예시**로 화면 높이가 560px에서 320px로 줄어든 상황을 살펴봅니다.
3. 실제 탭·폼·바텀시트를 조작합니다. 가로 넘침, 44px 미만 터치 영역 수, 포커스된 입력창 가림 여부를 표시합니다.
4. **이 디자인 선택** 후 코드와 CSS를 생성합니다. 미리보기용 고정 너비·34px 여백·가상 키보드는 생성 코드에 들어가지 않습니다.

```text
/design select vue/bottom-sheet
/design code
/design apply src/components/ActionSheet.vue
```

버튼은 최소 44×48px, 폼 입력은 16px 글자 크기와 이름·이메일·연락처 자동완성 정보를 사용합니다. 생성 CSS는 `env(safe-area-inset-bottom, 0px)`를 읽습니다. 전체 화면 안전 영역을 사용하려면 앱의 viewport 설정에 `viewport-fit=cover`를 포함하고 대상 기기에서 확인하세요. [안전 영역 변수 설명](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/env)

하단 탭바와 액션은 컴포넌트의 컨테이너 안에서 `sticky`로 배치됩니다. 앱 전체 하단에 두려면 앱 레이아웃에 연결해야 합니다. 모바일 폼의 제출 버튼은 입력을 가리지 않도록 일반 문서 흐름에 있습니다. 바텀시트는 네이티브 `dialog`이며 명시적인 닫기 버튼·Esc를 지원합니다. 드래그·스와이프 닫기는 포함하지 않습니다.

목록의 생성 코드에는 스켈레톤이 포함됩니다. 실제 데이터 로딩 상태에 맞춰 컴포넌트 루트의 `aria-busy`를 전환하도록 앱에서 연결하세요. 갤러리의 로딩 예시는 이 상태를 보여주며 API를 호출하지 않습니다.

미리보기 수치는 관찰용이며 접근성 전체 통과 판정이 아닙니다. 키보드·안전 영역은 CSS 시뮬레이션입니다. 실제 모바일 브라우저의 키보드, 주소 표시줄, 확대, 화면 회전과는 다를 수 있으므로 생성 후 앱과 실기기에서도 검증하세요. 팀 컴포넌트 코드는 미리보기에서 실행하지 않습니다.

## 프레임워크 조건과 이벤트

| 프레임워크 | 기본 생성 코드 최소 버전 | 파일 | 이벤트 연결 |
| --- | --- | --- | --- |
| React | 18.0 | `.jsx` | `onAction={handler}` |
| Vue | 3.5 | `.vue` | `@action="handler"` |
| Angular | 16.0 | `.ts` | `(action)="handler($event)"`와 고유한 `[id]` |
| Svelte | 5.20 | `.svelte` | `onaction={handler}` |

안정적인 입력 ID와 서버 렌더링 경계를 위해 위 버전을 사용합니다. Angular에는 호출자가 고유하고 안정적인 `id`를 반드시 전달해야 합니다. Vue 앱을 여러 개 따로 마운트한다면 앱별 `idPrefix`를 설정하세요.

이벤트는 `{type:'primary'}`, `{type:'tab',index}`, `{type:'input',control}`, `{type:'submit',form}`입니다. `control`과 `form`은 DOM 요소이며 직렬화된 데이터가 아닙니다. 제출 이벤트에서 `new FormData(event.form)` 등으로 필요한 값을 읽고 앱의 저장 로직과 연결하세요. 기본 코드 자체는 로그인·저장 요청을 전송하거나 입력값을 기록하지 않습니다.

모바일 시트 선택은 `{type:'sheet',value:'save'|'share'}`, 카드 선택은 `{type:'select',value:'design'|'shop'|'profile'}`을 전달합니다. 공유·저장·화면 이동의 실제 처리는 앱에서 연결합니다.

컴포넌트는 네이티브 DOM이 입력 상태를 관리하는 출발점입니다. 앱의 폼 라이브러리나 controlled props가 필요하면 프로젝트 방식에 맞게 확장하세요. 선언된 프레임워크와 최소 버전만 확인하며 패키지 설치·업그레이드는 수행하지 않습니다. 복합 버전 범위·별칭은 자동 판단하지 않습니다.

## 프로젝트 디자인 토큰

```text
/design theme
/design theme set {"accent":"#0f766e","radius":"8px","spacing":"16px"}
```

처음 40개 CSS 파일의 앞부분에서 단순 `:root`·`@theme` 변수 후보를 찾습니다. 기본값 → 처음 찾은 변수 → `.oscode/design-theme.json` 순서로 적용하며 출처 파일을 표시합니다. `set`은 지정한 값만 기존 설정과 병합합니다. 갤러리 또는 `select`로 다시 선택해야 변경한 토큰이 선택 결과에 반영됩니다.

지원 역할: `accent`, `accentText`, `surface`, `background`, `text`, `muted`, `border`, `danger`, `radius`, `spacing`, `font`. 값은 단순 색상·길이·글꼴로 제한합니다. `var()`·파일 참조·원격 리소스는 해석하지 않습니다. CSS cascade·조건부 테마 전체를 분석하는 기능은 아닙니다.

생성한 토큰은 해당 컴포넌트의 속성 선택자에 적용합니다. 기존 전역 테마를 수정하지 않으며, 파일 경로와 토큰이 다른 생성물은 서로 다른 선택자를 갖습니다.

```text
/design theme export design-tokens.json
/design theme import design-tokens.json
```

[DTCG 2025.10 형식](https://www.designtokens.org/tr/2025.10/format/)의 **일부만** 지원합니다. `oscode` 그룹 아래 명시적인 `$type`·`$value`를 사용하며 색상은 sRGB 성분·alpha, 길이는 px/rem, 글꼴은 fontFamily입니다. 외부 참조·별칭·다른 토큰 타입은 미지원입니다. 내보내기는 HEX 색상과 px/rem 길이를 요구합니다. HSL·OKLCH 등 감지값이 있다면 HEX 값으로 설정한 뒤 내보내세요.

## 팀 컴포넌트 공유

```text
/design register team-button {"framework":"react","path":"src/Button.tsx","css":"src/Button.css","description":"팀 기본 버튼","usage":"label과 onClick을 연결하세요."}
/design use team-button
/design code
/design apply src/components/SharedButton.tsx
/design registry export team-components.json
```

다른 프로젝트에서:

```text
/design registry import team-components.json
/design gallery react
```

레지스트리는 원본 코드·CSS의 스냅샷이며 `.oscode/design-registry.json`에 저장합니다. 최대 24개, 항목당 코드 32,000자·CSS 16,000자, 파일 전체 512 KB까지 지원합니다. 같은 이름의 중복 등록·가져오기는 거절합니다. 원본이 바뀌어도 자동 동기화되지 않습니다.

등록한 코드와 CSS의 SHA-256 해시를 검사합니다. 해시는 내용 손상 검사용이며 작성자 신뢰를 인증하지 않습니다. React 팀 컴포넌트는 `.jsx`·`.tsx`를 보존합니다. 등록한 CSS의 정적 `import`, Angular `styleUrls`, Vue/Svelte `<style src>` 참조는 새 CSS 파일명으로 연결합니다. 그 외 패키지·이미지·상대 import는 복사하지 않으므로 확인해야 합니다. 팀 코드의 버전별 호환성은 앱에서 검증하세요.

팀 컴포넌트는 갤러리에 이름·설명만 표시하며 가져온 코드를 실행하지 않습니다. 프로젝트에 적용한 뒤 앱에서 미리보기와 검증을 진행합니다. 공유 파일에는 실제 소스가 포함됩니다.

## 승인·모델 컨텍스트

- PLAN: 목록·테마 확인·코드 조회만 허용합니다. 갤러리 실행과 파일 변경은 BUILD에서 수행합니다.
- 갤러리: 루프백 주소의 임시 서버만 사용합니다. 기존 셸/브라우저 승인 설정을 따릅니다.
- 테마·레지스트리 저장: 기존 쓰기 승인 설정을 따릅니다. 프로젝트 메타데이터로 저장하며 파일 체크포인트 대상은 아닙니다.
- 프론트엔드 에이전트: `design_catalog`로 이름·설명·토큰을 검색하고, `design_recipe`로 필요한 코드 또는 CSS만 조회합니다. `team:이름`도 조회할 수 있습니다. 긴 내용은 이어 읽습니다. 전체 라이브러리를 매 요청에 전달하지 않습니다.
- 기존 컴포넌트를 먼저 찾아 재사용하고, 새 파일이 만들어졌다는 사실만으로 앱 통합·검증이 끝났다고 보고하지 않도록 안내합니다.

## 검증

`node --test test/design-studio.test.js test/design-mobile.test.js`는 토큰 변환·승인·파일 생성·팀 공유·동시 등록·PLAN·갤러리 선택과 실제 Chromium 조작을 확인합니다. 모바일 명령에서 터치 입력·파일 생성까지 연결하고, 화면 너비·안전 영역·키보드 예시·폼 검증·시트 포커스 복귀·목록 상태도 검사합니다. 브라우저 검증에는 선택 의존성 Playwright와 Chromium이 필요합니다.

이번 변경에서는 별도 임시 환경의 React 18, Vue 3, Angular 20, Svelte 5 컴파일러로 68개 생성물을 컴파일하고, 각 프레임워크에 두 인스턴스씩 렌더링해 이벤트·키보드·폼·모달·고유 ID·360px 화면을 확인했습니다. 모든 최소 버전 조합이나 개별 사용자 앱의 호환성을 보장하는 검사는 아닙니다.
