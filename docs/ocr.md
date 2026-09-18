# 이미지와 PDF 읽기

OSCODE는 로컬 Tesseract OCR과 Poppler로 텍스트를 추출합니다. OCR 자체에는 모델 키가 필요하지 않습니다. `/ocr`는 로컬 결과만 표시합니다. `@파일`로 질문하거나 모델이 `read_document`를 호출하면 추출된 텍스트가 선택한 모델에 전달됩니다.

설치:

- macOS: `brew install tesseract tesseract-lang poppler`
- Ubuntu: `sudo apt install tesseract-ocr tesseract-ocr-kor poppler-utils`
- Windows: Tesseract(한국어 `kor` 데이터 포함)와 Poppler를 설치하고 실행 파일 폴더를 PATH에 추가합니다.

사용 예:

```text
/ocr screenshots/login.png
/ocr "docs/요구 사항.pdf"
/ocr {"path":"docs/spec.pdf","start":4,"pages":2,"language":"kor+eng"}
@docs/spec.pdf 요구사항을 정리해줘
@"screenshots/login screen.png" 오류 문구를 설명해줘
/context add docs/spec.pdf
```

지원: PNG, JPEG, WEBP, BMP, TIFF, PDF. TXT·Markdown·소스 코드는 기존 텍스트 파일 첨부를 사용합니다. DOCX, PPTX, HWP는 PDF로 변환해 첨부하세요. 텍스트와 이미지가 한 페이지에 섞인 PDF는 텍스트 레이어만 읽습니다. 이미지 내부 추가 글자, 표 구조, 시각적 디자인 해석은 보장하지 않습니다.

PDF는 기본 첫 3페이지, 호출당 최대 5페이지입니다. 페이지마다 텍스트 레이어가 비어 있으면 OCR로 전환합니다. 기본 OCR 언어는 `kor+eng`이며 설치되지 않은 언어는 안내 오류를 표시합니다. 영어만 설치된 환경은 `/ocr {"path":"image.png","language":"eng"}`로 사용할 수 있습니다.

프로젝트 내부 파일만 허용하며 파일당 최대 20 MiB입니다. 실행당 30초, 추출 프로세스 출력 128 KB 제한을 적용합니다. PDF 변환 이미지는 긴 변을 2400픽셀로 제한합니다. 임시 파일은 완료·실패·취소 시 제거합니다. 동일 콘텐츠·페이지 범위·언어의 결과는 메모리에 최대 8개 캐시하며 파일 변경 시 재추출합니다. 영구 OCR 캐시는 만들지 않습니다.

`@파일` 첨부는 파일당 2,000자로 제한하고 기존 요청 토큰 예산 검사를 적용합니다. 모델의 `read_document` 결과는 기존 도구 출력 한도로 제한됩니다. 추출 결과는 신뢰할 수 없는 문서 데이터로 표시하며, 문서 안의 지시는 사용자 명령으로 취급하지 않습니다. OCR에는 오인식이 있으므로 중요한 값은 원본과 대조하세요.

구현 참고: [Tesseract CLI](https://tesseract-ocr.github.io/tessdoc/Command-Line-Usage.html), [Poppler](https://poppler.freedesktop.org/).
