# 구조와 구현 범위

```text
bin/oscode.js       대화 루프, 명령, 권한, 터미널 출력
  ├─ agent.js       도구 반복 실행, 취소, 작업 예산, 완료/중단 상태
  ├─ config.js      프로젝트 설정 검증과 우선순위
  ├─ usage.js       요청별 사용량·입력 구성·설정 단가 비용
  ├─ checkpoints.js 편집 전 상태 저장, 충돌 감지 복원
  ├─ loop-guard.js  동일 결과 반복·연속 실패 차단
  ├─ context.js     추정량, 문맥 정리, 사용량 누적
  ├─ providers.js   Anthropic / Chat Completions 호환 요청·응답 변환
  │   └─ stream.js  SSE 조립과 완료 검증
  ├─ tools.js       파일 탐색·읽기·수정, 셸, 경로 검사
  └─ session.js     프로젝트별 로컬 세션 저장·복원
```

한 번의 사용자 요청이 한 턴이다. 턴 안에서 모델이 도구를 요청하면 실행 결과를 동일한 도구 호출 ID로 전달한다. 모델이 일반 응답으로 마치거나 예산·반복 한도·취소에 도달하면 종료한다. 완료와 중단은 세션에 구분해 저장한다.

엔진 여러 개를 중첩하면 대화와 도구 결과를 중복 전송하기 쉬워 첫 버전은 하나의 도구 실행 루프를 둔다. 공급자는 같은 내부 메시지와 도구 정의를 각 API 스키마로 변환한다. 전체 저장소 인덱싱, 자동 전문가 호출, LLM 기반 자동 요약은 추가 비용 없이도 코딩 흐름이 성립한 뒤 평가할 기능이다.

문맥 정리는 완료된 과거 턴 단위로 먼저 수행해 tool call/result 쌍을 보존한다. 현재 턴이 너무 크면 최근 2개를 제외한 오래된 도구 출력을 순서대로 줄인다. 원문은 모델에 보내지 않는 archive에 남긴다. 이후에도 입력 한도를 초과하면 명시적으로 중단한다.

외부 라이브러리 소스를 복사하거나 원본 엔진을 내장하지 않았다. 기능 설계의 참고점과 실제 연결 API를 구분한다.

| 참고점 | 반영한 기능 | 미포함 |
| --- | --- | --- |
| OpenCode | 모델 공급자 교체, 터미널 작업 흐름 | OpenCode SDK/서버 직접 실행 |
| Pi | 작은 실행 코어, 분리된 도구와 모델 계층 | Pi 런타임·확장 로딩 |
| Claude | 탐색·편집·검증 반복, 캐시, 도구 실행 권한 | Claude Code 내장/계정 로그인 |

## 검증 기준

- 예산이 작은 경우 API 요청 자체를 보내지 않아야 한다.
- API에서 보고한 입력·출력·캐시를 중복 합산하지 않아야 한다.
- 스트리밍이 끊기거나 출력 한도에 도달하면 부분 도구 호출을 실행하지 않아야 한다.
- 파일 편집은 최근에 읽은 파일의 유일한 일치 구간에만 적용해야 한다.
- 취소·오류 후 세션에서 결과와 사용량을 확인할 수 있어야 한다.
- 테스트나 최종 메시지는 실모델 검증을 수행했다고 주장하지 않아야 한다.

## 공식 참고 자료

- [OpenCode](https://opencode.ai/docs/)
- [Pi](https://github.com/earendil-works/pi)
- [Anthropic 도구 호출](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview)
- [Anthropic 프롬프트 캐싱과 사용량 필드](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- [Chat Completions 호환 요청 예시: OpenRouter](https://openrouter.ai/docs/api_reference/overview)

확인일: 2026-09-16. 실제 절감률과 모델별 품질은 아직 측정하지 않았다.

## 0.2 파일 복원과 실행 기록

파일 변경은 prepared → applied, 복원은 undoing → undone 순으로 세션에 기록한다. 편집 전 내용과 모드를 저장하며 Git HEAD나 전체 작업 트리를 되돌리지 않는다. 중단된 세션은 재개할 때 누락된 도구 결과를 unknown으로 채우고 확인되지 않은 요청 사용량을 예약량으로 기록한다.

사용량 분석 데이터와 체크포인트 원문은 모델 문맥에 포함하지 않는다. 복원을 수행했을 때만 짧은 작업 공간 변경 안내를 다음 요청에 넣는다. 설정과 상세 사용법은 [configuration.md](configuration.md)를 참고한다.
