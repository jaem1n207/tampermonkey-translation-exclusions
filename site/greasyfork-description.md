Keep code blocks, inline code, math, keyboard notation, and editors unchanged during full-page translation.

## What it protects

- Code and math elements, explicitly marked code containers, and supported editors.
- New content added by infinite scrolling, “load more,” and lazy loading.
- Accessible Shadow DOM and same-origin iframes, with repair of removed exclusion attributes.

Ordinary page text remains eligible for translation. The script runs locally without sending page contents to a server.

## Getting started

1. Install Tampermonkey, then use **Install this script** above.
2. Enable automatic update checks in Tampermonkey. Installations from Greasy Fork receive updates through Greasy Fork.
3. Reload your pages after installing or updating. Use the [installation check](https://jaem1n207.github.io/tampermonkey-translation-exclusions/verify.html) if protection seems to be missing.

## Limitations

This script adds `translate="no"` and `notranslate` markers. Your translator must honor them. It cannot restore already translated text, interpret unmarked plain text, or protect OCR and canvas content. Some closed shadow roots and sandboxed frames are inaccessible.

The installation check verifies exclusion markers, not compatibility with your translation extension. See [coverage and limitations](https://github.com/jaem1n207/tampermonkey-translation-exclusions/blob/main/docs/coverage.md).

[Source code](https://github.com/jaem1n207/tampermonkey-translation-exclusions) · [Report an issue](https://github.com/jaem1n207/tampermonkey-translation-exclusions/issues)
