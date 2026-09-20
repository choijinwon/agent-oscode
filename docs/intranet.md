# 폐쇄망·내부 LLM 연결 (최신 소스)

OpenAI Chat Completions 호환 API를 제공하는 사내 서버를 직접 지정합니다. 외부 모델 목록 조회나 클라우드 주소로의 자동 대체 없이 지정한 주소에 요청합니다. vLLM·Ollama 등의 호환 API 서버를 대상으로 하며 실제 모델명은 서버 관리자가 제공하는 값을 사용하세요. 모든 모델이 도구 호출을 지원하는 것은 아닙니다.

## 실행

```sh
node bin/oscode.js --intranet --base-url http://10.0.0.10:8000/v1 --model your-model
```

채팅 중 설정할 수도 있습니다.

```text
/intranet {"baseUrl":"http://10.0.0.10:8000/v1","model":"your-model"}
/intranet check
```

`check`는 프로젝트 코드와 대화 기록 없이 짧은 테스트 요청을 보냅니다. 서버 자원을 사용하며 텍스트 응답 수신만 확인합니다. 도구 호출 능력과 실제 수정 품질은 별도로 확인해야 합니다. 대화 중 설정은 현재 세션에만 적용합니다. 영구 설정은 프로젝트의 `oscode.json`에 기존 설정과 함께 넣으세요.

```json
{
  "provider": "compatible",
  "intranet": true,
  "baseUrl": "https://llm.company.internal/v1",
  "model": "your-model",
  "intranetStream": false
}
```

기본은 비스트리밍이며 `stream_options`를 보내지 않습니다. 서버가 SSE를 지원하면 `intranetStream: true`를 설정할 수 있습니다. 모델이 지원하지 않는 tools 요청이 거절되면 서버의 tool-calling 설정과 모델 지원 여부를 확인하세요.

## 인증·인증서

인증 없는 서버는 키를 설정하지 않아도 됩니다. 인증이 필요한 경우 OSCODE 실행 전에 `OSCODE_INTRANET_API_KEY` 환경변수를 설정하세요. 이 모드는 `OSCODE_API_KEY`, `ANTHROPIC_API_KEY`, 외부 서비스의 저장된 키를 사용하지 않습니다. `/key` 대신 전용 환경변수를 사용합니다.

내부 CA가 필요하면 OSCODE 실행 전에 `NODE_EXTRA_CA_CERTS=/path/to/company-ca.pem`을 설정합니다. TLS 검증을 끄지 않습니다. HTTP는 내부 모드에서 명시한 주소에 허용되지만 평문 전송이므로 조직 정책에 맞는 주소를 사용하세요. 사용자 정보·쿼리·프래그먼트가 있는 주소는 거부하며 리다이렉트를 따라가지 않습니다.

## 폐쇄망 운영 범위

이 기능은 **LLM 연결 설정**입니다. DNS·방화벽이나 전체 프로세스의 외부 통신을 차단하는 기능이 아닙니다. 입력한 주소가 실제 내부 서버인지 운영자가 확인해야 합니다. MCP 서버, 셸 명령, 브라우저 검사, 자동 미리보기는 별도 도구이며 각각의 네트워크 사용 정책을 적용해야 합니다. 완전한 망 분리는 운영 환경에서 강제하세요.

폐쇄망에서는 npm·npx로 외부 패키지를 처음 내려받을 수 없습니다. 동일 OS·CPU·Node 버전의 준비 환경에서 OSCODE와 필요한 의존성·브라우저 바이너리를 확보한 뒤 조직의 반입 절차를 따르세요. 모델 서버와 모델 파일도 별도로 준비해야 합니다. 이 기능은 모델 설치나 서버 배포를 수행하지 않습니다.

npm 0.10.0 이후 소스에 추가된 기능입니다.

참고: [vLLM 호환 서버](https://docs.vllm.ai/en/latest/serving/online_serving/openai_compatible_server/), [Ollama 호환 API](https://github.com/ollama/ollama/blob/main/docs/api/openai-compatibility.mdx).
