# Tampermonkey Translation Exclusions

웹페이지 전체 번역 시 코드·수식·키 입력 표기와 편집기에 `class="notranslate"`와 `translate="no"`를 추가합니다. 일반 문장은 번역 대상으로 유지합니다. 작성자는 **이재민**이며 UserScript 메타데이터는 UTF-8 한글을 사용합니다.

[설치 및 현재 버전](https://jaem1n207.github.io/tampermonkey-translation-exclusions/) · [UserScript 설치](https://jaem1n207.github.io/tampermonkey-translation-exclusions/prevent-code-translation.user.js) · [설치 동작 확인](https://jaem1n207.github.io/tampermonkey-translation-exclusions/verify.html)

## 설치와 자동 업데이트

1. Tampermonkey가 설치된 브라우저에서 위 UserScript 설치 링크를 엽니다.
2. 기존 `코드 번역 방지` 스크립트의 업데이트로 설치합니다. 이전 이름의 별도 스크립트가 있다면 비활성화해 중복 실행을 피합니다.
3. Tampermonkey 설정의 스크립트 업데이트 확인 주기를 활성화합니다. 개별 스크립트의 업데이트 확인도 켜져 있어야 합니다.
4. 설치 동작 확인 페이지를 새로고침하고 **더보기 · 동적 코드 추가** 버튼을 눌러 코드·편집기·수식·속성 복구·Shadow DOM·iframe의 보호 여부를 확인합니다.

`main` push → 테스트 → 버전 생성 → GitHub Pages 배포 → 공개 파일 검증 순서로 실행됩니다. 이후 Tampermonkey가 설정된 주기에 따라 업데이트를 받습니다. push 시점과 설치 시점은 다를 수 있으며, 열려 있던 페이지에는 새로고침 후 새 코드가 적용됩니다. 업데이트 설정과 권한 변경에 따라 설치 확인이 필요할 수 있습니다.

## 유지보수

실행 코드는 `src/prevent-code-translation.user.js`를 수정합니다. 소스의 `@version 0.0.0`은 빌드용 자리표시자이므로 직접 올리지 않습니다.

버전은 Actions의 `GITHUB_RUN_NUMBER`와 `GITHUB_RUN_ATTEMPT`로 만든 **`1.실행번호.재시도번호`**입니다. 새 push마다 실행번호가 증가하고, 같은 실행의 재시도에서는 마지막 숫자가 증가합니다. PR은 검사·빌드만 수행합니다. `main` push 및 `main`의 수동 실행만 배포할 수 있습니다. 중간 버전 번호가 건너뛰어도 정상입니다.

설치 주소와 업데이트 메타데이터 주소는 고정되어 있습니다. `.meta.js`와 `.user.js`는 같은 빌드에서 생성되며, `manifest.json`에 소스 커밋과 파일 SHA-256을 기록합니다. 배포 파일은 `dist/`에 생성되고 Git에는 커밋하지 않습니다. 개인 액세스 토큰이나 별도 배포 시크릿은 필요하지 않습니다.

과거 실행 재시도로 최신 배포를 되돌리지 않도록 현재 `main` 커밋과 기존 공개 버전을 검사합니다. 복구가 필요하면 해당 변경을 **새 커밋으로 revert**해 `main`에 push하세요. 새 버전으로 배포됩니다. 버전 번호가 workflow 실행 번호에 의존하므로 `publish.yml`을 새 workflow로 교체하거나 이력을 초기화할 때는 버전 정책을 함께 검토해야 합니다.

## 로컬 검사

Node.js 24 이상을 사용합니다. 스크립트 실행 자체에는 외부 라이브러리가 없으며, 개발 검사는 고정 버전의 Playwright와 Chromium을 사용합니다.

```sh
npm ci
export PLAYWRIGHT_BROWSERS_PATH=./work/browsers
npx playwright install chromium
npm test
GITHUB_RUN_NUMBER=1 GITHUB_RUN_ATTEMPT=1 GITHUB_SHA=$(git rev-parse HEAD) npm run build
npm run verify:deployment
```

Linux CI는 `npx playwright install --with-deps chromium`으로 브라우저의 시스템 의존성도 설치합니다. `npm run test:unit`은 배포 로직, `npm run test:browser`는 실제 DOM과 설치 확인 페이지를 검사합니다.

마지막 명령은 실제 공개된 메타데이터·스크립트의 주소, 버전, 소스 커밋 형식, 해시, JavaScript 문법을 검사합니다. 설치된 Tampermonkey의 업데이트 스케줄러까지 실행하는 검사는 아닙니다.

## 업데이트 연결 확인

1. 설치 페이지에 표시된 버전으로 스크립트를 한 번 설치하고, Tampermonkey에서 같은 버전인지 확인합니다.
2. 소스나 문서를 수정해 `main`에 push합니다. 버전 숫자는 수정하지 않습니다.
3. Actions의 `Verify and publish userscript`가 성공하면 설치 페이지와 `manifest.json`의 버전이 증가했는지 확인합니다.
4. Tampermonkey에서 **업데이트 확인**을 실행해 같은 설치 항목의 버전이 증가했는지 확인합니다. 수동 확인은 주기 대기 시간을 줄이기 위한 절차이며, 이후에는 설정한 주기에 따라 확인합니다.
5. 설치 동작 확인 페이지를 새로고침하고 초기·동적 코드가 모두 통과하는지 확인합니다.

버전이 바뀌지 않으면 설치 항목의 `@updateURL`이 이 저장소의 Pages `.meta.js` 주소인지, 업데이트 확인이 활성화되어 있는지 확인하세요. 브라우저가 닫혀 있거나 배포/CDN 반영을 기다리는 동안은 갱신이 늦을 수 있습니다. 개발 중인 `src/` 파일 대신 설치 페이지의 배포 파일을 사용하세요.

## 처리 범위

- `pre`, `code`, `kbd`, `samp`, `var`, MathML, KaTeX·MathJax 표시.
- `div/span.code-block`, `div/span.hljs`, `[data-code-block]`, `[data-translation-exclude]`처럼 명확한 표식이 있는 영역.
- 무한 스크롤·더보기·lazy-load·SPA 교체, 속성만 삭제되는 경우와 가상 목록의 요소 재사용.
- 편집기 루트 보호. 편집기 내부에는 새 속성을 붙이지 않으며, 편집 모드 진입·해제 시 직접 붙였던 속성만 정리합니다.
- 기존 open Shadow DOM과 실행 후 `attachShadow()`로 생성된 open/closed 루트, 중첩 루트.
- 같은 출처의 iframe·srcdoc·about:blank와 프레임 재로딩. 다른 출처는 해당 프레임에서 Tampermonkey가 별도로 실행돼야 합니다.

정확한 조건·미지원 상황·검증 근거는 [동적 콘텐츠 대응 범위](docs/coverage.md)에 정리했습니다. 표식 없는 사용자명·해시태그·일반 `div/span`의 의미는 추측하지 않습니다. 필요한 요소를 소스의 `CONTENT` 셀렉터에 추가하거나 `[data-translation-exclude]`로 표시할 수 있습니다.

모든 번역기의 제외 속성 준수, 이미 번역된 원문 복원, 스크립트 실행 전에 생성된 closed Shadow DOM, OCR·데스크톱 앱으로 복사된 텍스트는 보장하지 않습니다. 사이트가 속성을 계속 지우면 화면 정지를 막기 위해 같은 이벤트 루프 구간의 복구 횟수를 제한합니다.

성능도 [측정 결과](docs/coverage.md#성능-측정)에서 확인하세요. 지원 범위가 넓어진 만큼 단순 코드 대량 삽입에는 감시 비용이 추가되며, 모든 페이지에서 더 빠르다고 주장하지 않습니다.

## 배포 설정

GitHub Pages의 Source는 **GitHub Actions**입니다. 공식 Actions는 커밋 SHA로 고정하고, 빌드는 `contents: read`, 배포 작업만 `pages: write`와 `id-token: write`를 사용합니다. 실패한 테스트는 새 배포를 막고, 배포 후 검증 실패는 Actions 실행을 실패로 표시합니다.

참고: [Tampermonkey 업데이트 메타데이터](https://www.tampermonkey.net/documentation.php?locale=en&q=update_url), [GitHub Pages 워크플로](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [Actions 실행 번호](https://docs.github.com/en/actions/reference/workflows-and-actions/variables).
