# 프로젝트 통합 검증

```sh
# HEAD 대비 작업 트리 변경을 확인하고 기존 typecheck/lint 실행
oscode verify --changed

# 개발 서버를 직접 시작하고 URL을 로그에서 감지
oscode verify --changed --start dev --open

# 이미 실행 중인 서버 사용: 서버를 종료하지 않음
oscode verify --changed --url http://localhost:3000 --open

# 명령 실행과 보고서 파일 생성 없이 계획만 확인
oscode verify --changed --plan

# 자동화/비대화형 실행에서 셸 승인
oscode verify --changed --allow-shell
```

모델 API 없이 동작합니다. 대화형 터미널에서는 실행할 명령과 프로젝트 스크립트 본문을 보여주고 승인을 받습니다. 비대화형 환경은 `--allow-shell`이 없으면 실행을 blocked로 기록합니다. `permissions.shell: "deny"`는 자동 승인보다 우선합니다. PLAN에서는 조사와 실행 계획만 반환하며 서버·검사·보고서 파일 생성을 실행하지 않습니다.

## 프로젝트 설정

기존 `oscode.json`에 다음 `verify` 항목을 추가할 수 있습니다. 프로젝트에 실제 있는 스크립트만 지정하세요.

```json
{
  "verify": {
    "scripts": ["typecheck", "lint", "test:unit"],
    "devScript": "dev",
    "url": "http://localhost:3000",
    "readyTimeout": 30000,
    "scriptTimeout": 60000
  }
}
```

설정이 없으면 존재하는 `typecheck`, `lint`만 선택합니다. 테스트/빌드/`check`는 원하는 스크립트를 명시해야 합니다. 최대 6개이며, 1회 실행 후 끝나는 스크립트를 사용하세요. watch 테스트는 시간 제한으로 종료됩니다. 패키지 매니저는 packageManager 선언 또는 단일 종류의 lockfile로 판별합니다. 불명확하면 추측 실행하지 않습니다.

`--start`/`--url`이 같은 설정을 재정의합니다. URL만 있으면 기존 서버를 사용하고, devScript가 있으면 서버를 시작합니다. 설정의 devScript를 사용하지 않으려면 해당 설정을 제거하세요. 모노레포는 `--cwd apps/web`처럼 앱 루트에서 실행합니다.

## 변경과 검사 범위

`--changed`는 staged/unstaged/untracked/deleted 파일을 HEAD 기준으로 조사합니다. Git 저장소와 기존 HEAD 커밋이 필요합니다. 최대 500개 파일이며 출력이 잘리면 부분 결과로 통과시키지 않고 중단합니다. 생성 폴더와 `.env` 파일은 제외합니다. 변경이 없거나 `.md/.txt/.rst` 문서만 변경되면 명령과 UI 검사를 생략합니다. `--changed`를 빼면 구성한 검사를 항상 실행합니다.

변경된 소스 최대 8개에 AST 영향 분석을 수행해 관련 파일·테스트 후보를 보고서에 남깁니다. 삭제 파일이나 분석 불가 파일은 이유를 기록합니다. **프로젝트 스크립트는 프로젝트 범위로 실행**하며, 후보 파일을 테스트 러너 옵션에 자동 삽입하지 않습니다. Vitest/Jest 등의 서로 다른 필터를 추측해 테스트를 누락하지 않기 위한 현재 구현 범위입니다.

## 서버 관리

직접 실행한 패키지 매니저의 프로세스 그룹만 관리합니다. 로그의 localhost/127.0.0.1/::1 HTTP(S) URL을 읽고 2xx/3xx 응답을 준비 완료로 판단합니다. URL을 출력하지 않는 서버는 `--url`을 명시하세요. 명시한 URL이 이미 준비되어 있으면 새 서버를 시작하지 않고, `--start`를 빼고 재사용하라는 오류를 반환합니다.

완료·실패·Ctrl+C·준비 시간 초과 시 직접 시작한 서버를 종료합니다. POSIX에서는 프로세스 그룹에 TERM 후 KILL을 보내 하위 프로세스도 종료합니다. Windows에서는 직접 자식 종료만 보장하므로 별도 프로세스로 분리하는 서버 스크립트는 지원 범위 밖입니다. 프로세스가 스스로 새 세션으로 분리되는 경우도 자동 정리 범위 밖입니다. 시스템의 다른 PID나 포트를 찾아 종료하지 않습니다.

## 로컬 결과 뷰어

`.oscode/verify-*/index.html`과 `report.json`에 결과가 저장됩니다. `--open`은 macOS/Linux에서 기본 브라우저로 HTML을 엽니다. Windows 또는 열기 실패 시 출력된 경로를 직접 여세요. HTML은 외부 스크립트·분석 서비스를 로드하지 않고 출력 내용을 이스케이프합니다. 인접한 UI 검사 폴더의 스크린샷을 참조하므로 공유할 때 관련 폴더도 함께 보관해야 합니다. 로그와 화면에 앱 데이터가 포함될 수 있습니다.

결과 상태는 passed/failed/skipped/blocked/error로 구분합니다. **skipped는 통과가 아닙니다.** URL 또는 서버가 없으면 브라우저 단계는 skipped입니다. 종료 코드는 0 완료(생략만 있는 실행 포함), 2 검사 실패, 1 승인 차단/실행 오류/취소입니다. JSON status를 함께 확인하세요.

현재 통합 UI 단계는 기본 반응형 화면 검사를 실행합니다. 시나리오·접근성·기준 이미지 옵션은 기존 `oscode ui check` 명령으로 별도 실행하세요. API 모킹·번들 분석·OpenAPI 타입 생성은 이번 통합 기능에 포함되지 않습니다.

## 에이전트

프론트엔드 BUILD에서 `verify_project` 도구를 사용할 수 있습니다. 프로젝트 verify 설정과 동일한 승인 정책을 따르고, 모델에는 단계 상태와 로컬 보고서 경로만 전달합니다. 모델은 보고서 파일이 있다는 이유만으로 생략된 검사를 통과했다고 보고해서는 안 됩니다.
