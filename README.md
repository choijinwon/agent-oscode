# oscode — Frontend AI Coding Agent CLI

[![CI](https://github.com/choijinwon/agent-oscode/actions/workflows/ci.yml/badge.svg)](https://github.com/choijinwon/agent-oscode/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-43853d.svg)](https://nodejs.org/)

**oscode is an open-source AI coding CLI for frontend developers working with React, Vue, Angular, and Svelte.** It combines framework-aware project analysis and UI component generation with accessibility checks, responsive browser diagnostics, and visual comparisons. Connect Claude or compatible LLM APIs, review work in plan mode, and manage token budgets, usage, and file checkpoints from your terminal.

**React·Vue·Angular·Svelte 프론트엔드 개발자를 위한 오픈소스 AI 코딩 CLI.**

프론트엔드 개발에 필요한 에이전트를 만들기 위해 시작한 OSCODE는 프로젝트 구조 분석부터 UI 컴포넌트 생성, 접근성·반응형 검사까지 터미널에서 이어갈 수 있도록 돕습니다. 플랜 모드로 변경 계획을 검토하고, 토큰 예산과 사용량을 관리하며 개발할 수 있습니다.

[Website / 소개 홈페이지](https://agent-oscode.netlify.app) · [English guide](docs/README.en.md) · [설정 가이드](docs/configuration.md) · [Architecture](docs/architecture.md) · [Issues](https://github.com/choijinwon/agent-oscode/issues)

```sh
git clone https://github.com/choijinwon/agent-oscode.git
cd agent-oscode
node bin/oscode.js --demo
```

The demo reads local project files without calling a model or requiring an API key. Live coding requires your own model credentials. This project is not affiliated with OpenCode, Pi, or Anthropic.


토큰 예산을 관리하는 터미널 코딩 에이전트. 프로젝트에서 대화하며 파일을 탐색하고 수정하고 명령을 실행한다. Node.js 22 이상에서 동작한다. 기본 에이전트는 외부 패키지 없이 사용할 수 있고 브라우저 진단은 선택 의존성 Playwright와 Chromium을 사용한다.

OpenCode의 여러 모델 연결 방식, Pi의 작고 분리된 실행 코어, Claude 계열 도구의 탐색·편집·검증 흐름을 참고한 **독립 구현**이다. 원본 프로젝트 소스나 Claude Code를 합친 제품은 아니며, 현재 연결은 Anthropic Messages API와 Chat Completions 호환 API다.

## 화면 기반 프론트엔드 작업 (최신 GitHub 소스)

`/inspect URL`로 화면 요소를 선택하고 `/inspect fix 요청`으로 수정한 뒤 같은 선택자를 재진단합니다. `/css`는 계산 스타일·부모 레이아웃·소스 후보, `/reuse`는 기존 컴포넌트, `/stress`는 긴 글·좁은 화면·응답 순서 등 지정 조건, `/hydrate`는 SSR·하이드레이션 신호를 조사합니다. `/bug`로 화면·시나리오를 로컬 묶음으로 저장하고 `/replay`로 다시 실행합니다.

[명령·예제·검증 범위](docs/frontend-workbench.md). 소스 후보는 소유 관계의 확정이 아니며, 모든 진단은 관찰 범위를 표시합니다. AI 수정 외 진단은 모델 키 없이 실행합니다. **npm 0.10.0에는 아직 포함되지 않습니다.**

## 디자인 스튜디오 (최신 GitHub 소스)

`/design gallery react`로 로컬 브라우저에서 컴포넌트를 검색하고 색상·크기·스타일·상태별 예시를 살펴봅니다. 폼·탭·모달·툴팁·테이블과 모바일·관리자 디자인 등 30종을 React·Vue·Angular·Svelte 코드로 생성하며, 프로젝트 토큰과 팀 컴포넌트 공유 파일을 지원합니다.

`/design mobile react`는 모바일 웹 디자인으로 시작합니다. 하단 탭바·바텀시트·입력 폼·하단 액션·카드 목록을 제공하며 360·390·430px 미리보기에서 터치 영역과 가로 넘침, 입력창 가림을 관찰합니다. 키보드·안전 영역은 시뮬레이션이며 실제 기기 검증은 별도로 필요합니다. [모바일 가이드](docs/design-studio.md#모바일-웹-디자인).

`/design admin react`는 관리자 레이아웃·대시보드·데이터 테이블·사용자 초대 폼·활동 로그를 제공합니다. 검색·필터·정렬·페이지 이동·여러 행 선택을 브라우저에서 조작하고 코드로 생성합니다. 데이터는 로컬 예시이며 실제 API·라우터·서버 권한 검증은 앱에서 연결합니다. [관리자 가이드](docs/design-studio.md#관리자-디자인). 갤러리에서 인터랙션을 기본·은은하게·끄기로 선택하거나 `/design motion reduced`로 지정할 수 있습니다. 사용자 이름을 누르면 상세 패널이 열리며 OS 움직임 줄이기를 반영합니다. [인터랙션 가이드](docs/design-studio.md#인터랙션과-움직임).

`/design interact react`에서 아코디언·드롭다운 액션·되돌리기 알림·단계별 입력 폼·구간 선택·순서 변경 목록을 조작할 수 있습니다. 키보드와 360px 미리보기를 지원하며 실제 데이터 저장은 앱의 이벤트 처리에 연결합니다. [인터랙션 패턴 가이드](docs/design-studio.md#인터랙션-패턴).

`/design erp react`는 회계 전표 조회 테이블과 편집형 그리드를 제공합니다. 보기 저장·열 표시·행 간격·CSV, 20단계 되돌리기/다시 실행·오류 이동, 회사·통화별 합계·엑셀 셀 붙여넣기·차대변 검증을 지원합니다. SAP 서버 연결·실제 전기는 앱에서 구현합니다. [ERP 가이드](docs/design-studio.md#회계erp-테이블과-그리드).

`/design theme component react src/components/DesignTheme.jsx`로 공통 스타일 컴포넌트를 생성합니다. 같은 DesignTheme을 페이지마다 재사용하고 `tokens`로 필요한 색상·모서리만 바꿀 수 있습니다. Vue·Angular·Svelte도 지원합니다. [공통 스타일 가이드](docs/design-studio.md#공통-스타일-컴포넌트와-페이지별-재사용).

`/design code`로 확인한 뒤 `/design apply src/components/Profile.jsx`로 코드·CSS를 생성합니다. 앱 import와 데이터 연결은 이어서 수행합니다. 갤러리는 공통 HTML 미리보기이며 팀 코드를 실행하지 않습니다. [사용법·호환 버전·검증 범위](docs/design-studio.md). **npm 0.10.0에는 아직 포함되지 않습니다.**

## 프론트엔드 토큰 절약과 A/B 비교

`--agent frontend`는 컴포넌트와 직접 연결된 코드부터 읽도록 안내하고, 긴 셸 결과를 요약합니다. `--context-mode standard`로 기존 동작을 사용할 수 있습니다.

```sh
node bin/oscode.js --frontend-context src/components/Card.vue
node bin/oscode.js --ab-context src/components/Card.vue --prompt '개선 계획'
```

기본 A/B는 API 없이 입력 추정치를 비교합니다. `--ab-live --model YOUR_MODEL_ID`를 추가하면 같은 스냅샷을 동일 모델에 두 번 보내 사용량·응답 시간을 기록합니다. 코드 수정·테스트 성공률은 평가하지 않습니다. [범위, 예산과 결과 해석](docs/frontend-token-ab.md)

## 긴 분석 이어가기

분석 체크포인트는 읽은 코드의 인용문, 해석, 다음 질문을 세션에 저장합니다. 대화를 압축해도 최근 4개 메모가 남고, 파일이 바뀌면 이전 결론을 무효화합니다. 같은 코드가 대화에 남아 있으면 중복 읽기 출력도 줄입니다.

```sh
node bin/oscode.js --analysis-notes
node bin/oscode.js --resume latest --agent frontend --plan --prompt '분석 체크포인트를 확인하고 이어서 진행해줘'
```

[분석 체크포인트 사용법과 한계](docs/analysis-checkpoints.md)

## 여러 에이전트 탭

전체 화면에서 상단 또는 입력창의 **[+]** 버튼, **Ctrl+N**으로 새 에이전트를 시작합니다. 최대 4개까지 동시에 작업하며 탭 클릭 또는 **Ctrl+←/→**로 전환합니다. 각 탭은 대화·초안·스크롤·승인 대기·세션·턴별 토큰 예산을 별도로 유지합니다. 새 탭은 현재 폴더·모델·에이전트 유형·모드를 사용하지만 대화나 일회성 자동 승인 옵션은 복사하지 않습니다.

다른 탭으로 이동해도 모델 요청은 계속됩니다. **Ctrl+C**는 현재 탭의 작업만 취소하고, 대기 상태에서는 그 탭을 닫습니다. `/exit`도 현재 탭을 닫으며 마지막 탭을 닫으면 OSCODE가 종료됩니다. 탭의 **입력** 표시는 승인 또는 설정 입력을 기다린다는 뜻입니다.

같은 프로젝트의 파일 변경·셸 실행 도구는 탭 간에 순서대로 실행합니다. 여러 에이전트가 모델을 호출하면 비용과 토큰 사용량도 각각 발생합니다. 이 제한은 OSCODE 내부 도구에 적용되며 외부 편집기의 변경이나 사용자가 실행한 백그라운드 프로세스까지 잠그지는 않습니다. `--simple`과 비대화형 실행은 기존 단일 세션을 유지합니다.

## 웹 화면 미리보기

대화형 BUILD 모드에서는 `oscode.json`의 `verify.url`이 응답하면 시작 시 자동으로 브라우저를 엽니다. 작업 완료 후에도 연결을 재확인하며, 성공한 셸 실행 결과에서 로컬 개발 주소가 나오면 자동으로 엽니다. 같은 주소는 실행 중 한 번만 자동으로 열고, 서버 미실행·PLAN·비대화형 실행에서는 자동으로 열지 않습니다. 임의 포트 검색이나 서버 자동 실행은 하지 않습니다.

수동으로 열려면 개발 서버를 실행한 뒤 `/preview http://localhost:3000`을 입력하면 기본 브라우저에서 웹 화면을 엽니다. 입력창 **미리보기** 버튼이나 `/preview` 명령도 사용할 수 있습니다. `oscode.json`의 `verify.url`이 있으면 그 주소를 사용하고, 없으면 입력받습니다. 현재 작성 중인 초안은 유지됩니다.

localhost·127.0.0.1·IPv6 루프백 주소만 지원하며 포트와 경로를 지정할 수 있습니다. 이 기능은 서버를 자동 실행하지 않으므로 프로젝트의 개발 서버를 먼저 켜주세요. 좁은 화면에서 버튼이 생략되면 `/preview`를 사용하세요.

## 작업 폴더 지정

```bash
oscode --cwd ~/projects/my-app
```

콘솔에서는 `/workspace`를 실행해 폴더 경로를 입력하거나 `/workspace ~/projects/my-app`으로 바로 변경합니다. `/cd ../other-app`도 가능합니다. `/cwd`는 전체 작업 경로를 보여줍니다. 공백이 있는 경로도 지원합니다.

폴더를 변경하면 기존 세션을 저장하고 새 프로젝트의 설정·세션으로 시작합니다. 기존 첨부 파일과 승인 상태는 전달하지 않습니다. 이전 폴더의 대화는 `oscode --cwd <이전 경로> --resume latest`로 재개하세요. 파일 첨부는 현재 작업 폴더 기준 `@docs/spec.pdf`처럼 지정합니다.

## 이미지·PDF OCR

`/ocr screenshots/login.png`로 이미지 글자를 추출하거나, `@docs/spec.pdf 요구사항을 정리해줘`처럼 문서를 질문에 첨부할 수 있습니다. PDF는 텍스트가 없는 페이지를 OCR로 처리합니다. 기본 한국어·영어, 첫 3페이지를 읽으며 범위를 지정할 수 있습니다.

macOS 준비: `brew install tesseract tesseract-lang poppler`. OCR은 로컬에서 실행되고, 질문에 첨부한 추출 텍스트는 선택한 모델로 전달됩니다. [지원 형식·설치·페이지 설정](docs/ocr.md)

## 복사·붙여넣기

대화 중 `/paste`로 클립보드의 여러 줄 코드·로그를 초안에 담고, `/draft`로 확인한 뒤 `/send`로 한 번에 전송합니다. `/clear`로 취소할 수 있습니다. `/copy`는 마지막 완료 답변을, `/copy code`는 코드 블록만 복사합니다.

요청을 전송하고 모델 응답을 기다리는 동안 입력창 바로 위에 움직이는 고래 🐳와 **데이터 통신 중…** 표시가 나타납니다. 응답 완료·오류·취소 시 자동으로 멈춥니다.

대화는 마우스 휠로 3줄씩, Page Up/Down으로 페이지 단위 이동합니다. Ctrl+Home은 처음, Ctrl+End는 최신 내용으로 이동하며 입력창은 하단에 고정됩니다. 이전 실행의 대화는 `oscode --resume latest`로 다시 열어 스크롤할 수 있습니다.

입력창 아래 **붙여넣기 · 복사 · 첨부 · BUILD/PLAN · 모델 · 전송/중단** 버튼을 마우스로 클릭할 수 있습니다. **F9**는 프로젝트 파일 첨부, **F10**은 모델 설정입니다. 좁은 화면은 붙여넣기·전송 버튼을 우선 표시합니다. **Ctrl+V**로 클립보드 텍스트를 현재 커서에 넣을 수 있으며 여러 줄도 자동 전송하지 않습니다. 복사 버튼은 마지막 완료 답변을 복사합니다. 마우스 추적을 켜므로 텍스트 드래그 선택은 터미널에 따라 Shift/Option 키가 필요할 수 있으며, 답변 복사는 F6를 사용할 수 있습니다.

전체 화면에서 `/`를 입력하면 명령어 목록이 바로 열립니다. 이어 입력해 검색하고, **↑↓**로 선택한 뒤 **Enter**로 실행하세요. **Esc**는 목록을 닫습니다. 추가 인수가 필요한 명령은 입력창에 채워집니다.

전체 화면에서는 **F6**로 마지막 완료 답변, **F7**로 코드 블록, **F8**로 작성 중인 입력을 즉시 복사합니다. 입력 내용과 커서 위치는 유지됩니다. Mac에서 기능 키가 시스템 동작에 연결되어 있으면 **Fn+F6/F7/F8**을 사용하세요.

저장된 답변은 `node bin/oscode.js --copy-last`로 API 호출 없이 복사할 수 있습니다. [운영체제별 지원과 사용법](docs/clipboard.md)

## 콘솔 UI 미리보기

```sh
node bin/oscode.js --ui-preview
```

API 키 없이 헤더·대화 예시·입력 영역을 확인합니다. 예시 문구는 실제 AI 응답이 아닙니다. 실제 채팅에서는 터미널 폭에 맞춘 프로젝트 요약과 현재 모드·모델 상태를 표시합니다. 넓은 화면에서는 명령을 두 열로, 좁은 화면에서는 한 열로 보여줍니다. `/set` 뒤 Tab을 누르면 `/settings`가 완성됩니다. `NO_COLOR=1`이면 색상을 끕니다.

`--simple` 입력 패널은 현재 모드·모델과 전송 안내를 한 영역에 표시합니다. 긴 입력은 터미널 폭에 따라 자동으로 줄바꿈되며, 창 크기를 바꿔도 입력 내용과 편집 커서를 유지합니다. 입력 중 스크롤은 터미널의 커서 추적 동작을 사용합니다. 사용자가 과거 로그로 스크롤한 경우의 화면 복귀는 터미널 설정에 따라 다릅니다. 여러 줄 코드 붙여넣기는 `/paste` → `/send`를 사용하세요.

## 전체 화면 콘솔

기본 대화형 실행은 하단 고정 입력창과 별도 대화 스크롤 영역을 제공합니다. `/` 명령 메뉴, 여러 줄 입력, F2 도구 로그 접기, 변경 전후 승인 화면, 작업 단계·토큰 상태바, 모델·키 설정 패널을 사용할 수 있습니다.

- Enter 전송 · Alt+Enter/Ctrl+J 줄바꿈
- 작업 중 Enter로 다음 요청 1개 대기 · 여러 줄 모드에서는 F5 · Esc로 대기 요청 꺼내기
- PageUp/PageDown 대화 스크롤 · Ctrl+End 최신 답변으로 이동
- `/` 입력 후 방향키·Enter로 명령 선택
- `--simple` 기존 줄 단위 콘솔

[전체 화면 콘솔 사용법과 제한](docs/console-ui.md)

입력창 위 대기 카드에서 다음 요청을 수정하거나 삭제할 수 있습니다. 오류 뒤에는 재시도·요청 수정·모델 변경 버튼이 나타납니다. 재시도는 원래 요청을 다시 실행하므로 기존 변경을 먼저 확인하세요.

파일 도구 변경 목록은 현재 실행 중인 에이전트의 성공한 파일 생성·편집 기록입니다. 파일을 선택하면 변경 내용을 대화 영역에서 확인합니다. 숫자는 누적 교체 범위이며 Git 기준 순변경량이 아닙니다. 셸을 통한 변경이나 이전 실행 기록은 포함하지 않습니다.

대기한 요청은 현재 작업이 완료되면 자동으로 실행합니다. 작업이 실패하거나 취소되면 대기 요청을 초안으로 복구해 직접 확인하고 전송할 수 있습니다. 승인·설정 입력에는 대기 요청이 전달되지 않습니다.

## 콘솔 챗봇

기본 실행은 계속 대화할 수 있는 콘솔 채팅창을 엽니다. 키가 없어도 시작할 수 있습니다. 시작 화면에는 프로젝트·모델 상태와 주요 명령만 표시합니다. 입력은 `›`, 답변은 `OSCODE` 영역에 표시되며 `/status`로 세션·예산을, `/verbose`로 상세 도구 출력을 확인할 수 있습니다.

```text
› /settings
공급자 [anthropic]:
API 주소 [https://api.anthropic.com/v1]:
모델 ID [미설정]: 사용할_모델_ID
› /key
API 키 (숨김 입력, Ctrl+C 취소):
› 로그인 화면의 접근성을 확인해줘
OSCODE
...
```

`/settings`의 공급자·모델 선택은 현재 채팅에 적용됩니다. `/key`로 저장한 키는 다음 실행에도 사용할 수 있습니다. `/key status`로 저장 여부 확인, `/key remove`로 삭제, `/exit`로 종료합니다. 키 입력 중 Ctrl+C를 누르면 채팅으로 돌아옵니다. 실제 AI 답변에는 연결된 모델이 필요합니다.

## API 키 없이 시작

```sh
npx @choijinwon/oscode@latest
```

0.9.1부터 모델이나 API 키가 없어도 로컬 입력창이 열립니다. `/files`로 파일 목록, `/frontend`로 프론트엔드 구조를 확인하고 `/connect`로 모델 연결 방법을 볼 수 있습니다. `/paste` 등 로컬 명령도 사용할 수 있습니다. 모델이 연결되지 않은 상태에서 자연어 요청을 입력하면 전송하지 않고 연결 방법을 안내하며 입력창을 유지합니다. AI 분석·수정에는 API 모델이나 실행 중인 호환 로컬 모델이 필요합니다.

## 모델 키 별도 설정

```sh
npx @choijinwon/oscode@latest auth set
npx @choijinwon/oscode@latest auth status
npx @choijinwon/oscode@latest --agent frontend --model YOUR_MODEL_ID
```

`auth set`은 키를 화면에 표시하지 않고 입력받아 사용자 전용 `~/.oscode/credentials.json`에 저장합니다. 프로젝트·대화 기록과 분리된 평문 파일이며, POSIX 파일 권한은 600입니다. `auth remove`로 삭제할 수 있습니다. [공급자별 설정과 보관 방식](docs/credentials.md)

## npm으로 실행

Node.js 22 이상이 필요합니다. 저장소 안에서는 다음 명령을 사용할 수 있습니다.

```sh
npm run demo
npm run frontend -- --model YOUR_MODEL_ID
npm start -- --plan --prompt '프로젝트 구조를 분석해줘'
```

저장소를 직접 복제하지 않고 현재 폴더를 분석하려면 GitHub 패키지를 실행하세요. Git이 설치되어 있어야 하며, 첫 실행에 npm이 패키지 설치 여부를 물을 수 있습니다.

```sh
npx --package=github:choijinwon/agent-oscode oscode --demo
npx --package=github:choijinwon/agent-oscode oscode --agent frontend --model YOUR_MODEL_ID
```

npm에는 `@choijinwon/oscode`로 공개되어 있습니다. npm의 이름 유사성 정책으로 `oscode` 단독 이름은 사용할 수 없습니다.

```sh
npx @choijinwon/oscode --demo
npx @choijinwon/oscode --agent frontend --model YOUR_MODEL_ID
# 선택: 전역 설치 후 oscode 명령 사용
npm install -g @choijinwon/oscode
```

브라우저 진단에는 Chromium 등 별도 준비가 필요합니다.

## 바로 실행

```sh
# API 없이 실제 프로젝트 파일을 읽는 데모
node bin/oscode.js --demo

# 도움말
node bin/oscode.js --help

# 선택: 어디서나 oscode 명령으로 실행하도록 로컬 설치
npm link
```

Claude API로 사용하려면 환경에 `ANTHROPIC_API_KEY`를 설정하고, 계정에서 사용 가능한 모델 ID를 지정한다. 키를 대화나 저장소에 입력하지 않는다.

```sh
node bin/oscode.js --model YOUR_MODEL_ID

# 분석만 수행
node bin/oscode.js --model YOUR_MODEL_ID --plan --prompt '이 프로젝트 구조를 설명해줘'

# 작업 폴더 지정 및 재개
node bin/oscode.js --model YOUR_MODEL_ID --cwd /path/to/project --resume latest
```

`OSCODE_MODEL`, `OSCODE_PROVIDER`, `OSCODE_BASE_URL` 환경 변수로 기본값을 지정할 수 있다. `.env` 파일을 자동으로 읽지는 않는다.

다른 모델 서비스는 `OSCODE_API_KEY`와 호환 API 주소를 설정한다. 호환 공급자의 기본 주소는 OpenRouter이며, 로컬 서버는 키 없이 사용할 수 있다. 해당 모델과 서버가 **도구 호출, SSE 스트리밍, usage 스트림 옵션**을 지원해야 한다.

```sh
node bin/oscode.js --provider compatible --model YOUR_MODEL_ID
node bin/oscode.js --provider compatible --base-url http://localhost:1234/v1 --model YOUR_LOCAL_MODEL
```

## 구현된 기능

- 대화형 터미널과 단일 요청 실행, 실시간 텍스트 스트리밍.
- 파일 목록, 리터럴 검색, 줄 범위 읽기, 정확히 한 번 일치하는 부분 편집, 새 파일 생성.
- 편집 전 읽기와 변경 감지, 변경 내용 미리보기, 셸 실행 승인과 30초 제한.
- 플랜 모드: 조사·단계별 계획 저장, `/plan` 전환, `/apply` 확인 후 구현. 실행 중 Ctrl+C 취소.
- 프로젝트 루트의 `AGENTS.md` 읽기: 최대 8,000바이트. 하위 폴더의 지침은 자동 탐색하지 않는다.
- 세션 저장·재개, 모델 변경, Git diff 확인.
- 작업별 토큰 예산, API 사용량 및 캐시 토큰 표시, 오래된 문맥 정리.
- 요청별·모델별 사용량 분석과 사용자 설정 단가 기반 비용 추정.
- 파일 편집·생성 체크포인트와 충돌 감지 `/undo`.
- 같은 도구 결과 반복과 연속 실패 감지로 추가 실행·호출 중단.
- `oscode.json` 프로젝트 설정과 `/config`, 설정된 테스트 실행 `/test`.

새 파일의 부모 폴더는 먼저 존재해야 한다. 폴더 생성이나 테스트 실행은 셸 도구로 수행할 수 있다.

## 토큰을 아끼는 방식

| 제어 | economy (기본) | balanced |
| --- | ---: | ---: |
| 요청 1회 입력 추정 한도 | 12,000 | 24,000 |
| 응답 1회 토큰 한도 | 1,500 | 3,000 |
| 사용자 요청 1개당 누적 예산 | 40,000 | 100,000 |
| 요청당 모델 호출 횟수 | 8 | 12 |
| 도구 출력 문자 수 | 4,000 | 6,000 |

```sh
node bin/oscode.js --model YOUR_MODEL_ID --profile economy --budget 25000
node bin/oscode.js --model YOUR_MODEL_ID --max-input 16000 --max-output 2500 --max-steps 10
```

1. 저장소 전체를 프롬프트에 넣지 않고 필요한 경로와 줄만 읽는다. 읽기 기본값은 100줄이며 최대 300줄이다.
2. Git 저장소의 파일 목록과 검색은 Git ignore 규칙을 적용한다. 결과는 최대 3,000개 파일·60개 검색 일치로 제한한다. Git을 사용할 수 없으면 제한된 디렉터리 탐색으로 대체하며 이 경우 `.gitignore` 패턴은 적용되지 않는다.
3. 도구 출력은 문자 수를 제한하고 잘림을 명시한다. 문맥 한도에 도달하면 과거 턴 전체를 제외하고, 필요하면 현재 턴의 오래된 도구 출력을 줄인다. 최근 도구 출력 2개와 현재 사용자 요청은 유지한다.
4. 제외된 원문은 로컬 세션에 보관한다. `/compact`는 별도 모델 호출 없이 정리하므로 요약 비용이 없다. 요청 일부만 남기는 손실 있는 정리이며 완료된 작업의 의미 요약은 아니다.
5. Anthropic 요청에는 안정적인 시스템 지침과 최근 메시지에 캐시 지점을 설정한다. 캐시 적용 여부·최소 길이·비용은 공급자와 모델에 따라 다르며 적중을 보장하지 않는다.
6. 기본적으로 단일 모델만 호출한다. 모델 병렬 실행, 자동 재시도, 자동 고가 모델 승격은 하지 않는다.

**표시 구분:** 실행 전 입력량은 UTF-8 바이트 수를 이용한 휴리스틱 추정이다. 실행 후에는 공급자의 `usage`를 누적한다. 캐시 읽기·쓰기는 입력 토큰의 부분집합으로 표시하며 합계에 이중 계산하지 않는다. 응답에 사용량이 없거나 응답을 받지 못하면 추정/예약량을 누적하고 `추정 포함`으로 표시한다. 캐시 토큰까지 포함한 처리량 예산이며 금액 예산이 아니다.

**예산의 한계:** 다음 호출 전에 입력 추정량과 남은 예산으로 응답 한도를 정한다. 토크나이저 오차나 연결 중단으로 실제 과금은 예산을 넘을 수 있다. 절대 과금 상한과 실제 절감률을 보장하지 않는다. 공급자 사용량 상한은 별도로 설정해야 한다. 아직 실모델 비용 벤치마크는 수행하지 않았다.

## 대화 중 명령

| 명령 | 동작 |
| --- | --- |
| `/help` | 사용법 |
| `/plan` 또는 `/plan on` | 플랜 모드로 전환, 다음 요청부터 계획만 작성 |
| `/plan 요청내용` | 플랜 모드로 전환하고 해당 요청의 계획 작성 |
| `/plan show` / `/plan list` | 최신 계획 / 계획 이력 확인 (모델 호출 없음) |
| `/plan off` | 구현 모드로 전환, 저장된 계획은 자동 실행하지 않음 |
| `/apply` | 최신 계획을 표시하고 확인 후 구현 시작 |
| `/usage` 또는 `/usage all` | 누적·모델별 사용량, 입력 구성 추정, 최근 5개 또는 전체 요청 비용 |
| `/compact` | 최신 턴을 유지하고 과거 턴을 입력에서 제외 |
| `/model MODEL` | 현재 공급자 내 다음 요청 모델 변경 |
| `/budget N` | 다음 사용자 요청의 예산 변경 |
| `/diff` | Git HEAD 대비 diff와 상태, 미추적 파일은 상태에 표시 |
| `/checkpoints` | 파일 편집·생성 체크포인트 목록 |
| `/undo` 또는 `/undo ID` | 최근 또는 지정한 파일 변경 1건 복원 |
| `/config` | 현재 적용된 설정 |
| `/test` | 프로젝트의 testCommand 실행 (셸 권한 적용) |
| `/exit` | 종료 |

## 플랜 모드로 먼저 설계하기

```sh
node bin/oscode.js --model YOUR_MODEL_ID --plan --prompt '로그인 기능 리팩터링 계획을 세워줘'
node bin/oscode.js --resume latest --show-plan
node bin/oscode.js --model YOUR_MODEL_ID --resume latest --apply-plan
```

플랜 모드에서는 파일 검색·읽기만 수행하고 목표, 조사 결과, 수정 단계, 검증 방법과 미확인 사항을 계획으로 저장한다. `/apply`에서 계획을 확인하고 실행에 동의하면 구현 모드로 전환된다. 비대화형 `--apply-plan` 자체는 저장된 계획 실행에 대한 명시적 승인이다. 파일·셸 권한은 별도이며 자동으로 허용되지 않는다.

계획은 대화 문맥 정리 후에도 세션에 남는다. 계획 작성에는 모델 토큰이 사용되지만 조회와 모드 전환에는 모델을 호출하지 않는다. 자세한 흐름과 제한은 [플랜 모드 가이드](docs/planning.md)를 참고한다.

## 프로젝트 설정·사용량·되돌리기

```sh
node bin/oscode.js --init
node bin/oscode.js --config
node bin/oscode.js --usage --resume latest
node bin/oscode.js --checkpoints --resume latest
node bin/oscode.js --undo latest --resume latest
```

이 관리 명령들은 API 키 없이 실행할 수 있다. `--init`은 기존 설정을 덮어쓰지 않는다. 설정 우선순위, 모델별 단가와 권한은 [설정 가이드](docs/configuration.md)를 참고한다.

`/undo`는 **oscode 파일 도구가 만든 변경 1건**을 되돌린다. 편집 직전 내용과 모드를 보존하며 현재 상태가 oscode 편집 직후와 다르면 충돌로 거절한다. 셸 명령의 변경, Git 전체 작업, 다른 세션의 변경을 일괄 되돌리는 기능은 아니다. 여러 파일을 변경한 경우 목록을 확인하고 개별 복원한다. 이후 수정된 파일은 자동 병합하지 않는다.

반복 감지 기본값은 3이다. 동일 도구·인자로 같은 결과를 두 번 받은 뒤 세 번째 시도를 차단한다. 서로 다른 호출이어도 도구 실패가 3회 연속 발생하면 추가 모델 호출 전에 중단한다. 새 사용자 요청에서는 감지를 새로 시작한다.

## 실행 권한과 저장

파일 읽기·검색은 프로젝트 경계 안에서 수행하며 `.git`, `.oscode`, 주요 생성 폴더와 `.env`·인증서 키 경로 등을 제외한다. 이 제외 목록은 완전한 비밀정보 탐지기가 아니다. 선택된 파일 내용은 설정한 모델 공급자에게 전송된다.

파일 생성·수정과 셸 명령은 기본적으로 사용자 승인을 받는다. 프로젝트 설정의 `deny`는 자동 허용 플래그보다 우선한다. 비대화형 실행은 승인되지 않은 변경을 거절한다. `--yes`는 파일 변경만, `--allow-shell`은 셸 명령 실행을 자동 허용한다. 읽기 전용 모드에서는 두 옵션을 지정해도 변경 도구를 실행하지 않는다.

**셸은 OS 샌드박스가 아니다.** 승인된 명령은 실행 사용자 권한으로 프로젝트 밖 파일과 네트워크에 접근할 수 있다. 파일 경계 검사도 악의적인 동시 파일 교체에 대한 OS 격리를 제공하지 않는다.

세션과 체크포인트의 편집 전 파일 내용은 프로젝트의 `.oscode/<id>.json`에 사용자 전용 파일 권한으로 저장된다. 저장량은 사용에 따라 증가하며 자동 삭제는 하지 않는다. 모델 요청, 도구 결과, 코드 일부가 들어가므로 Git에 올리지 않는다. 이 저장소의 `.gitignore`에는 이미 제외되어 있으며 다른 프로젝트에서는 `.oscode/`를 직접 제외해야 한다. 환경 변수의 API 키를 세션 필드에 저장하지 않는다. 모델·공급자·권한은 재개할 때 현재 실행 설정을 사용한다.

## 개발 및 검증

```sh
npm test
npm run check
```

테스트는 실제 유료 API를 호출하지 않는다. 가짜 공급자의 로컬 HTTP/SSE 응답을 사용해 CLI → 모델 요청 → 도구 실행 → 후속 요청 → 사용량 저장까지 검증한다. 테스트 실행에는 localhost 리스닝 권한이 필요하다.

현재 한계: 실제 API 계정 연동 검증, OpenCode/Pi 실행 엔진 어댑터, MCP, 플러그인, 멀티 에이전트 병렬 실행, 전체 화면 TUI는 포함하지 않는다. 공급자마다 다른 추가 필드나 추론 모드는 아직 지원하지 않는다.

설계와 참고 자료는 [docs/architecture.md](docs/architecture.md)에 정리했다.

## 프론트엔드 전문 모드

`oscode --agent frontend`로 UI 작업에 맞는 에이전트를 사용하세요. 스택·스크립트·컴포넌트 진단, 반응형·접근성·상태 처리 지침과 플랜 모드를 함께 제공합니다. `oscode --inspect-frontend`는 API 호출 없이 프로젝트를 진단합니다. [사용법과 검증 범위](docs/frontend.md).

## 브라우저 UI 진단

`oscode ui check http://localhost:3000`으로 모바일·태블릿·데스크톱 화면과 가로 넘침, 콘솔/네트워크 오류를 확인하세요. 진단은 모델 API 호출 없이 실행하고 결과를 로컬에 저장합니다. `--viewport mobile`로 수정한 화면만 재검사할 수 있습니다. [설치·사용법·검증 범위](docs/ui-check.md).

## 컴포넌트와 아키텍처

`oscode --component mui/button`으로 MUI·Ant Design·Bootstrap 스타터와 프로젝트 적용 안내를 조회하세요. `--output ActionButton.jsx --yes`는 새 파일을 생성합니다. `oscode --architecture`는 폴더 역할·상대 import 순환 등 구조 후보를 진단합니다. 프론트엔드 에이전트와 PLAN에도 연결됩니다. [컴포넌트 적용](docs/components.md) · [프론트엔드 아키텍처](docs/frontend-architecture.md).

## 프론트엔드 품질 워크플로

저장된 시나리오 실행, 승인된 스크린샷 비교, axe 접근성 검사, Tailwind 토큰 진단, AST 변경 영향 분석, Storybook 상태·가시성 검증 스타터를 제공합니다. [사용법·예제·검사 범위](docs/frontend-quality.md).

## 프로젝트 통합 검증

`oscode verify --changed --start dev --open`으로 변경 파일 분석, 구성된 검사 스크립트, 개발 서버 시작·준비 확인, 브라우저 검사와 로컬 HTML 보고서를 연결합니다. 실행 승인이 필요하며 생략/실패/통과를 별도로 기록합니다. [설정과 사용 범위](docs/verify.md).

## 네 프레임워크 지원

React·Vue·Angular·Svelte를 감지하고 각 문법에 맞는 네이티브 스타터 20개를 제공합니다. `--component vue/button`, `angular/card`, `svelte/alert`, `react/pagination`으로 조회하세요. [버전·호환성과 기능별 지원 범위](docs/frameworks.md).

### 파일 선택과 오류 수정

- `@src/Button.vue 버튼 상태를 수정해줘`: 파일 참조, 전체 화면에서 자동완성
- `/context add src/Button.vue`: 다음 요청에 첨부할 파일 선택
- `/context`: 선택 파일과 토큰 추정 확인
- `/context history off`: 다음 요청에서 이전 대화 제외
- `/diagnose lint`: 승인 후 프로젝트 검사
- `/fix`: 확인된 실패 수정 후 동일 검사 재실행

[사용법과 범위](docs/console-ui.md). 파일 참조와 진단은 React·Vue·Angular·Svelte 프로젝트에서 사용할 수 있습니다. 실제 검사는 프로젝트 스크립트를 사용합니다.

### 입력 편의 기능

전체 화면 콘솔에서 `Ctrl+R`로 이번 실행의 입력 기록을 검색하고, `Ctrl+P`로 한글 명령 팔레트를 엽니다. 선택 후 Enter는 입력창에 넣기만 하며 다시 Enter를 눌러 실행합니다. Esc는 원래 초안으로 돌아갑니다.

작업 중 Ctrl+C로 취소하면 요청을 복구합니다. 새 초안이 있으면 보존하며, 입력창을 비우고 F4로 취소한 요청을 가져올 수 있습니다. 하단 단축키 안내는 현재 작업에 맞춰 바뀝니다. API 키 입력은 검색 기록에서 제외합니다.

### ChatGPT 계정 연결

`/settings` → **ChatGPT 계정으로 로그인** → 브라우저 승인 → 모델 선택 → **적용하고 닫기**.
공식 Codex 런타임이 인증을 관리하며, OSCODE는 토큰 원문을 복사하지 않습니다.
PLAN·파일 승인·체크포인트는 기존 OSCODE 도구로 처리합니다.
출력 예산은 이 연결에서 서버의 강제 한도가 아니며, 응답 검증 후 표시합니다.
[인증 저장 위치·사용량 제한·검증 범위](docs/chatgpt-login.md).

## 프로젝트 스킬 선택

프로젝트의 `.oscode/skills/<이름>/SKILL.md` 또는 `.oscode/skills/<이름>.md`에 Markdown 지침을 저장하세요. `/skills` 또는 입력창의 **스킬** 버튼으로 검색·선택합니다. 방향키로 이동하고 Enter로 확정하며, `돌아가기`는 기존 선택을 유지합니다.

- `/skills list`: 이름·설명·예상 토큰 확인
- `/skills frontend-review`: 이름으로 선택
- `/skills off`: 다음 요청부터 스킬 첨부 해제

선택은 현재 에이전트에서 한 개만 유지되며 다른 에이전트·작업 폴더·재실행에는 전달되지 않습니다. 선택한 파일만 매 요청에 다시 읽어 적용합니다. 기존 입력 초안은 선택 중에도 보존됩니다. 스킬은 24 KiB 이하이며 심볼릭 링크는 지원하지 않습니다. 선택한 스킬을 삭제하거나 읽을 수 없으면 요청을 중단하고 알립니다.

스킬 지침도 요청 토큰에 포함되며 기존 예산 검사를 받습니다. 선택 해제는 과거 대화에 포함된 스킬 내용을 지우지 않습니다. 과거 내용까지 제외하려면 `/context history off`를 사용하세요. 스킬은 PLAN 제한·파일 접근·실행 승인 정책을 우회할 수 없습니다. 스크립트나 참고 파일을 자동 실행·첨부하지 않습니다.

[프론트엔드 검토 예제](examples/skills/frontend-review/SKILL.md)를 복사해서 시작할 수 있습니다:

```sh
mkdir -p .oscode/skills/frontend-review
cp -n examples/skills/frontend-review/SKILL.md .oscode/skills/frontend-review/SKILL.md
```

`.oscode`는 기본적으로 Git에서 제외됩니다. 공유할 예제는 `examples/skills`처럼 별도 경로에서 관리하세요.

## 글자·화면 스타일

`/style`, 입력창 **＋ → 스타일**, 또는 `/settings → 글자·화면 스타일`에서 선택합니다.

- 테마: 다크 / 라이트 / 고대비
- 글자 굵기: 기본 / 굵게
- 답변 서식: 제목·표·코드 서식 적용 / Markdown 원문 보기

선택 즉시 미리보기가 적용되며 **저장하고 닫기**로 `.oscode/ui.json`에 저장합니다. 취소하면 이전 스타일로 돌아갑니다. 모델 설정과 별도로 저장하므로 API 키 없이도 사용 가능합니다. 현재 에이전트에 즉시 적용되며 재실행한 에이전트는 저장된 설정을 읽습니다. `NO_COLOR` 또는 `TERM=dumb`에서는 색상·굵기를 출력하지 않습니다. 실제 글꼴과 글자 크기는 사용하는 터미널 앱에서 설정하세요.

## 요청 컨텍스트 절약

모델 요청을 만들 때 동일한 `read_file` 호출 입력·결과와 반복 첨부된 같은 파일 발췌를 중복 제거합니다. 최신 본문 한 개와 도구 호출·결과 쌍은 유지하며, 저장된 세션 원문은 변경하지 않습니다. 대화가 잘리거나 이전 기록이 제외되면 남은 요청만을 기준으로 다시 구성하므로 누락된 과거 본문을 참조하지 않습니다.

첨부 소스가 길면 질문의 식별자·검색어와 일치하는 줄 주변을 우선 발췌합니다. 일치하는 줄이 없으면 기존 앞부분 발췌로 돌아갑니다. 이것은 구문 트리나 전체 함수 추출이 아닌 제한된 줄 단위 검색입니다. 정확한 편집 전 원본 읽기는 계속 필요합니다.

발췌 결과는 `.oscode/cache/context/`에 파일별로 저장합니다. 매번 현재 파일을 읽고 내용 해시·질문·알고리즘 버전을 비교해 재사용 여부를 판단합니다. 캐시는 모델 분석 결론이나 의존성 분석을 저장하지 않습니다. 캐시 오류는 원본 기반 재계산으로 대체합니다. `/context`에서 발췌 캐시 적중 여부를 확인할 수 있습니다.

`/usage`에는 요청별 중복 제거로 줄어든 입력 토큰의 **추정 합계**가 표시됩니다. 캐시 적중 자체를 토큰 절감으로 계산하지 않으며, 실제 공급자 사용량은 별도로 유지합니다. 파일 읽기·발췌 캐시는 로컬 처리이고 추가 모델 호출은 없습니다. 동일 작업의 성공률·총토큰을 비교하는 실제 A/B 성능 검증은 별도입니다.

## 대화형 승인 방식

`/approval`, **＋ → 승인**, 또는 `/settings → 승인 방식`에서 선택합니다.

| 방식 | 파일 생성·편집 | 셸·브라우저 검증 실행 |
| --- | --- | --- |
| 나에게 묻기 (`ask`) | 확인 | 확인 |
| 나 대신 승인 (`delegate`) | 자동 승인 | 확인 |
| 자동 승인 (`auto`) | 자동 승인 | 자동 승인 |

`/approval ask`, `/approval delegate`, `/approval auto`로 직접 전환할 수도 있습니다. 셸 자동 승인은 프로젝트 밖에 영향을 주는 명령도 실행할 수 있으므로 선택 화면에 해당 범위를 표시합니다. '나 대신 승인'은 AI의 위험 판단이 아니라 파일 편집과 셸 실행을 구분하는 고정 정책입니다.

선택은 현재 에이전트에 즉시 적용되며 재실행·새 에이전트·작업 폴더 변경에는 이어지지 않습니다. 기본값은 매번 확인이며 기존 `--yes`·`--allow-shell` 실행 옵션은 초기값에 반영됩니다. PLAN 모드와 프로젝트의 `deny` 규칙, 파일 접근 제한은 모든 승인 방식에서 유지됩니다. 설정 화면의 모델 설정 취소는 이미 선택한 승인 방식을 되돌리지 않습니다.

## 질문에 맞춘 코드 지도

`/map`으로 소스 구조를, `/map Button`처럼 검색어를 붙여 관련 파일·심볼을 확인하세요. 모델도 읽기 전용 `repository_map` 도구를 BUILD·PLAN 모드에서 사용할 수 있습니다. API 호출 없이 로컬에서 생성하며, 지도 결과를 모델이 사용하는 경우 해당 텍스트의 토큰은 소비됩니다.

본문 대신 주요 함수·클래스·타입·변수의 이름과 줄 번호, 직접 상대경로 import를 제공합니다. 기본 출력은 추정 1,600 토큰 이내이며 최대 120개 파일·2 MiB를 분석합니다. React/Angular 소스와 Vue/Svelte script 영역을 지원합니다. 수정된 소스는 해시를 확인해 재분석합니다. 지도는 불완전한 탐색 보조 정보이므로 편집 전 원본 확인이 필요합니다.

[경쟁 도구 비교·구현 범위](docs/competitive-analysis.md)

## 변경 영향과 파일별 규칙

최신 소스에서 사용할 수 있습니다. npm `0.10.0`에는 이번 기능이 포함되지 않았습니다.

```text
/impact src/styles/tokens.css
/rules explain src/components/Button.vue
/rules last
```

`/impact`는 React·Vue·Angular·Svelte의 import, 스타일과 Angular 템플릿 연결을 따라 영향받는 파일·화면·테스트 후보와 줄 번호 근거를 보여줍니다. 해시가 같은 파일은 파싱을 재사용하며 최대 300개 파일·2 MiB, 기본 추정 2,400 토큰으로 제한합니다. `partial`과 `omittedAffected`로 스캔 한계와 출력 생략을 구분합니다. 전체 런타임이나 LSP 분석은 아니며 테스트 통과를 뜻하지 않습니다.

`.oscode/rules/<이름>.md`에 한 줄 JSON 배열 `paths`와 Markdown 본문을 저장하면 첨부한 파일·이번 턴에서 읽은 파일에 일치하는 규칙만 다음 모델 요청에 포함합니다. 예시와 사용법은 [변경 영향·파일별 규칙 가이드](docs/frontend-impact-and-rules.md)를 보세요.

`/rules`와 `/rules explain 파일경로`는 포함·범위 밖·예산 초과·형식 오류와 토큰 추정을 보여줍니다. `/rules last`는 마지막 요청 당시 기록입니다. 규칙은 총 추정 2,000 토큰 안에서 포함하며 매 요청 새로 읽습니다. 새 규칙이 있는 파일의 편집은 규칙을 모델에 전달한 뒤 재시도하도록 보류합니다. 본문을 매 턴 대화 기록에 누적하지 않고 기존 승인·PLAN 제한을 유지합니다.

## 작업 결과와 인계

- `/summary`: 최근 작업의 요청·파일 편집 기록·도구 실행 근거·토큰·중단 사유 표시
- `/handoff`: `.oscode/handoff-<고유 ID>.md`로 작업 인계 파일 저장
- `/handoff copy`: 인계 내용을 클립보드에 복사해 새 대화에서 사용

추가 모델 호출 없이 로컬 기록으로 생성합니다. 도구의 성공 응답·오류·결과 없음은 구분하지만 테스트 통과를 추론하지 않습니다. 인계 문서는 제한된 요청 발췌를 담으며, 소스 첨부·스킬 본문·도구 원문 출력은 포함하지 않습니다. 모든 요구사항·설계 결정을 보존하는 전체 대화 요약이 아니므로, 정확한 이어가기는 `oscode --resume <세션 ID>`를 사용하세요. 파일 상태와 검증 결과는 다시 확인해야 합니다.

## 프론트엔드 수정 완료 확인

수정 후 `/review` 또는 **＋ → 검증**을 실행하세요. Git HEAD 대비 변경 파일(기존 변경 포함), 설정된 프로젝트 스크립트, 브라우저의 반응형·접근성 검사를 묶어 확인합니다. Git 저장소에 HEAD 커밋이 필요합니다.

```text
/review http://localhost:3000
/review show
```

반복 작업은 `oscode.json`의 `verify`에 실제 프로젝트 스크립트와 URL을 지정하세요. 예시는 프로젝트에 해당 스크립트가 있을 때 사용합니다.

```json
{
  "verify": {
    "scripts": ["typecheck", "lint", "test"],
    "url": "http://localhost:3000"
  }
}
```

URL은 실행 중인 서버를 가리켜야 합니다. 자동 서버 실행은 기존 `verify.devScript` 설정을 사용합니다. 실행 승인은 현재 승인 정책을 따르며 PLAN·프로젝트 금지 규칙을 유지합니다. 추가 모델 호출은 없습니다.

설정된 스크립트와 브라우저 검사까지 통과해야 **구성된 검사 통과**로 표시합니다. 생략·승인 거절·설정 누락은 **검증 미완료**입니다. 검사 결과는 `.oscode`의 HTML/JSON 보고서에 남고 `/review show`로 다시 볼 수 있습니다. 충분한 높이의 터미널에는 결과·재검사 카드도 표시합니다. 이후 도구 편집·셸 실행 시 재검사 안내를 띄우며 외부 편집은 실시간 감시하지 않습니다. 자동 검사 통과는 수동 QA나 전체 접근성 준수 판정을 대신하지 않습니다.

## 프론트엔드 아키텍처

`/architecture` 또는 `/architecture src`로 프로젝트 전체·하위 폴더를 분석합니다. API 키나 모델 호출 없이 폴더 역할(라우트·기능·공통 UI·데이터), 직접 의존 관계 일부, 순환 참조·공통 UI의 기능 계층 참조 후보를 한국어로 표시합니다. Markdown·JSON 보고서는 `.oscode/architecture-<ID>.*`에 저장합니다. PLAN에서도 소스 변경 없이 사용할 수 있습니다.

기존 `--architecture`와 모델 도구 `frontend_architecture`도 유지합니다. 처음 60개 파일, 파일당 24,000자, 상대경로 import 중심의 휴리스틱입니다. 별칭·템플릿·동적 의존성 누락과 주석·타입 import의 오탐 가능성이 있어 실제 소스 확인이 필요합니다. 자동으로 폴더를 옮기거나 특정 아키텍처를 강요하지 않습니다.

### 컴포넌트 UI 상태 점검

`/states src/components/Search.tsx`로 로딩·오류·빈 결과·비활성 상태 관련 코드 위치와 화면 확인 체크리스트를 확인합니다. React JS/TS/JSX/TSX, Vue, Svelte, Angular HTML/TS 파일을 지정할 수 있습니다. Angular의 외부 템플릿은 `.html`을 별도로 지정하세요. API 키나 모델 호출 없이 실행하며 PLAN에서도 사용 가능합니다. 프론트엔드 모델 도구는 `frontend_states`입니다.

단일 파일 최대 32,000자, 상태별 최대 3개 위치만 표시합니다. 문자열 기반 후보 분석으로 실제 동작을 검증하지 않으며, 미발견은 결함을 뜻하지 않습니다. import·별도 템플릿·사용자 정의 표현은 놓칠 수 있습니다. 필요한 상태인지 판단한 뒤 느린 응답·실패·빈 결과·중복 제출을 실제 화면에서 확인하세요. 최신 GitHub 소스에 포함되며 기존 npm 0.9.1에는 포함되지 않습니다.

실제 동작 검증은 `/states run http://localhost:3000 examples/ui-states.json`으로 실행합니다. 클릭·입력 후 표시/숨김·활성/비활성·텍스트·요소 수를 모바일/태블릿/데스크톱에서 확인하고 화면·실행 기록을 저장합니다. 예시의 선택자와 테스트 데이터는 프로젝트에 맞게 수정해야 합니다. BUILD 및 브라우저 실행 승인, Playwright/Chromium 설치가 필요합니다. [시나리오 작성과 제한](docs/frontend-quality.md#실제-ui-상태-검증).

### 클릭으로 브라우저 테스트 녹화 (최신 소스)

`/states record http://localhost:3000`으로 브라우저를 열고 클릭·입력을 녹화하세요. 화면 패널에서 표시·텍스트·활성/비활성·요소 수 검증 조건을 선택하고 요소를 클릭하면 시나리오에 추가됩니다. 완료 후 프로젝트 루트에 JSON을 저장하며 `/states run`으로 재생합니다. BUILD 전용으로 실행·쓰기 승인이 적용되고, API 키 없이 동작합니다. 단일 화면·20단계·5분으로 제한되며 테스트 데이터만 사용하세요. **npm 0.10.0 이후 소스에 추가된 기능**입니다. [사용법과 지원 범위](docs/frontend-quality.md#화면에서-시나리오-녹화-최신-소스).

### 서버 변경 없이 로딩·오류·빈 결과 재현 (최신 소스)

`/states run` 시나리오의 `routes`에 API 응답과 지연을 지정하면, 같은 origin의 fetch/XHR에만 테스트 응답을 제공해 로딩·실패·재시도·빈 결과·정상 복구를 검증합니다. 요청이 계획대로 발생했는지도 보고서에 표시합니다. `node examples/state-lab/server.js`로 예제를 시작하고 `/states run http://127.0.0.1:4195 examples/state-lab/scenario.json`으로 시연하세요. 이 예제는 테스트 화면이며 실제 사용자 성과를 나타내지 않습니다. [사용법과 제한](docs/frontend-quality.md#api-상태-재현-로딩--오류--빈-결과--정상-복구-최신-소스).

`/states fix URL 시나리오.json`은 실패를 먼저 확인하고, 연결된 AI로 한 번 수정한 다음 원래 시나리오로 재검증합니다. 기존 승인 설정을 따르며 `.oscode/ui-repair-<ID>.html`에 전후 화면·단계 보고서를 저장합니다. 중단·미완료·검사 환경 불일치는 해결로 표시하지 않습니다. 최신 소스에서 사용할 수 있습니다.

### 핵심 작업 중심 메뉴

빈 `/` 메뉴와 명령 검색의 첫 화면은 녹화·실행·수정·미리보기·설정·작업 폴더·프로젝트 검증·도움말 8개로 정리했습니다. OCR·스타일 등 보조 기능은 명령 일부를 입력하면 찾을 수 있습니다. UI 수정에서는 모델 연결을 먼저 확인하며, 재검증에 실제 HTTP 실패나 처리되지 않은 JS 오류가 남으면 해결로 판정하지 않습니다. [기능 집중 검토](docs/product-focus.md).

### MCP 서버 연결 (최신 소스)

`/mcp`에서 로컬 stdio 서버를 등록·연결하고 AI에 제공할 도구를 선택합니다. 자동 연결하지 않으며 도구 호출은 기존 승인 정책을 따릅니다. PLAN은 사용자가 읽기 전용으로 등록한 도구만 허용합니다. 원격 HTTP·OAuth·이미지 결과는 아직 지원하지 않습니다. [설정과 실행 예제](docs/mcp.md).

### 폐쇄망·내부 LLM 연결 (최신 소스)

`--intranet --base-url http://10.0.0.10:8000/v1 --model your-model` 또는 `/intranet {"baseUrl":"http://10.0.0.10:8000/v1","model":"your-model"}`로 내부 호환 API를 연결합니다. `/intranet check`는 코드를 보내지 않고 응답을 확인합니다. 전용 환경변수 인증·비스트리밍·사내 CA 설정을 지원하며 클라우드 키·기본 주소로 대체하지 않습니다. 전체 도구의 통신을 막는 방화벽 기능은 아닙니다. [설정과 운영 범위](docs/intranet.md).
