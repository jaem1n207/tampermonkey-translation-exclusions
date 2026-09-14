// ==UserScript==
// @name         코드 번역 방지
// @namespace    http://tampermonkey.net/
// @version      0.0.0
// @description  에디터 밖의 pre, code 태그에 번역 방지 속성을 추가합니다.
// @author       이재민
// @match        *://*/*
// @run-at       document-end
// @grant        none
// @homepageURL  https://github.com/jaem1n207/tampermonkey-translation-exclusions
// @updateURL    https://jaem1n207.github.io/tampermonkey-translation-exclusions/prevent-code-translation.meta.js
// @downloadURL  https://jaem1n207.github.io/tampermonkey-translation-exclusions/prevent-code-translation.user.js
// ==/UserScript==

(() => {
    'use strict';

    const EDITOR = [
        '[contenteditable=""]',
        '[contenteditable="true" i]',
        '[contenteditable="plaintext-only" i]',
        '.ak-editor-content-area',
        '.tinymce-editor',
        '[data-testid="editor"]',
        '.fabric-editor',
        '.ProseMirror',
    ].join(',');
    // 별도 처리 표시 대신 실제 속성으로 중복 작업을 거릅니다.
    // 사이트별 추가 대상은 이 목록에 명확한 셀렉터로 지정합니다.
    const CONTENT = 'pre, code, div.code-block, span.code-block, div.hljs, span.hljs, [data-code-block], [data-translation-exclude]';
    const TARGET = `:is(${CONTENT}):not(.notranslate[translate="no"])`;

    function mark(element) {
        if (!element.classList.contains('notranslate')) {
            element.classList.add('notranslate');
        }
        if (element.getAttribute('translate') !== 'no') {
            element.setAttribute('translate', 'no');
        }
    }

    function scan(root) {
        if (root.closest(EDITOR)) return;

        if (root.matches(TARGET)) mark(root);
        for (const element of root.querySelectorAll(TARGET)) {
            if (!element.closest(EDITOR)) mark(element);
        }
    }

    let repairs = new WeakMap();
    let resetPending = false;

    function repair(element) {
        if (!element.matches(TARGET) || element.closest(EDITOR)) return;
        const count = repairs.get(element) ?? 0;
        // 페이지가 같은 속성을 계속 지워도 microtask 루프로 화면을 멈추지 않습니다.
        if (count >= 3) return;
        repairs.set(element, count + 1);
        if (!resetPending) {
            resetPending = true;
            setTimeout(() => { repairs = new WeakMap(); resetPending = false; }, 0);
        }
        mark(element);
    }

    new MutationObserver((mutations) => {
        const roots = new Set();
        for (const mutation of mutations) {
            if (mutation.type === 'attributes') {
                if (mutation.target.isConnected) repair(mutation.target);
                continue;
            }
            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE && node.isConnected) {
                    roots.add(node);
                }
            }
        }

        for (const root of roots) {
            // 같은 배치에 부모도 추가됐다면 부모를 탐색할 때 함께 처리합니다.
            let covered = false;
            for (let parent = root.parentElement; parent; parent = parent.parentElement) {
                if (roots.has(parent)) {
                    covered = true;
                    break;
                }
            }
            if (!covered) scan(root);
        }
    }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'translate', 'data-code-block', 'data-translation-exclude'] });

    if (document.documentElement) scan(document.documentElement);
})();
