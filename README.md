# Tampermonkey Translation Exclusions

웹페이지 전체 번역 시 에디터 밖의 `pre`·`code` 태그에 `class="notranslate"`와 `translate="no"`를 추가합니다.

[설치 및 현재 버전](https://jaem1n207.github.io/tampermonkey-translation-exclusions/) · [UserScript 설치](https://jaem1n207.github.io/tampermonkey-translation-exclusions/prevent-code-translation.user.js) · [설치 동작 확인](https://jaem1n207.github.io/tampermonkey-translation-exclusions/verify.html)

## 설치와 자동 업데이트

1. Tampermonkey가 설치된 브라우저에서 위 UserScript 설치 링크를 엽니다.
2. 기존 `코드 번역 방지` 스크립트의 업데이트로 설치합니다. 이전 이름의 별도 스크립트가 있다면 비활성화해 중복 실행을 피합니다.
3. Tampermonkey 설정의 스크립트 업데이트 확인 주기를 활성화합니다. 개별 스크립트의 업데이트 확인도 켜져 있어야 합니다.
4. 설치 동작 확인 페이지를 새로고침하고 **더보기 · 동적 코드 추가** 버튼을 눌러 초기·동적 코드의 보호 여부를 확인합니다.

`main` push → 테스트 → 버전 생성 → GitHub Pages 배포 → 공개 파일 검증 순서로 실행됩니다. 이후 Tampermonkey가 설정된 주기에 따라 업데이트를 받습니다. push 시점과 설치 시점은 다를 수 있으며, 열려 있던 페이지에는 새로고침 후 새 코드가 적용됩니다. 업데이트 설정과 권한 변경에 따라 설치 확인이 필요할 수 있습니다.

## 유지보수

실행 코드는 `src/prevent-code-translation.user.js`를 수정합니다. 소스의 `@version 0.0.0`은 빌드용 자리표시자이므로 직접 올리지 않습니다.

버전은 Actions의 `GITHUB_RUN_NUMBER`와 `GITHUB_RUN_ATTEMPT`로 만든 **`1.실행번호.재시도번호`**입니다. 새 push마다 실행번호가 증가하고, 같은 실행의 재시도에서는 마지막 숫자가 증가합니다. PR은 검사·빌드만 수행합니다. `main` push 및 `main`의 수동 실행만 배포할 수 있습니다. 중간 버전 번호가 건너뛰어도 정상입니다.

설치 주소와 업데이트 메타데이터 주소는 고정되어 있습니다. `.meta.js`와 `.user.js`는 같은 빌드에서 생성되며, `manifest.json`에 소스 커밋과 파일 SHA-256을 기록합니다. 배포 파일은 `dist/`에 생성되고 Git에는 커밋하지 않습니다. 개인 액세스 토큰이나 별도 배포 시크릿은 필요하지 않습니다.

과거 실행 재시도로 최신 배포를 되돌리지 않도록 현재 `main` 커밋과 기존 공개 버전을 검사합니다. 복구가 필요하면 해당 변경을 **새 커밋으로 revert**해 `main`에 push하세요. 새 버전으로 배포됩니다. 버전 번호가 workflow 실행 번호에 의존하므로 `publish.yml`을 새 workflow로 교체하거나 이력을 초기화할 때는 버전 정책을 함께 검토해야 합니다.

## 로컬 검사

Node.js 24 이상을 사용합니다. 외부 npm 의존성은 없습니다.

```sh
npm test
GITHUB_RUN_NUMBER=1 GITHUB_RUN_ATTEMPT=1 GITHUB_SHA=$(git rev-parse HEAD) npm run build
npm run verify:deployment
```

마지막 명령은 실제 공개된 메타데이터·스크립트의 주소, 버전, 소스 커밋 형식, 해시, JavaScript 문법을 검사합니다. 설치된 Tampermonkey의 업데이트 스케줄러까지 실행하는 검사는 아닙니다.

## 처리 범위

- 초기 DOM, 무한 스크롤·더보기·lazy-load로 추가된 일반 DOM의 `pre`·`code`.
- 기존 숨겨진 코드와 텍스트만 교체되는 코드.
- 에디터 내부는 변경하지 않으며, 에디터 전체의 번역을 막는 것은 아닙니다.
- 사이트가 보호 속성만 제거하는 경우 자동 복구하지 않습니다.
- Shadow DOM, 일반 `div/span`으로 표현된 코드, 사용자명·해시태그·수식 등은 자동 판별하지 않습니다.
- iframe은 그 프레임에도 Tampermonkey가 스크립트를 실행해야 합니다.
- 번역 제외 속성을 따르지 않는 번역기나 먼저 번역된 내용의 원문 복원은 지원하지 않습니다.

## 배포 설정

GitHub Pages의 Source는 **GitHub Actions**입니다. 공식 Actions는 커밋 SHA로 고정하고, 빌드는 `contents: read`, 배포 작업만 `pages: write`와 `id-token: write`를 사용합니다. 실패한 테스트는 새 배포를 막고, 배포 후 검증 실패는 Actions 실행을 실패로 표시합니다.

참고: [Tampermonkey 업데이트 메타데이터](https://www.tampermonkey.net/documentation.php?locale=en&q=update_url), [GitHub Pages 워크플로](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [Actions 실행 번호](https://docs.github.com/en/actions/reference/workflows-and-actions/variables).
