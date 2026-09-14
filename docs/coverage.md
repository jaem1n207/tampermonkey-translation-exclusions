# Dynamic content coverage

Implementation and validation record as of September 14, 2026. The maintained source is `src/prevent-code-translation.user.js`; use the GitHub Pages link in the README to install. The source version `0.0.0` is a build placeholder.

## Supported situations

| Situation | Handling and conditions |
| --- | --- |
| Infinite scrolling, “load more,” lazy loading, SPA content replacement | Watches added DOM nodes rather than individual UI events. Parent and child additions in the same batch are scanned without duplicate traversal. Replacing the entire `body` is also covered. |
| Revealing hidden content or adding text to empty code elements | Existing targets are protected during the initial scan. Text-only changes do not require rewriting attributes. |
| Removed protection attributes or code elements reused by virtual lists | Repairs changes to `class` and `translate`. When an element becomes ordinary text, restores only attributes owned by this script. |
| Code blocks built from `div` or `span` | Uses explicit markers such as `.code-block`, `.hljs`, `[data-code-block]`, and `[data-translation-exclude]`. Broad markers such as `.highlight` or `.language-en` are excluded because they can also identify prose. |
| Keyboard input, sample output, variables, and math | Protects `kbd`, `samp`, `var`, `math`, `.katex`, `mjx-container`, and `.MathJax`. |
| Editors and elements that become editable later | Protects roots with empty, true, or plaintext-only `contenteditable` values, ProseMirror, and the supported Jira/Confluence editor markers. Leaves descendants untouched except to undo its own earlier changes. Protects code inside again when the editor marker is removed. |
| Code descendants with `translate="yes"` | Protects them while inside code and restores their previous values when they move outside. Editor descendants are excluded from this handling. |
| Existing and nested open Shadow DOM | Discovers roots during the initial scan and when hosts are added, then observes each root. Checks once more at DOMContentLoaded for parser-created declarative open roots. |
| Open or closed roots created by `attachShadow()` after the script starts | Observes the returned root while preserving its mode, return value, and native error behavior. Handles hosts created before attachment and editor boundaries across shadow roots. |
| Same-origin iframes, srcdoc, and about:blank | Observes each document separately and reconnects after each `load`. Includes nested frames and their Shadow DOM. |
| Early execution | Observes `document` at `document-start`, even before `body` exists. Uses neither an arbitrary 100 ms delay nor requestAnimationFrame. |

## Custom targets

Unmarked usernames, hashtags, and identifiers cannot reliably be distinguished from prose. Add a **specific selector** for the site to `CONTENT`, or mark the element with `data-translation-exclude`. Selecting every `span` or an entire comment also excludes its prose from translation.

If targeting depends on a new attribute or class changing dynamically, update both `observe()`'s `attributeFilter` and the boundary checks in `boundaryChanged()`. Additions and removals of the built-in `data-translation-exclude` and `data-code-block` markers are already observed. The old `data-notranslate-processed` marker is no longer needed.

## Limitations and workarounds

| Limitation | Available workaround |
| --- | --- |
| Closed Shadow DOM created before the script runs | No standard API can retrieve these roots from outside. Run as early as possible with `document-start`. New closed roots are tracked only if created through the installed wrapper. |
| A page freezes or replaces attachShadow, or calls a previously saved original | Wraps the API only when it can be changed. Existing open roots can still be discovered, but a new root silently attached to an existing host may be missed. Dynamic declarative roots must also be discoverable through ordinary DOM notifications or the initial scans. |
| Cross-origin or opaque sandboxed iframes | The parent cannot access them. Tampermonkey may run the script independently in frames with matching HTTP(S) URLs and execution permission. This does not cover every sandbox configuration. |
| A site repeatedly removes protection attributes | Repairs an element at most three times in the same event-loop interval to avoid an infinite microtask loop. Continued conflicts can leave it unprotected; adjust the site's behavior or translator settings. There is no background retry polling. |
| A translator captures text first or ignores exclusion attributes | Early execution and attribute repair cannot control the order of extensions. Reload the page and use the translator's exclusion settings. The script does not restore text already translated. |
| Explicit translate=yes inside an editor, or an unsupported editor | Protection depends on the translator honoring the root's exclusion attributes. The script does not modify the editor's internal schema to override nested translation permissions. Use the translator's editor or site exclusion settings when available. |
| OCR, canvas, images, or plain text copied into a desktop app | HTML exclusion attributes do not carry over. Use the tool's exclusion settings or an option to preserve the original text. |

The `attachShadow` wrapper must run in the page's JavaScript realm. Combinations of Tampermonkey execution environments and other extensions modifying the API have not been integration-tested. This script neither replaces a translator nor reverses a website's own language switch.

## Validation evidence

- Node.js 24: 18 unit checks covering release versions, localized metadata, hashes, rollback prevention, locale completeness, safe rendering, and generated publication files.
- Isolated Chromium 153: 70 browser checks using real DOM and MutationObserver behavior. These cover attribute repair, element reuse, editor transitions, initial parsing, Shadow DOM, frame reloads, loop limits, unnecessary ancestor traversal, and positive/negative installation-page checks in all seven languages. They also cover responsive layouts at 320, 768, and 1,280 pixels, language navigation, the illustrative demo, version-fetch failure, navigation without JavaScript, preferred-language routing, and manual language choices with or without browser storage. Motion checks cover interrupted transitions, stable code placement, immediate keyboard behavior, reduced-motion preferences, unavailable animation APIs, and removal of closing language links from focus and the browser accessibility tree.
- The previous regression harness's 16 ordinary-DOM checks also passed against the implementation. It uses native DOM and MutationObserver, with timer and frame waits replaced by controlled queues.
- CI runs the same `npm test` and blocks deployment on failure.
- The installation check page does not add exclusion attributes itself. A negative control confirms that protection checks fail without the userscript.

These are not integration tests on X/Twitter, Instagram, Jira, Confluence, or combinations of DeepL and Google Translate extensions. Reproducing their DOM update patterns does not establish compatibility with those services.

## Performance measurements

The original v0.2 and the expanded implementation at `596a3f7` were compared in the same Chromium 153 environment. Results are medians of nine measured runs after two warm-ups, with alternating execution order. Times sum elapsed callback execution, excluding timer waits, fixture creation, and result assertions. They are not OS CPU time or overall page responsiveness.

| Synthetic input | Original | Expanded implementation |
| --- | ---: | ---: |
| 2,000 code blocks in one container | 3.6 ms | 9.1 ms |
| 2,000 sibling containers added separately | 6.8 ms | 12.0 ms |
| 320 code blocks in containers nested 80 levels deep | 28.7 ms | 3.4 ms |
| 2,000 sibling containers without code | 2.6 ms | 1.7 ms |

Broader coverage increased observation overhead for simple bulk code additions. The fixture with substantial duplicate traversal was about 8.4 times faster; that does not mean every page is faster. The earlier v0.3 report's 44.2-times result came from a different version and run.

The optimization removes repeated ancestor traversal caused by the script's own attribute changes during bulk additions. In a regression check adding 100 pre/code pairs, ancestor traversals fell from 1,001 to at most 200 while every target remained protected. Ordinary theme-class changes do not scan subtrees, and adding 2,000 leaf elements without code makes no querySelectorAll or closest calls. Unprocessed targets are not counted as performance improvements.

[Measurement JSON](generated/benchmark-2026-09-14.json) · [Runnable HTML snapshot](generated/benchmark-2026-09-14.html). The HTML contains the original and modified scripts plus the harness for that revision; it is not an installer. Download it and open it in a browser to rerun the ordinary-DOM regressions and synthetic benchmarks. Use the repository's `npm test` for current behavior checks.

References: [Tampermonkey metadata](https://www.tampermonkey.net/documentation.php), [HTML translate](https://html.spec.whatwg.org/multipage/dom.html#the-translate-attribute), [DOM attachShadow](https://dom.spec.whatwg.org/#dom-element-attachshadow).
