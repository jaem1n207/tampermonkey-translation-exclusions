// ==UserScript==
// @name         코드 번역 방지
// @namespace    http://tampermonkey.net/
// @version      0.0.0
// @description  코드·수식·편집기에 번역 제외 속성을 적용하고 동적 콘텐츠와 같은 출처의 프레임을 감시합니다.
// @author       이재민
// @match        *://*/*
// @run-at       document-start
// @grant        none
// @homepageURL  https://github.com/jaem1n207/tampermonkey-translation-exclusions
// @updateURL    https://jaem1n207.github.io/tampermonkey-translation-exclusions/prevent-code-translation.meta.js
// @downloadURL  https://jaem1n207.github.io/tampermonkey-translation-exclusions/prevent-code-translation.user.js
// ==/UserScript==

(() => {
    'use strict';

    const INSTALLED = Symbol.for('jaem1n207.translationExclusions');
    if (document[INSTALLED]) return;

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
    const BOUNDARY_CLASSES = [...EDITOR_CLASSES, 'code-block', 'hljs', 'katex', 'MathJax'];
    const BOUNDARY_CLASS = new RegExp(`(?:^|\\s)(?:${BOUNDARY_CLASSES.join('|')})(?=\\s|$)`);

    const changes = new WeakMap();
    const observed = new WeakSet();
    const captured = new WeakMap();
    const frames = new WeakSet();

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
        if (root.nodeType === Node.ELEMENT_NODE) {
            update(root);
            discover(root);
        }
        if (!root.firstElementChild) return;
        for (const element of root.querySelectorAll(`${CONTENT}, ${EDITOR}, .notranslate, [translate]`)) update(element);
        // Shadow DOM은 일반 자손 검색에 포함되지 않아 추가된 부분에서 호스트도 찾습니다.
        for (const element of root.querySelectorAll('*')) discover(element);
    }

    function discover(element) {
        if (element.localName === 'iframe') watchFrame(element);
        const shadow = element.shadowRoot ?? captured.get(element);
        if (shadow) {
            if (observed.has(shadow)) scan(shadow);
            else observe(shadow);
        }
    }

    function watchFrame(frame) {
        if (!frames.has(frame)) {
            frames.add(frame);
            frame.addEventListener('load', () => watchFrame(frame));
        }
        // 다른 출처와 opaque sandbox 문서는 부모에서 접근하지 않습니다.
        const doc = frame.contentDocument;
        if (doc) watchDocument(doc);
    }

    function closestMatch(element, selector) {
        for (let current = element; current; current = current.getRootNode().host) {
            const match = current.closest(selector);
            if (match) return match;
        }
        return null;
    }

    let repairs = new WeakMap();
    let resetPending = false;

    function update(element) {
        const content = element.matches(CONTENT);
        if (!content && !changes.has(element) && !element.hasAttribute('translate') && !element.matches(EDITOR)) return;
        const editor = closestMatch(element, EDITOR);
        const nestedOverride = !content && !editor && (element.hasAttribute('translate') || changes.has(element))
            && closestMatch(element.parentElement ?? element.getRootNode().host, CONTENT);
        if (editor ? editor !== element : !content && !nestedOverride) {
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

    function boundaryChanged(mutation) {
        const before = mutation.oldValue;
        const after = mutation.target.getAttribute(mutation.attributeName);
        if (mutation.attributeName === 'contenteditable') {
            const editable = value => value !== null && ['', 'true', 'plaintext-only'].includes(value.toLowerCase());
            return editable(before) !== editable(after);
        }
        if (mutation.attributeName === 'data-testid') return (before === 'editor') !== (after === 'editor');
        if (['data-code-block', 'data-translation-exclude'].includes(mutation.attributeName)) return (before !== null) !== (after !== null);
        if (mutation.attributeName !== 'class') return false;
        if (!BOUNDARY_CLASS.test(before ?? '') && !BOUNDARY_CLASS.test(after ?? '')) return false;
        const oldClasses = new Set((before ?? '').split(/\s+/));
        return BOUNDARY_CLASSES.some(name => oldClasses.has(name) !== mutation.target.classList.contains(name));
    }

    function handleMutations(mutations) {
        const roots = new Set();
        for (const mutation of mutations) {
            if (mutation.type === 'attributes') {
                if (mutation.target.isConnected) {
                    // 편집기·코드 경계가 바뀔 때만 기존 자손도 다시 판정합니다.
                    if (boundaryChanged(mutation)) roots.add(mutation.target);
                    // 자체 속성 쓰기로 생긴 알림은 조상을 다시 탐색할 필요가 없습니다.
                    else if (!mutation.target.matches(PROTECTED)) update(mutation.target);
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
    }

    function observe(root) {
        if (observed.has(root)) return;
        observed.add(root);
        // 루트별 observer를 사용해 제거된 Shadow DOM을 전역 observer에 붙잡아 두지 않습니다.
        new MutationObserver(handleMutations).observe(root, {
            childList: true, subtree: true, attributes: true, attributeOldValue: true,
            attributeFilter: ['class', 'translate', 'contenteditable', 'data-testid', 'data-code-block', 'data-translation-exclude'],
        });
        scan(root);
    }

    function watchDocument(doc) {
        if (doc[INSTALLED] || !doc.defaultView) return;
        Object.defineProperty(doc, INSTALLED, { value: true });
        const prototype = doc.defaultView.Element.prototype;
        const descriptor = Object.getOwnPropertyDescriptor(prototype, 'attachShadow');
        if (descriptor && (descriptor.writable || descriptor.configurable)) {
            Object.defineProperty(prototype, 'attachShadow', {
                ...descriptor,
                value: function attachShadow(...args) {
                    const root = Reflect.apply(descriptor.value, this, args);
                    // mode를 바꾸지 않고 새 closed root의 반환값도 추적합니다.
                    captured.set(this, root);
                    observe(root);
                    return root;
                },
            });
        }
        observe(doc);
        if (doc.readyState === 'loading') {
            // 파서가 생성한 declarative open Shadow DOM도 로드 종료 시 한 번 수집합니다.
            doc.addEventListener('DOMContentLoaded', () => scan(doc), { once: true });
        }
    }

    watchDocument(document);
})();
