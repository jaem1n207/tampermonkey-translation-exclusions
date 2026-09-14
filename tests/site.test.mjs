import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { localeCodes, loadLocale, validateLocale, renderLanding, renderVerification, renderDescription, buildSite, siteURL, localePath } from '../scripts/site.mjs';

test('every requested language has complete copy and unchanged placeholders', () => {
    assert.deepEqual(localeCodes, ['en', 'zh-CN', 'vi', 'pt-BR', 'es', 'ko', 'ja']);
    for (const code of localeCodes) {
        const copy = loadLocale(code);
        validateLocale(copy);
        assert.equal(copy.locale, code);
        assert(!/[\r\n]/.test(copy.scriptName + copy.scriptDescription));
    }
    const incomplete = structuredClone(loadLocale('en'));
    delete incomplete.faq;
    assert.throws(() => validateLocale(incomplete));
    const broken = structuredClone(loadLocale('en'));
    broken.footer.version = 'Version';
    assert.throws(() => validateLocale(broken));
});

test('localized pages expose canonical language routes and working install links without JavaScript', () => {
    for (const code of localeCodes) {
        const copy = loadLocale(code);
        const landing = renderLanding(copy);
        const verify = renderVerification(copy);
        for (const [html, page] of [[landing, ''], [verify, 'verify.html']]) {
            assert(html.includes(`<html lang="${code}">`));
            assert(html.includes(`<link rel="canonical" href="${siteURL}${localePath(code, page)}">`));
            for (const other of localeCodes) assert(html.includes(`hreflang="${other}" href="${siteURL}${localePath(other, page)}"`));
            assert(html.includes('hreflang="x-default"'));
            assert(!html.includes('undefined'));
        }
        const prefix = code === 'en' ? './' : '../';
        assert(landing.includes(`href="${prefix}prevent-code-translation.user.js"`));
        assert(landing.includes('href="./verify.html"'));
        assert(landing.includes(`href="https://greasyfork.org/${code}/scripts/595754-prevent-code-translation"`));
        assert(verify.includes(`src="${prefix}assets/verify.js"`));
    }
});

test('translated text is escaped in HTML and embedded JSON cannot close its script', () => {
    const copy = structuredClone(loadLocale('en'));
    copy.hero.line1 = '<img src=x onerror=alert(1)>';
    copy.verify.intro = '</script><script>alert(1)</script>';
    assert(renderLanding(copy).includes('&lt;img src=x onerror=alert(1)&gt;'));
    const html = renderVerification(copy);
    assert(!html.includes('</script><script>alert(1)</script>'));
    assert(html.includes('\\u003c/script>'));
});

test('Greasy Fork descriptions include localized setup and limits without alternate download links', () => {
    for (const code of localeCodes) {
        const copy = loadLocale(code);
        const markdown = renderDescription(copy);
        assert(markdown.includes(copy.faq.items[0].answer));
        assert(markdown.includes(copy.setup.steps[1].body));
        assert(markdown.includes(`${siteURL}${localePath(code, 'verify.html')}`));
        assert(!markdown.includes('.user.js'));
        assert(!markdown.includes('undefined'));
    }
});

test('the production build emits every page, asset, and Greasy Fork sync source', async () => {
    const destination = await mkdtemp(join(tmpdir(), 'translation-site-'));
    try {
        await buildSite(destination);
        for (const code of localeCodes) {
            assert.equal(await readFile(join(destination, localePath(code, 'index.html')), 'utf8'), renderLanding(loadLocale(code)));
            assert.equal(await readFile(join(destination, localePath(code, 'verify.html')), 'utf8'), renderVerification(loadLocale(code)));
            assert.equal(await readFile(join(destination, `greasyfork-description${code === 'en' ? '' : `.${code}`}.md`), 'utf8'), renderDescription(loadLocale(code)));
        }
        for (const asset of ['site.css', 'site.js', 'verify.js']) assert((await readFile(join(destination, 'assets', asset))).length > 0);
        assert((await readFile(join(destination, 'sitemap.xml'), 'utf8')).includes(`${siteURL}ja/`));
    } finally {
        await rm(destination, { recursive: true });
    }
});
