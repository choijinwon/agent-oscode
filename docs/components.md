# UI 라이브러리 컴포넌트 적용

MUI (`mui`), Ant Design (`antd`), Bootstrap (`bootstrap`)의 button, card, alert, pagination, dropdown 스타터를 제공합니다. 라이브러리 소스나 유료 템플릿을 복사하지 않고 OSCODE가 작성한 작은 사용 예제입니다. 조회는 API/네트워크 호출 없이 동작합니다.

```sh
oscode --component mui
oscode --component mui/button
oscode --component antd/pagination
oscode --component bootstrap/dropdown
# 미리보기 확인 후 새 파일 생성: 기존 파일 덮어쓰기 금지
oscode --component mui/button --output ActionButton.jsx --yes
```

MUI/Ant Design 스타터는 JSX, Bootstrap은 HTML입니다. 생성은 파일 변경 승인·프로젝트 권한·체크포인트를 따릅니다. PLAN에서 생성할 수 없습니다. `--output`은 파일만 만들며 설치·화면 연결은 하지 않습니다. 기존 컴포넌트 후보, 선언된 버전, 누락된 패키지와 설정 안내를 함께 표시합니다. 후보는 파일명 기반이므로 기존 래퍼를 소스에서 확인하세요.

프론트엔드 에이전트에 적용할 화면과 동작을 요청하면 `ui_component`로 조회한 뒤 기존 읽기/편집/셸 도구로 연결할 수 있습니다.

```sh
oscode --agent frontend --plan --prompt '기존 사용자 목록 화면에 Ant Design 페이지네이션을 적용할 계획을 만들어줘. 기존 API와 테마를 유지해줘.'
oscode --resume latest --apply-plan
```

설치가 필요하면 프로젝트의 패키지 매니저와 React peer/version 조건을 확인한 뒤 셸 승인을 받습니다. 세 라이브러리를 OSCODE나 사용자 앱에 일괄 설치하지 않습니다. MUI/Ant Design은 React용이며, Bootstrap 예제는 5.x 기준입니다. Bootstrap CSS와 Tailwind reset 순서, 기존 테마/Provider, Next.js 클라이언트·서버 경계를 확인해야 합니다. 콜백·라우팅·페이지 데이터는 사용자 앱에 맞게 연결해야 합니다.

공식 참고: [MUI 설치](https://mui.com/material-ui/getting-started/installation/), [Ant Design](https://ant.design/docs/react/introduce/), [Bootstrap 5.3](https://getbootstrap.com/docs/5.3/getting-started/introduction/).
