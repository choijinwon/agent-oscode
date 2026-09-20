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
| `admin-layout` | 사이드바 접기·펼치기, 메뉴 선택 |
| `admin-dashboard` | 7일·30일 통계 카드와 목표 달성률 예시 |
| `admin-table` | 검색·상태 필터·이름 정렬·페이지 이동·여러 행 선택·상세 패널 |
| `admin-user-form` | 이름·이메일 검증, 역할 안내와 초대 요청 이벤트 |
| `admin-activity` | 활동 검색·유형 필터·빈 결과 |
| `accordion` | 내용 펼치기·접기와 Enter·Space 조작 |
| `action-menu` | 작업 선택·바깥 클릭·Esc·포커스 복귀 |
| `action-toast` | 로컬 보관·되돌리기·닫기·다시 보기 |
| `step-form` | 필수 입력·이메일 검증·이전 단계·완료 이벤트 |
| `segmented-control` | 라디오·방향키 선택과 결과 전환 |
| `reorder-list` | 위·아래 버튼·포커스 유지·순서 안내 |

갤러리의 기본·포커스·비활성·로딩·오류·다크 패널은 **스타일 예시**입니다. 실제 비동기 요청이나 프레임워크 빌드를 실행하지 않으며, 상태 예시를 생성 코드에 자동으로 넣지는 않습니다. 기본 컴포넌트는 공통 HTML과 동일한 브라우저 동작을 미리 보여줍니다. 앱에서 실제 프레임워크로 렌더링한 뒤 `/inspect`, `/states run` 등으로 검증하세요.

기본 `table`은 정적 표이며 검색·정렬은 `admin-table`을 사용합니다. 선택값을 제한하는 커스텀 ARIA combobox, 서버 인증·저장 로직은 포함하지 않습니다. 기존 MUI·Ant Design·Bootstrap 생성 명령도 그대로 사용할 수 있습니다. [기존 컴포넌트 가이드](components.md)

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

## 관리자 디자인

```text
/design admin react
```

관리자 대시보드로 시작하며 목록에 관리자 5종을 먼저 표시합니다. 검색창의 “관리자”를 지우면 전체 28종을 찾을 수 있습니다. `vue`, `angular`, `svelte`도 지원하며 키 없이 디자인을 선택하고 생성할 수 있습니다.

```text
/design select react/admin-table
/design code
/design apply src/components/MemberTable.jsx
```

출력 폴더는 미리 존재해야 합니다. 컴포넌트와 CSS를 확인한 뒤 앱에 import하고 기존 데이터·라우터에 연결하세요.

| 컴포넌트 | 실제 제공 동작 | 앱에서 연결할 부분 |
| --- | --- | --- |
| 관리자 레이아웃 | 메뉴 접기·펼치기, 선택 표시·제목 전환 | 라우터와 페이지 콘텐츠 |
| 대시보드 | 7일·30일 선택에 따른 카드·막대 값 변경 | 통계 API, 기간·목표 계산 |
| 데이터 테이블 | 로컬 예시 8명 검색·상태 필터·이름 오름/내림차순 정렬·페이지당 3행·여러 행 선택 | 실제 데이터, 서버 페이지 이동, 검토 처리 |
| 사용자 초대 폼 | 필수 이름·이메일 검증·역할 설명·제출 이벤트 | 초대 전송·서버 권한 검증 |
| 활동 로그 | 내용 검색과 유형 필터를 함께 적용, 빈 결과 표시 | 서버 활동 기록과 시간대 처리 |

테이블의 **현재 페이지 전체 선택**은 화면에 보이는 행에만 적용합니다. 페이지 이동과 정렬 후에도 선택은 유지하며, 검색·상태 필터·필터 초기화 시에는 선택을 해제합니다. **선택 항목 검토**는 선택된 모든 페이지의 ID를 이벤트로 전달하며 데이터를 변경하거나 삭제하지 않습니다. 좁은 화면에서는 표 영역 안에서 가로로 스크롤합니다.

이벤트는 기존 프레임워크별 `action` 방식으로 받습니다.

- `{type:'navigate',section:'overview'|'members'|'settings'}`: 메뉴 선택
- `{type:'period',value:'week'|'month'}`: 조회 기간 선택
- `{type:'bulk',action:'review',ids:[...]}`: 선택한 행 검토 요청
- `{type:'detail',id}`: 사용자 상세 패널 열기
- `{type:'role-preview',value:'viewer'|'editor'|'admin'}`: 역할 안내 변경
- `{type:'submit',form}`: 초대 폼 제출. `new FormData(form)`으로 `name`, `email`, `role`을 읽습니다.

통계·사용자·활동은 모두 번들에 포함된 예시 데이터입니다. 갤러리나 생성 코드가 실제 초대·저장 요청을 전송하지 않습니다. 역할 선택 UI 자체가 접근 권한을 부여하지 않으며 서버에서 권한을 검증해야 합니다. 활동 로그 예시는 서버 감사 기록 기능이 아닙니다.

관리자 동작과 CSS는 관리자 생성물에만 포함합니다. 다른 디자인을 요청할 때 불필요한 관리자 코드를 모델에 전달하지 않습니다. 긴 코드는 기존 `design_recipe` 이어 읽기로 조회합니다.

## 인터랙션 패턴

```text
/design interact react
```

인터랙션 6종을 먼저 표시합니다. 검색창의 “인터랙션”을 지우면 전체 28종을 볼 수 있습니다. `vue`, `angular`, `svelte`도 지원합니다. 선택한 동작을 조작한 뒤 **이 디자인 선택**을 누르고 코드·CSS를 생성하세요. 출력 폴더는 기존 프로젝트에 미리 만들어두어야 합니다.

```text
/design select vue/step-form
/design motion reduced
/design code
/design apply src/components/ProjectSteps.vue
```

| ID | 동작과 키보드 사용 |
| --- | --- |
| `accordion` | 네이티브 details. 제목에서 Enter·Space로 펼치거나 접고 여러 항목을 함께 열 수 있습니다. |
| `action-menu` | 버튼으로 열기, 위·아래·Home·End로 작업 이동, Tab 이동, Esc·바깥 클릭으로 닫기. 작업 선택·Esc 닫기 후 원래 버튼으로 포커스가 돌아갑니다. |
| `action-toast` | 보관하기 → 되돌리기 또는 알림 닫기. 닫아도 보관 상태를 유지하며 알림을 다시 열 수 있습니다. 자동 소멸 시간은 두지 않습니다. |
| `step-form` | 프로젝트 이름 → 이메일 → 확인의 세 단계. 공백뿐인 이름과 잘못된 이메일을 막고, 이전 단계로 돌아가도 입력을 보존합니다. Enter로 다음 단계로 이동합니다. |
| `segmented-control` | 전체·진행 중·완료를 라디오로 선택합니다. 방향키로 이동하며 선택에 따라 예시 목록과 개수가 바뀝니다. |
| `reorder-list` | 위·아래 버튼을 클릭하거나 Enter·Space로 조작합니다. 첫/마지막 경계를 막고 이동한 항목의 버튼에 포커스를 유지합니다. 변경된 순서를 안내합니다. |

드롭다운은 브라우저의 [Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API/Using)를 사용합니다. `showPopover`·`popovertarget`를 지원하는 브라우저가 필요합니다. 역할은 일반 작업 버튼 그룹이며 Tab과 방향키를 지원합니다. 지원하지 않는 오래된 브라우저에는 별도 폴리필이 필요합니다. 순서 변경은 버튼 방식이며 드래그·스와이프 정렬은 포함하지 않습니다.

### 앱 이벤트 연결

기존 프레임워크별 `action` 핸들러에서 다음 이벤트를 받습니다.

- `{type:'accordion',open,label}`: 항목 열림 상태
- `{type:'menu-action',value:'duplicate'|'share'|'archive'}`: 선택한 작업
- `{type:'archive'|'undo'|'toast-dismiss',archived}`: 보관 예시와 알림 상태
- `{type:'step',index}`: 0부터 시작하는 단계 번호
- `{type:'step-complete',values:{project,email}}`: 마지막 단계에서 검증한 입력. 일반 `submit` 이벤트와 중복 발생하지 않습니다.
- `{type:'segment',value:'all'|'progress'|'done'}`: 보기 선택
- `{type:'reorder',ids:[...]}`: 변경된 항목 ID 순서

입력·목록·보관은 브라우저 안의 예시 상태입니다. 서버에 전송하거나 새로고침 후 보존하지 않습니다. 완료 이벤트는 저장 성공을 의미하지 않으며 앱에서 API·로딩·오류·중복 제출 방지를 연결하세요. 민감한 입력을 기록하지 않도록 앱의 이벤트 처리도 확인하세요. 애니메이션은 내용 표시·보관·단계 전환·순서 변경에 적용하며 OS 움직임 줄이기를 우선합니다.

패턴 동작과 CSS는 인터랙션 컴포넌트를 생성할 때만 포함합니다. 기본 버튼이나 모바일·관리자 코드 요청에 새 패턴 코드를 추가하지 않습니다.

## 인터랙션과 움직임

갤러리 상단의 **인터랙션**에서 기본·은은하게·끄기를 선택합니다. 기본 디자인의 선택 결과와 생성 코드에 저장되며 팀 컴포넌트에는 적용하지 않습니다. 터미널에서도 디자인을 선택한 뒤 바꿀 수 있습니다.

```text
/design select react/admin-table
/design motion reduced
/design code
/design apply src/components/MemberTable.jsx
```

| 설정 | 효과 |
| --- | --- |
| `auto` 기본 | 버튼 호버·눌림 피드백, 관리자·인터랙션 내용 갱신 시 짧은 이동·페이드 |
| `reduced` 은은하게 | 이동·확대 없이 색상과 짧은 페이드 |
| `off` 끄기 | 애니메이션 생략, 선택 강조·포커스 표시·실제 동작 유지 |

운영체제의 **움직임 줄이기**(`prefers-reduced-motion: reduce`)를 우선해 애니메이션을 생략합니다. 효과는 입력이나 데이터 갱신을 지연하지 않으며 같은 요소에 새 효과가 시작되면 이전 OSCODE 효과를 취소합니다. 별도 애니메이션 라이브러리를 설치하지 않습니다.

관리자 레이아웃의 메뉴·내용, 통계 기간 변경, 목록 검색·정렬·페이지 이동, 역할 안내와 폼 피드백에 적용됩니다. 선택한 행은 배경색으로 구분하며 필터 변경으로 선택이 해제되면 강조도 해제합니다.

`admin-table`에서 **사용자 이름**을 누르면 오른쪽 상세 패널에 이름·이메일·팀·상태를 표시합니다. Enter·Space로 열고 **닫기** 또는 Esc로 닫을 수 있습니다. 네이티브 모달이 열린 동안 배경 컨트롤은 비활성화되며 닫으면 원래 버튼으로 포커스가 돌아옵니다. 검색·페이지·선택 상태는 유지합니다. 정보는 예시 행에서 읽으며 서버 정보를 조회하지 않습니다.

AI의 `design_recipe` 도구도 기본 디자인에 `motion: "auto" | "reduced" | "off"`를 지정할 수 있습니다. 생성 후 앱의 기존 테마·이벤트 처리와 함께 검증하세요.

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

`node --test test/design-studio.test.js test/design-mobile.test.js test/design-admin.test.js test/design-interactions.test.js`는 토큰 변환·승인·파일 생성·팀 공유·동시 등록·PLAN·갤러리 선택과 실제 Chromium 조작을 확인합니다. 모바일 명령에서 터치 입력·파일 생성까지 연결하고, 화면 너비·안전 영역·키보드 예시·폼 검증·시트 포커스 복귀·목록 상태도 검사합니다. 관리자 테스트는 정렬·필터·페이지 간 선택·선택 초기화·빈 결과·폼 검증·기간 전환·좁은 화면을 확인합니다. 인터랙션 테스트는 강도 저장·OS 움직임 줄이기·상세 패널·포커스 복귀·선택 강조를 확인합니다. 브라우저 검증에는 선택 의존성 Playwright와 Chromium이 필요합니다.

이번 변경에서는 별도 임시 환경의 React 18, Vue 3, Angular 20, Svelte 5 컴파일러로 112개 생성물을 컴파일하고, 각 프레임워크에 두 인스턴스씩 렌더링해 이벤트·키보드·폼·모달·고유 ID·360px 화면을 확인했습니다. 모든 최소 버전 조합이나 개별 사용자 앱의 호환성을 보장하는 검사는 아닙니다.
