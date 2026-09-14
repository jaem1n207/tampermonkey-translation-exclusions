# Tampermonkey Translation Exclusions

[English](README.md) | 한국어

웹페이지 전체 번역에서 코드·수식·편집기를 제외해 원문을 유지하도록 돕는 Tampermonkey 스크립트입니다.

**[설치 / 업데이트](https://jaem1n207.github.io/tampermonkey-translation-exclusions/ko/)** · [Greasy Fork](https://greasyfork.org/ko/scripts/595754-prevent-code-translation) · [설치 동작 확인](https://jaem1n207.github.io/tampermonkey-translation-exclusions/ko/verify.html)

## 사용 방법

1. Tampermonkey가 설치된 브라우저에서 위 설치 링크를 엽니다. 이미 설치했다면 새로 설치하기 전에 기존 항목의 **업데이트 확인**을 실행하세요.
2. Tampermonkey의 자동 업데이트 확인을 켭니다. 새 버전은 설치한 배포처를 통해 설정된 주기에 따라 반영됩니다.
3. 설치·업데이트 후 사용할 페이지를 새로고침합니다. 동작이 의심되면 위 확인 페이지에서 검사하세요.

## 지원 범위

- 코드 블록·인라인 코드, 수식, 키 입력 표기와 편집기.
- 무한 스크롤·더보기·지연 로딩으로 추가되는 대상과 삭제된 번역 제외 속성의 복구.
- 접근 가능한 Shadow DOM과 같은 출처의 iframe.

표식 없는 일반 텍스트의 의미는 자동 판별하지 않습니다. 번역기가 제외 표시를 무시하면 번역될 수 있으며, 이미 번역된 원문을 복원하지는 않습니다. [자세한 지원 조건과 제한 사항(영문)](docs/coverage.md)을 확인하세요.

오류 신고와 개선 제안은 [Issue](https://github.com/jaem1n207/tampermonkey-translation-exclusions/issues)로 받습니다. 외부 PR은 받지 않습니다.
