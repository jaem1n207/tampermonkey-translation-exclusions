import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../../src/prevent-code-translation.user.js', import.meta.url), 'utf8');
const settle = page => page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)));
async function install(page, html = '') {
    await page.setContent(html);
    await page.evaluate(script => (0, eval)(script), source);
    await settle(page);
}
async function protectedElement(locator) {
    await expect(locator).toHaveAttribute('translate', 'no');
    await expect(locator).toHaveClass(/(?:^|\s)notranslate(?:\s|$)/);
}

test('initial and dynamically inserted nested code are protected', async ({ page }) => {
    await install(page, '<pre><code id="initial">one()</code></pre><p>ordinary</p>');
    await protectedElement(page.locator('#initial'));
    await page.evaluate(() => {
        document.body.insertAdjacentHTML('beforeend', '<pre><code id="later">two()</code></pre>');
    });
    await protectedElement(page.locator('#later'));
    await expect(page.locator('p')).not.toHaveAttribute('translate');
});

test('separate mutation deliveries are not dropped', async ({ page }) => {
    await install(page);
    await page.evaluate(async () => {
        document.body.insertAdjacentHTML('beforeend', '<code id="first">one()</code>');
        await Promise.resolve();
        document.body.insertAdjacentHTML('beforeend', '<code id="second">two()</code>');
    });
    await protectedElement(page.locator('#first'));
    await protectedElement(page.locator('#second'));
});

test('editor descendants are left untouched', async ({ page }) => {
    await install(page, '<div contenteditable><pre><code id="editor">edit()</code></pre></div>');
    await expect(page.locator('#editor')).not.toHaveAttribute('translate');
});

test('removed translation attributes are repaired without changing text or other classes', async ({ page }) => {
    await install(page, '<code id="code" class="syntax">original()</code>');
    await page.evaluate(() => {
        const node = document.getElementById('code');
        node.classList.remove('notranslate');
        node.removeAttribute('translate');
    });
    await protectedElement(page.locator('#code'));
    await expect(page.locator('#code')).toHaveClass('syntax notranslate');
    await expect(page.locator('#code')).toHaveText('original()');
});

test('virtual list reuse repairs cleared attributes plus replaced text', async ({ page }) => {
    await install(page, '<code id="reused">first()</code>');
    await page.evaluate(() => {
        const node = document.getElementById('reused');
        node.className = 'second-row';
        node.removeAttribute('translate');
        node.textContent = 'second()';
    });
    await protectedElement(page.locator('#reused'));
    await expect(page.locator('#reused')).toHaveText('second()');
});

test('ordinary class changes do not rescan the document', async ({ page }) => {
    await install(page, '<main><code>x()</code></main>');
    const queries = await page.evaluate(async () => {
        let count = 0;
        const original = Element.prototype.querySelectorAll;
        Element.prototype.querySelectorAll = function (...args) { count++; return original.apply(this, args); };
        document.body.className = 'theme-dark';
        await new Promise(resolve => setTimeout(resolve, 0));
        Element.prototype.querySelectorAll = original;
        return count;
    });
    expect(queries).toBe(0);
});

test('competing attribute observers cannot cause an endless microtask loop', async ({ page }) => {
    await install(page, '<code id="code">x()</code>');
    const rejects = await page.evaluate(async () => {
        const node = document.getElementById('code');
        let rejects = 0;
        const competing = new MutationObserver(() => {
            if (node.hasAttribute('translate') && rejects < 50) {
                rejects++;
                node.removeAttribute('translate');
            }
        });
        competing.observe(node, { attributes: true });
        node.removeAttribute('translate');
        await new Promise(resolve => setTimeout(resolve, 0));
        competing.disconnect();
        return rejects;
    });
    expect(rejects).toBeLessThanOrEqual(3);
});


test('explicit div and span code containers are recognized without guessing prose', async ({ page }) => {
    await install(page, '<div class="code-block" id="block">x()</div><span class="hljs" id="highlighted">y()</span><div data-code-block id="data">z()</div><span data-translation-exclude id="custom">identifier</span><p class="highlight language-en" id="prose">ordinary text</p>');
    for (const id of ['block', 'highlighted', 'data', 'custom']) await protectedElement(page.locator(`#${id}`));
    await expect(page.locator('#prose')).not.toHaveAttribute('translate');
});

test('code markers added after insertion trigger protection', async ({ page }) => {
    await install(page, '<div id="class">x()</div><span id="data">y()</span>');
    await page.evaluate(() => {
        document.getElementById('class').classList.add('code-block');
        document.getElementById('data').setAttribute('data-code-block', '');
    });
    await protectedElement(page.locator('#class'));
    await protectedElement(page.locator('#data'));
});


test('a recycled code container restores its original translation setting', async ({ page }) => {
    await install(page, '<div class="code-block" id="reused" translate="yes">x()</div>');
    await protectedElement(page.locator('#reused'));
    await page.evaluate(() => {
        const node = document.getElementById('reused');
        node.classList.remove('code-block');
        node.textContent = 'Ordinary prose after recycling';
    });
    await expect(page.locator('#reused')).toHaveAttribute('translate', 'yes');
    await expect(page.locator('#reused')).not.toHaveClass(/notranslate/);
});

test('recycling preserves translation flags originally supplied by the site', async ({ page }) => {
    await install(page, '<div class="code-block notranslate" translate="no" id="owned">x()</div>');
    await page.evaluate(() => document.getElementById('owned').classList.remove('code-block'));
    await protectedElement(page.locator('#owned'));
});

test('moving protected code into an editor releases only script-owned flags', async ({ page }) => {
    await install(page, '<code id="code">x()</code><div contenteditable id="editor"></div>');
    await page.evaluate(() => document.getElementById('editor').append(document.getElementById('code')));
    await expect(page.locator('#code')).not.toHaveAttribute('translate');
    await expect(page.locator('#code')).not.toHaveClass(/notranslate/);
});


test('semantic symbols, keyboard keys and math renderers retain their original notation', async ({ page }) => {
    await install(page, '<kbd id="keys">Ctrl+C</kbd><samp id="output">ENOENT</samp><var id="variable">x</var><math id="math"><mi>x</mi></math><span class="katex" id="katex">f(x)</span><mjx-container id="mathjax">x+y</mjx-container><p id="ordinary">An ordinary sentence with x and Ctrl+C.</p>');
    for (const id of ['keys', 'output', 'variable', 'math', 'katex', 'mathjax']) await protectedElement(page.locator(`#${id}`));
    await expect(page.locator('#ordinary')).not.toHaveAttribute('translate');
});


test('editor boundaries are protected without rewriting their contents', async ({ page }) => {
    await install(page, '<div contenteditable="true" id="editor"><span>write here</span><code id="code">x()</code></div>');
    await protectedElement(page.locator('#editor'));
    await expect(page.locator('#code')).not.toHaveAttribute('translate');
    await expect(page.locator('#editor span')).not.toHaveAttribute('translate');
});

test('entering and leaving editor mode reconciles existing descendants', async ({ page }) => {
    await install(page, '<section id="host"><code id="code">x()</code></section>');
    for (const [attribute, value] of [['contenteditable', 'true'], ['class', 'ProseMirror'], ['data-testid', 'editor']]) {
        await page.locator('#host').evaluate((node, [attribute, value]) => node.setAttribute(attribute, value), [attribute, value]);
        await protectedElement(page.locator('#host'));
        await expect(page.locator('#code')).not.toHaveAttribute('translate');
        await page.locator('#host').evaluate((node, attribute) => node.removeAttribute(attribute), attribute);
        await expect(page.locator('#host')).not.toHaveAttribute('translate');
        await protectedElement(page.locator('#code'));
    }
});

test('document-start protects parser-added code before DOMContentLoaded without requiring a body', async ({ page }) => {
    const start = /@run-at\s+document-start/.test(source);
    await page.addInitScript(({ source, start }) => {
        if (start) (0, eval)(source);
        else document.addEventListener('DOMContentLoaded', () => (0, eval)(source), { once: true });
    }, { source, start });
    await page.route('https://fixture.test/start', route => route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><code id="early">x()</code><script>queueMicrotask(() => { window.earlyTranslate = document.getElementById("early").getAttribute("translate"); });</script>',
    }));
    await page.goto('https://fixture.test/start');
    expect(await page.evaluate(() => window.earlyTranslate)).toBe('no');
    await protectedElement(page.locator('#early'));
});

test('existing and nested open shadow roots receive initial and dynamic protection', async ({ page }) => {
    await page.setContent('<div id="host"></div>');
    await page.evaluate(() => {
        const root = document.getElementById('host').attachShadow({ mode: 'open' });
        root.innerHTML = '<code id="initial">one()</code><div id="nested"></div>';
        root.getElementById('nested').attachShadow({ mode: 'open' }).innerHTML = '<code id="nested-code">two()</code>';
    });
    await page.evaluate(script => (0, eval)(script), source);
    await protectedElement(page.locator('#initial'));
    await protectedElement(page.locator('#nested-code'));
    await page.locator('#host').evaluate(node => node.shadowRoot.append(Object.assign(document.createElement('code'), { id: 'later', textContent: 'later()' })));
    await protectedElement(page.locator('#later'));
});

test('shadow roots created after installation are tracked without changing native attachShadow behavior', async ({ page }) => {
    await install(page, '<div id="open"></div><div id="closed"></div>');
    const result = await page.evaluate(async () => {
        const open = document.getElementById('open');
        const root = open.attachShadow({ mode: 'open' });
        root.innerHTML = '<code id="late-shadow">open()</code>';
        const closed = document.getElementById('closed');
        const closedRoot = closed.attachShadow({ mode: 'closed' });
        closedRoot.innerHTML = '<code>closed()</code>';
        let nativeError;
        try { open.attachShadow({ mode: 'open' }); } catch (error) { nativeError = error.name; }
        await new Promise(resolve => setTimeout(resolve, 0));
        return { sameRoot: root === open.shadowRoot, closedHidden: closed.shadowRoot === null, closedTranslate: closedRoot.querySelector('code').getAttribute('translate'), nativeError };
    });
    await protectedElement(page.locator('#late-shadow'));
    expect(result).toEqual({ sameRoot: true, closedHidden: true, closedTranslate: 'no', nativeError: 'NotSupportedError' });
});

test('detached shadow hosts and editor boundaries across shadow roots are reconciled on insertion and movement', async ({ page }) => {
    await install(page, '<div id="editor" contenteditable></div>');
    await page.evaluate(async () => {
        const host = document.createElement('div');
        host.id = 'detached';
        host.attachShadow({ mode: 'open' }).innerHTML = '<code id="shadow-code">x()</code>';
        await new Promise(resolve => setTimeout(resolve, 0));
        document.body.append(host);
    });
    await protectedElement(page.locator('#shadow-code'));
    await page.evaluate(() => document.getElementById('editor').append(document.getElementById('detached')));
    await expect(page.locator('#shadow-code')).not.toHaveAttribute('translate');
    await page.locator('#editor').evaluate(node => node.removeAttribute('contenteditable'));
    await protectedElement(page.locator('#shadow-code'));
});

test('repeated installation does not stack attachShadow wrappers', async ({ page }) => {
    await install(page);
    const same = await page.evaluate(script => {
        const before = Element.prototype.attachShadow;
        (0, eval)(script);
        return before === Element.prototype.attachShadow;
    }, source);
    expect(same).toBe(true);
});

test('parser-created declarative open shadow roots are discovered by DOMContentLoaded', async ({ page }) => {
    await page.addInitScript(script => (0, eval)(script), source);
    await page.route('https://fixture.test/declarative', route => route.fulfill({ contentType: 'text/html', body: '<div><template shadowrootmode="open"><code id="declarative">x()</code></template></div>' }));
    await page.goto('https://fixture.test/declarative');
    await protectedElement(page.locator('#declarative'));
});

test('an immutable attachShadow API still allows ordinary DOM and existing open roots', async ({ page }) => {
    await page.setContent('<code id="ordinary">x()</code><div id="host"></div>');
    await page.evaluate(() => {
        document.getElementById('host').attachShadow({ mode: 'open' }).innerHTML = '<code id="existing">y()</code>';
        Object.defineProperty(Element.prototype, 'attachShadow', { writable: false, configurable: false });
    });
    await page.evaluate(script => (0, eval)(script), source);
    await protectedElement(page.locator('#ordinary'));
    await protectedElement(page.locator('#existing'));
});
