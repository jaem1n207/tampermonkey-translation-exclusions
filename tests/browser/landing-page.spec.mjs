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
            const codeTop = () => page.locator('.example-code').evaluate(el => el.getBoundingClientRect().top + scrollY);
            const before = await codeTop();
            await page.locator('[data-demo="original"]').click();
            await expect(page.locator('#demo-prose')).toHaveText('Find the available products.');
            expect(await codeTop()).toBe(before);
            await page.locator('[data-demo="translated"]').click();
            await expect(page.locator('#demo-prose')).toHaveText(copy.demo.targetText);
            expect(await codeTop()).toBe(before);
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

async function pauseDemoAnimations(page) {
    await page.addInitScript(() => {
        const animate = Element.prototype.animate;
        Element.prototype.animate = function (...args) {
            const animation = animate.apply(this, args);
            if (this.matches('#demo-prose span')) animation.pause();
            return animation;
        };
    });
}

test('demo pointer transition fades only the sentence and keeps the code fixed', async ({ page }) => {
    await pauseDemoAnimations(page);
    await serve(page);
    await page.goto('https://fixture.test/ko/');
    const codeBefore = await page.locator('.example-code').boundingBox();
    const textBefore = await page.locator('.example-code').textContent();
    await page.locator('[data-demo="original"]').click();
    const outgoing = await page.locator('#demo-prose').evaluate(el => el.getAnimations({ subtree: true }).map(a => ({ duration: a.effect.getTiming().duration, frames: a.effect.getKeyframes() })));
    expect(outgoing).toHaveLength(1);
    expect(outgoing[0].duration).toBe(60);
    expect(outgoing[0].frames.map(frame => frame.opacity)).toEqual(['1', '0']);
    await page.locator('#demo-prose').evaluate(el => el.getAnimations({ subtree: true })[0].finish());
    await expect(page.locator('#demo-prose')).toHaveText('Find the available products.');
    const incoming = await page.locator('#demo-prose').evaluate(el => el.getAnimations({ subtree: true }).map(a => ({ duration: a.effect.getTiming().duration, frames: a.effect.getKeyframes() })));
    expect(incoming).toHaveLength(1);
    expect(incoming[0].duration).toBe(140);
    expect(incoming[0].frames.map(frame => frame.opacity)).toEqual(['0', '1']);
    await page.locator('#demo-prose').evaluate(el => el.getAnimations({ subtree: true })[0].finish());
    await expect(page.locator('#demo-prose span')).toHaveCSS('opacity', '1');
    expect(await page.locator('.example-code').boundingBox()).toEqual(codeBefore);
    await expect(page.locator('.example-code')).toHaveText(textBefore);
});


test('rapid demo reversal resumes from the visible opacity and finishes on the last choice', async ({ page }) => {
    await pauseDemoAnimations(page);
    await serve(page);
    await page.goto('https://fixture.test/ko/');
    const prose = page.locator('#demo-prose');
    await page.locator('[data-demo="original"]').click();
    const opacity = await prose.evaluate(el => {
        el.getAnimations({ subtree: true })[0].currentTime = 20;
        return getComputedStyle(el.firstElementChild).opacity;
    });
    await page.locator('[data-demo="translated"]').click();
    const reversed = await prose.evaluate(el => el.getAnimations({ subtree: true }).map(a => a.effect.getKeyframes()[0].opacity));
    expect(reversed).toEqual([opacity]);
    await prose.evaluate(el => el.getAnimations({ subtree: true })[0].finish());
    await expect.poll(() => prose.evaluate(el => el.getAnimations({ subtree: true })[0]?.effect.getTiming().duration)).toBe(140);
    await prose.evaluate(el => el.getAnimations({ subtree: true })[0].finish());
    await expect(prose.locator('span')).toHaveCSS('opacity', '1');
    await expect(prose).toHaveText(loadLocale('ko').demo.targetText);
    await expect(prose).toHaveAttribute('lang', 'ko');
    await expect(page.locator('[data-demo="translated"]')).toHaveAttribute('aria-pressed', 'true');
});

test('keyboard demo selection is immediate and cancels an unfinished pointer transition', async ({ page }) => {
    await pauseDemoAnimations(page);
    await serve(page);
    await page.goto('https://fixture.test/ko/');
    const original = page.locator('[data-demo="original"]');
    await original.click();
    await original.press('Enter');
    await expect(page.locator('#demo-prose')).toHaveText('Find the available products.');
    await expect(page.locator('#demo-prose')).toHaveAttribute('lang', 'en');
    expect(await page.locator('#demo-prose').evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0);
    expect(await page.locator('.demo-switch').evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0);
    await page.locator('[data-demo="translated"]').press('Space');
    await expect(page.locator('#demo-prose')).toHaveText(loadLocale('ko').demo.targetText);
    await expect(page.locator('[data-demo="translated"]')).toBeFocused();
});

test('reduced-motion demo uses a gentle fade and changing the preference settles pending motion', async ({ page }) => {
    await pauseDemoAnimations(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await serve(page);
    await page.goto('https://fixture.test/ko/');
    const prose = page.locator('#demo-prose');
    await page.locator('[data-demo="original"]').click();
    await expect(prose).toHaveText('Find the available products.');
    const frames = await prose.evaluate(el => {
        const animation = el.getAnimations({ subtree: true })[0];
        return { duration: animation.effect.getTiming().duration, frames: animation.effect.getKeyframes() };
    });
    expect(frames.duration).toBe(80);
    expect(frames.frames.map(frame => frame.opacity)).toEqual(['0.85', '1']);
    expect(frames.frames.every(frame => !('transform' in frame))).toBe(true);
    const opacity = await prose.evaluate(el => {
        el.getAnimations({ subtree: true })[0].currentTime = 20;
        return getComputedStyle(el.firstElementChild).opacity;
    });
    await page.locator('[data-demo="translated"]').click();
    expect(await prose.evaluate(el => el.getAnimations({ subtree: true })[0].effect.getKeyframes()[0].opacity)).toBe(opacity);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect.poll(() => prose.evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0);
    await page.locator('[data-demo="original"]').click();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(prose).toHaveText('Find the available products.');
    await expect.poll(() => prose.evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0);
});

test('demo remains usable when the animation API is unavailable', async ({ page }) => {
    await page.addInitScript(() => { Element.prototype.animate = undefined; });
    await serve(page);
    await page.goto('https://fixture.test/ko/');
    await page.locator('[data-demo="original"]').click();
    await expect(page.locator('#demo-prose')).toHaveText('Find the available products.');
    await expect(page.locator('#demo-prose span')).toHaveCSS('opacity', '1');
});
