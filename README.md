# Tampermonkey Translation Exclusions

English | [한국어](README.ko.md)

A Tampermonkey userscript that helps keep code, math, and editors untranslated during full-page translation.

**[Install / update](https://jaem1n207.github.io/tampermonkey-translation-exclusions/)** · [Check installation](https://jaem1n207.github.io/tampermonkey-translation-exclusions/verify.html)

## Getting started

1. Open the install link in a browser with Tampermonkey. Update the existing script if already installed, and disable any older duplicate copies.
2. Enable automatic update checks in Tampermonkey. New versions arrive on your configured schedule.
3. Reload the pages you want to use after installing or updating. Use the installation check page if protection seems to be missing.

## Coverage

- Code blocks, inline code, math, keyboard notation, and editors.
- Supported content added by infinite scrolling, “load more,” or lazy loading, with repair of removed translation exclusion attributes.
- Accessible Shadow DOM and same-origin iframes.

The script cannot infer what unmarked plain text means. Translators may ignore exclusion markers, and text that has already been translated cannot be restored. See [detailed coverage and limitations (Korean)](docs/coverage.md).

Report bugs or suggest improvements through [Issues](https://github.com/jaem1n207/tampermonkey-translation-exclusions/issues). External pull requests are not accepted.
