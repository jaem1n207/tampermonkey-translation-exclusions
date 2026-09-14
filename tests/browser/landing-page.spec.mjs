import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { localeCodes, loadLocale, renderLanding, renderVerification, localePath } from '../../scripts/site.mjs';

const assets = new Map(await Promise.all(['language.js', 'site.js', 'site.css', 'verify.js'].map(async name => [name, await readFile(new URL(`../../site/assets/${name}`, import.meta.url), 'utf8')])));

async function serve(page, failVersion = false, basePath = '/') {
    await page.route('https://fixture.test/**', route => {
        const path = new URL(route.request().url()).pathname.slice(basePath.length);
        if (path === 'manifest.json') return route.fulfill(failVersion ? { status: 503, body: '' } : { json: { version: '1.8.1' } });
        if (path.startsWith('assets/')) {
            const name = path.slice(7);
            return route.fulfill({ contentType: name.endsWith('.css') ? 'text/css' : 'application/javascript', body: assets.get(name) });
        }
        const code = path.includes('/') ? path.split('/')[0] : 'en';
        const copy = loadLocale(code);
        return route.fulfill({ contentType: 'text/html', body: path.endsWith('verify.html') ? renderVerification(copy) : renderLanding(copy) });
    });
}

for (const code of localeCodes) {
    test(`${code}: readable layout, demo, and language navigation work`, async ({ page }) => {
        const copy = loadLocale(code);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await serve(page);
        await page.goto(`https://fixture.test/${localePath(code)}`);
        await expect(page.locator('html')).toHaveAttribute('lang', code);
        await expect(page.locator('#version')).toHaveText(copy.footer.version.replace('{version}', '1.8.1'));
        for (const width of [320, 768, 1280]) {
            await page.setViewportSize({ width, height: 960 });
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
            await expect(page.locator('.button.primary').first()).toBeVisible();
        }
        const originalCode = await page.locator('.example-code').textContent();
        await page.getByRole('button', { name: copy.demo.original, exact: true }).click();
        await expect(page.locator('#demo-prose')).toHaveText('Find the available products.');
        await page.getByRole('button', { name: copy.demo.translated, exact: true }).click();
        await expect(page.locator('#demo-prose')).toHaveText(copy.demo.targetText);
        await expect(page.locator('.example-code')).toHaveText(originalCode);
        await page.locator('.languages summary').click();
        await page.locator('.languages summary').press('Escape');
        await expect(page.locator('.languages')).not.toHaveAttribute('open');
        await page.locator('.languages summary').click();
        const target = code === 'ja' ? 'en' : 'ja';
        await page.locator(`.languages a[hreflang="${target}"]`).click();
        await expect(page.locator('html')).toHaveAttribute('lang', target);
        expect(errors).toEqual([]);
    });
}

test('version failure leaves installation usable and native navigation works without JavaScript', async ({ page, browser }) => {
    await serve(page, true);
    await page.goto('https://fixture.test/');
    await expect(page.locator('#version')).toHaveText(loadLocale('en').footer.versionError);
    await expect(page.locator('.primary').first()).toHaveAttribute('href', './prevent-code-translation.user.js');
    const context = await browser.newContext({ javaScriptEnabled: false });
    const noJS = await context.newPage();
    await serve(noJS);
    await noJS.goto('https://fixture.test/');
    await expect(noJS.locator('h1')).toContainText('Keep the code.');
    await noJS.locator('.languages summary').click();
    await noJS.locator('.languages a[hreflang="ko"]').click();
    await expect(noJS.locator('html')).toHaveAttribute('lang', 'ko');
    await context.close();
});

async function setPreferences(page, languages, language = languages[0]) {
    await page.addInitScript(({ languages, language }) => {
        Object.defineProperty(navigator, 'languages', { get: () => languages });
        Object.defineProperty(navigator, 'language', { get: () => language });
    }, { languages, language });
}

for (const path of ['', 'index.html', 'verify.html']) {
    test(`Korean preference selects the matching default page: ${path || '/'}`, async ({ page }) => {
        await setPreferences(page, ['ko-KR', 'en-US']);
        const basePath = '/tampermonkey-translation-exclusions/';
        await serve(page, false, basePath);
        await page.goto(`https://fixture.test${basePath}${path}?ref=readme#setup`);
        await expect(page).toHaveURL(`https://fixture.test${basePath}ko/${path === 'verify.html' ? path : ''}?ref=readme#setup`);
        await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
        expect(await page.evaluate(() => localStorage.getItem('prevent-code-translation:language'))).toBeNull();
    });
}

test('language matching respects preference order, regional variants, and English fallback', async ({ browser }) => {
    for (const [languages, expected] of [
        [['fr-FR', 'es-MX', 'en-US'], 'es'],
        [['en-GB', 'ko-KR'], 'en'],
        [['pt-PT', 'en'], 'pt-BR'],
        [['zh-TW', 'en'], 'zh-CN'],
        [['vi-VN'], 'vi'],
        [['JA-jp'], 'ja'],
        [['de-DE', 'fr-FR'], 'en'],
    ]) {
        const context = await browser.newContext();
        const page = await context.newPage();
        await setPreferences(page, languages);
        await serve(page);
        await page.goto('https://fixture.test/');
        await expect(page.locator('html')).toHaveAttribute('lang', expected);
        await context.close();
    }
});

test('manual English and Japanese choices persist across visits and override browser preferences', async ({ page }) => {
    await setPreferences(page, ['ko-KR']);
    await serve(page);
    await page.goto('https://fixture.test/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
    for (const language of ['en', 'ja']) {
        await page.locator('.languages summary').click();
        await page.locator(`.languages a[hreflang="${language}"]`).click();
        await expect(page.locator('html')).toHaveAttribute('lang', language);
        await page.goto('https://fixture.test/');
        await expect(page.locator('html')).toHaveAttribute('lang', language);
    }
});

test('shared localized links keep their language without overwriting a saved choice', async ({ page }) => {
    await setPreferences(page, ['ko-KR']);
    await serve(page);
    await page.goto('https://fixture.test/?lang=en');
    await page.goto('https://fixture.test/ja/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
    await page.goto('https://fixture.test/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('blocked storage still supports detection and manual English throughout setup navigation', async ({ page }) => {
    await setPreferences(page, ['ko-KR']);
    await page.addInitScript(() => {
        Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
    });
    await serve(page);
    await page.goto('https://fixture.test/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
    await page.locator('.languages summary').click();
    await page.locator('.languages a[hreflang="en"]').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await page.getByRole('link', { name: 'Check your installation', exact: false }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('#add')).toBeVisible();
    await page.getByRole('link', { name: 'Install / update', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('invalid saved or URL languages are ignored, and navigator.language covers an empty preference list', async ({ page }) => {
    await setPreferences(page, [], 'ko-KR');
    await page.addInitScript(() => localStorage.setItem('prevent-code-translation:language', 'https://example.com/'));
    await serve(page);
    await page.goto('https://fixture.test/?lang=unsupported');
    await expect(page).toHaveURL('https://fixture.test/ko/?lang=unsupported');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
});
