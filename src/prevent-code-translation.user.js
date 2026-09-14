// ==UserScript==
// @name         Prevent Code Translation
// @namespace    http://tampermonkey.net/
// @version      0.0.0
// @description  Mark code, math, and editors as non-translatable, including dynamic content and same-origin frames.
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
    // Use the actual attributes to skip duplicate work, without a processed marker.
    // Add explicit selectors here for site-specific targets.
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
        // When an element is repurposed, undo only our changes and preserve the site's original values.
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
        // Ordinary queries do not cross shadow roots; discover hosts within the added subtree.
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
        // Cross-origin and opaque sandbox documents are not accessible from the parent.
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
        // Bound repairs so a competing observer cannot trap the page in a microtask loop.
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
                    // Rescan existing descendants only when an editor or code boundary changes.
                    if (boundaryChanged(mutation)) roots.add(mutation.target);
                    // Our own attribute writes do not need another ancestor walk.
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
            // An added ancestor already covers this node in the same batch.
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
        // Use a separate observer per root so a global observer does not retain removed shadow trees.
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
                    // Track returned closed roots without changing their mode.
                    captured.set(this, root);
                    observe(root);
                    return root;
                },
            });
        }
        observe(doc);
        if (doc.readyState === 'loading') {
            // Collect parser-created declarative open shadow roots once at the end of loading.
            doc.addEventListener('DOMContentLoaded', () => scan(doc), { once: true });
        }
    }

    watchDocument(document);
})();
