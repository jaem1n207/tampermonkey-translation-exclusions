import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../../src/prevent-code-translation.user.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../../site/verify.html', import.meta.url), 'utf8');

async function openFixture(page) {
    await page.route('https://fixture.test/verify', route => route.fulfill({ contentType: 'text/html', body: html }));
    await page.goto('https://fixture.test/verify');
}

test('installation check page passes initial and expanded dynamic checks with the userscript', async ({ page }) => {
    await page.addInitScript(script => { if (window === window.top) (0, eval)(script); }, source);
    await openFixture(page);
    await expect(page.locator('#results .pass')).toHaveCount(6);
    await page.getByRole('button', { name: '더보기 · 동적 코드 추가' }).click();
    await expect(page.locator('#results .pass')).toHaveCount(9);
    await expect(page.locator('#results .fail')).toHaveCount(0);
});

test('installation check page does not protect its own fixtures when the userscript is absent', async ({ page }) => {
    await openFixture(page);
    await expect(page.locator('#results .fail')).toHaveCount(4);
    await page.getByRole('button', { name: '더보기 · 동적 코드 추가' }).click();
    await expect(page.locator('#results .fail')).toHaveCount(7);
    await expect(page.locator('#initial-code')).not.toHaveAttribute('translate');
});
