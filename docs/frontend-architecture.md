# 프론트엔드 아키텍처

OSCODE는 기존 구조를 분석한 뒤 컴포넌트를 배치하도록 돕습니다. 특정 폴더 규칙으로 자동 이전하지 않습니다.

```sh
oscode --cwd ./apps/web --architecture
oscode --agent frontend --plan --prompt '현재 프론트엔드 아키텍처를 분석하고 공통 UI와 데이터 처리의 책임을 정리해줘'
```

`frontend_architecture`는 읽기 전용이며 PLAN에서도 사용 가능합니다. 화면 진입점, 기능 폴더, 공통 UI, 데이터 관련 파일을 분류하고 명시적 client/server 지시문, 상대 경로 import 순환 및 공통 UI에서 화면/기능을 참조하는 후보를 표시합니다. 진단은 API 호출 없이 동작하며 모델이 읽는 출력은 기존 토큰 한도를 따릅니다.

분석은 최대 60파일, 파일당 24,000자, 파일당 import 40개, 간선 300개입니다. 정식 파서/타입 분석이 아닌 휴리스틱입니다. 별칭, re-export, 주석 및 type-only import 때문에 누락/오탐이 있을 수 있고 출력 한도에 의해 요약이 잘릴 수 있습니다. 후보를 소스에서 확인한 뒤 수정해야 합니다.

## 구조가 없는 작은 앱의 출발점

```text
src/
  app/ 또는 pages/       화면·라우팅·전역 Provider 조립
  features/              로그인·검색·결제 등 업무 기능과 기능 전용 UI
  shared/ui/             Button·Dialog·Pagination 등 라이브러리 래퍼
  shared/api/            공통 HTTP 클라이언트
  styles/                디자인 토큰·전역 스타일
```

화면은 기능과 공통 UI를 조립하고, 공통 UI는 데이터와 콜백을 전달받도록 합니다. 공통 Button이 사용자 API를 직접 호출하지 않도록 책임을 나눕니다. 기능별 API·상태·테스트는 해당 feature 가까이에 두고 여러 기능에서 실제로 재사용되는 부분만 shared로 이동합니다. 프로젝트의 기존 Next.js/Vue/Svelte 등 관례가 우선입니다.

MUI ThemeProvider, Ant Design ConfigProvider 같은 테마 구성은 기존 앱 경계를 재사용합니다. 단순 패키지 래핑을 목적으로 모든 컴포넌트를 감쌀 필요는 없으며, 반복되는 디자인·동작 정책이 있을 때 공통 래퍼를 만듭니다. 이전은 기능 단위로 계획하고 import·테스트·화면 검증 범위를 함께 명시하세요.
