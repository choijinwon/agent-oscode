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

## 복사·붙여넣기

대화 중 `/paste`로 클립보드의 여러 줄 코드·로그를 초안에 담고, `/draft`로 확인한 뒤 `/send`로 한 번에 전송합니다. `/clear`로 취소할 수 있습니다. `/copy`는 마지막 완료 답변을, `/copy code`는 코드 블록만 복사합니다.

저장된 답변은 `node bin/oscode.js --copy-last`로 API 호출 없이 복사할 수 있습니다. [운영체제별 지원과 사용법](docs/clipboard.md)

## 콘솔 UI 미리보기

```sh
node bin/oscode.js --ui-preview
```

API 키 없이 헤더·대화 예시·입력 영역을 확인합니다. 예시 문구는 실제 AI 응답이 아닙니다. 실제 채팅에서는 터미널 폭에 맞춘 프로젝트 요약과 현재 모드·모델 상태를 표시합니다. 넓은 화면에서는 명령을 두 열로, 좁은 화면에서는 한 열로 보여줍니다. `/set` 뒤 Tab을 누르면 `/settings`가 완성됩니다. `NO_COLOR=1`이면 색상을 끕니다.

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
