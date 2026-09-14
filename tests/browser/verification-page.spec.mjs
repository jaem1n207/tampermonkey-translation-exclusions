import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../../src/prevent-code-translation.user.js', import.meta.url), 'utf8');
import { localeCodes, loadLocale, renderVerification } from '../../scripts/site.mjs';
const assets = new Map(await Promise.all(['language.js', 'site.js', 'verify.js', 'site.css'].map(async name => [name, await readFile(new URL(`../../site/assets/${name}`, import.meta.url), 'utf8')])));

async function openFixture(page, copy) {
    const html = renderVerification(copy);
    await page.route('https://fixture.test/**/assets/*', route => {
        const name = new URL(route.request().url()).pathname.split('/').at(-1);
        return route.fulfill({ contentType: name.endsWith('.css') ? 'text/css' : 'application/javascript', body: assets.get(name) });
    });
    await page.route('https://fixture.test/**/manifest.json', route => route.fulfill({ json: { version: '1.8.1' } }));
    await page.route('https://fixture.test/check/verify', route => route.fulfill({ contentType: 'text/html', body: html }));
    await page.goto('https://fixture.test/check/verify');
}

for (const code of localeCodes) {
    const copy = loadLocale(code);
    test(`${code}: installation check page passes initial and expanded dynamic checks with the userscript`, async ({ page }) => {
        await page.addInitScript(script => { if (window === window.top) (0, eval)(script); }, source);
        await openFixture(page, copy);
        await expect(page.locator('#results .pass')).toHaveCount(6);
        await page.getByRole('button', { name: copy.verify.button }).click();
        await expect(page.locator('#results .pass')).toHaveCount(9);
        await expect(page.locator('#results .fail')).toHaveCount(0);
    });

    test(`${code}: installation check page does not protect its own fixtures when the userscript is absent`, async ({ page }) => {
        await openFixture(page, copy);
        await expect(page.locator('#results .fail')).toHaveCount(4);
        await page.getByRole('button', { name: copy.verify.button }).click();
        await expect(page.locator('#results .fail')).toHaveCount(7);
        await expect(page.locator('#initial-code')).not.toHaveAttribute('translate');
    });

}
