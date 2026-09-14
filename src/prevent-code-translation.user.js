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

    const EDITOR_CLASSES = ['ak-editor-content-area', 'tinymce-editor', 'fabric-editor', 'ProseMirror'];
    const EDITOR = [
        '[contenteditable=""]',
        '[contenteditable="true" i]',
        '[contenteditable="plaintext-only" i]',
        '[data-testid="editor"]',
        ...EDITOR_CLASSES.map(name => `.${name}`),
    ].join(',');
    // 별도 처리 표시 대신 실제 속성으로 중복 작업을 거릅니다.
    // 사이트별 추가 대상은 이 목록에 명확한 셀렉터로 지정합니다.
    const CONTENT = [
        'pre', 'code', 'kbd', 'samp', 'var', 'math',
        'div.code-block', 'span.code-block', 'div.hljs', 'span.hljs',
        '[data-code-block]', '[data-translation-exclude]',
        '.katex', 'mjx-container', '.MathJax',
    ].join(',');
    const PROTECTED = '.notranslate[translate="no"]';

    const changes = new WeakMap();

    function mark(element) {
        const saved = changes.get(element) ?? { classAdded: false, translate: undefined };
        changes.set(element, saved);
        if (!element.classList.contains('notranslate')) {
            saved.classAdded = true;
            element.classList.add('notranslate');
        }
        if (element.getAttribute('translate') !== 'no') {
            if (saved.translate === undefined) saved.translate = element.getAttribute('translate');
            element.setAttribute('translate', 'no');
        }
    }

    function restore(element) {
        const saved = changes.get(element);
        if (!saved) return;
        changes.delete(element);
        // 용도가 바뀌면 직접 추가한 값만 되돌리고 사이트의 기존 값은 보존합니다.
        if (saved.classAdded) element.classList.remove('notranslate');
        if (saved.translate !== undefined && element.getAttribute('translate') === 'no') {
            if (saved.translate === null) element.removeAttribute('translate');
            else element.setAttribute('translate', saved.translate);
        }
    }

    function scan(root) {
        update(root);
        for (const element of root.querySelectorAll(`${CONTENT}, ${EDITOR}, .notranslate, [translate]`)) update(element);
    }

    let repairs = new WeakMap();
    let resetPending = false;

    function update(element) {
        const editor = element.closest(EDITOR);
        if (editor ? editor !== element : !element.matches(CONTENT)) {
            restore(element);
            return;
        }
        if (element.matches(PROTECTED)) return;
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

    function editorChanged(mutation) {
        const before = mutation.oldValue;
        const after = mutation.target.getAttribute(mutation.attributeName);
        if (mutation.attributeName === 'contenteditable') {
            const editable = value => value !== null && ['', 'true', 'plaintext-only'].includes(value.toLowerCase());
            return editable(before) !== editable(after);
        }
        if (mutation.attributeName === 'data-testid') return (before === 'editor') !== (after === 'editor');
        if (mutation.attributeName !== 'class') return false;
        const oldClasses = new Set((before ?? '').split(/\s+/));
        return EDITOR_CLASSES.some(name => oldClasses.has(name) !== mutation.target.classList.contains(name));
    }

    new MutationObserver((mutations) => {
        const roots = new Set();
        for (const mutation of mutations) {
            if (mutation.type === 'attributes') {
                if (mutation.target.isConnected) {
                    // 편집기 경계가 바뀔 때만 기존 자손도 다시 판정합니다.
                    if (editorChanged(mutation)) roots.add(mutation.target);
                    else update(mutation.target);
                }
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
    }).observe(document, { childList: true, subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['class', 'translate', 'contenteditable', 'data-testid', 'data-code-block', 'data-translation-exclude'] });

    if (document.documentElement) scan(document.documentElement);
})();
