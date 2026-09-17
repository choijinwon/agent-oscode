# oscode 프로젝트 설정

프로젝트 루트에서 `node bin/oscode.js --init`으로 `oscode.json`을 생성한다. 저장소에 설정을 공유할 수 있지만 API 키는 환경 변수에만 둔다.

```json
{
  "profile": "economy",
  "provider": "anthropic",
  "model": "YOUR_MODEL_ID",
  "budget": 40000,
  "maxInput": 12000,
  "maxOutput": 1500,
  "maxSteps": 8,
  "loopLimit": 3,
  "testCommand": "npm test",
  "permissions": { "write": "ask", "shell": "ask" }
}
```

일반 설정 우선순위는 **CLI → 환경 변수 → 프로젝트 설정 → 프로필 기본값**이다. `profile`은 기본 한도 묶음을 선택하며 프로젝트에 명시된 개별 한도는 유지한다. 예를 들어 설정에 `budget`을 직접 적었다면 `--profile balanced`만으로 그 예산이 바뀌지 않는다. `--budget`으로 직접 바꿀 수 있다.

환경 변수: `OSCODE_PROVIDER`, `OSCODE_MODEL`, `OSCODE_BASE_URL`, `OSCODE_PROFILE`, `OSCODE_BUDGET`, `OSCODE_MAX_INPUT`, `OSCODE_MAX_OUTPUT`, `OSCODE_MAX_STEPS`, `OSCODE_LOOP_LIMIT`. API 키는 `ANTHROPIC_API_KEY` 또는 `OSCODE_API_KEY`다. `.env` 자동 로딩은 하지 않는다.

프로젝트의 `plan: true`와 권한 `deny`는 CLI 자동 허용 옵션으로 해제되지 않는다. `permissions`는 `write`와 `shell`에 `ask` 또는 `deny`만 지원한다. 프로젝트 파일만으로 자동 승인을 활성화할 수 없다. `--yes`와 `--allow-shell`은 사용자가 실행할 때 명시한다. `testCommand`는 자동 실행되지 않으며 `/test`에서 현재 셸 권한에 따라 실행된다.

`baseUrl`은 모델 요청을 보낼 서버를 선택하므로 신뢰하는 주소만 설정한다. `/config` 또는 `--config`로 실제 적용값을 확인할 수 있다.

## 요청별 토큰과 비용 분석

`/usage`는 누적 사용량, 모델별 합계, 입력 구성의 추정량, 최근 5개 요청을 표시한다. `/usage all`과 비대화형 `--usage`는 전체 요청을 표시한다. 입력 구성은 지침·도구 정의·사용자 입력·모델 응답·도구 호출·도구 결과·형식 여유분으로 나눈다. 각 요청에 반복해서 전송한 문맥도 누적하며 API가 보고한 실제 토큰 구성으로 오해하면 안 된다.

단가는 `pricing.<provider>.<exact-model-id>`에 **백만 토큰당 USD**로 설정한다. 다음은 계산 형식 설명용 가상 단가이며 실제 모델 가격이 아니다.

```json
{
  "pricing": {
    "anthropic": {
      "EXAMPLE_MODEL_NOT_A_REAL_PRICE": {
        "input": 2,
        "output": 4,
        "cacheRead": 0.2,
        "cacheWrite": 2.5
      }
    }
  }
}
```

입력 합계에서 캐시 읽기·쓰기를 뺀 일반 입력에 `input` 단가를 적용하고 캐시에는 각각의 단가를 적용한다. 해당 모델 단가가 없거나 실제 사용한 캐시의 단가가 빠져 있으면 비용을 미산정으로 표시한다. 캐시 입력을 이중 계산하지 않는다.

사용량 보고가 없는 응답과 연결 오류는 추정/예약으로 표시한다. 시작한 요청 도중 프로그램이 종료된 경우 재개 시 응답 한도와 입력 추정량을 예약량으로 복원한다. 이는 청구서가 아니며 장문 프롬프트 할증, 공급자별 할인·추가 비용·세금은 계산하지 않는다.

요청 당시 단가를 기록하므로 설정이나 모델을 나중에 바꿔도 과거 비용을 다시 해석하지 않는다. 이전 버전 세션의 요청별 상세 내역은 소급 생성하지 않는다.

## 체크포인트

승인된 파일 도구 변경 전에 원문을 세션에 저장하고, 적용 후 상태를 기록한다. `/checkpoints`에서 ID와 상태를 확인할 수 있다. `/undo`는 최신 미복원 변경 하나를 선택하며 `/undo ID`로 지정할 수 있다.

- 기존 파일: oscode 편집 직전 내용과 파일 모드로 복원한다. 편집 전부터 있던 사용자 변경은 유지한다.
- 새 파일: oscode가 만든 내용과 모드가 그대로일 때만 삭제한다.
- 이후 사용자 변경·모드 변경·심볼릭 링크 교체: 복원을 거절한다.
- 셸 명령으로 만든 변경: 체크포인트에 포함하지 않는다.
- 여러 파일 복원: 각 변경별로 수행한다. 전체 작업을 하나의 원자적 트랜잭션으로 복원하지 않는다.

체크포인트는 OS 샌드박스나 동시 편집 락을 제공하지 않는다. 저장 후 프로세스가 중단된 경우 `prepared`/`undoing` 상태를 현재 내용과 비교해 복구하며, 부분 쓰기처럼 상태를 판별할 수 없으면 덮어쓰지 않는다. 파일 내용이 `.oscode`에 보관되므로 이 폴더를 공개 저장소에 커밋하지 않는다.
