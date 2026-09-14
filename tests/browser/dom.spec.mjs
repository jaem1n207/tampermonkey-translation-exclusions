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
