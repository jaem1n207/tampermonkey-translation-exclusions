import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile, cp } from 'node:fs/promises';
import { join } from 'node:path';

export const localeCodes = ['en', 'zh-CN', 'vi', 'pt-BR', 'es', 'ko', 'ja'];
export const siteURL = 'https://jaem1n207.github.io/tampermonkey-translation-exclusions/';
export const repoURL = 'https://github.com/jaem1n207/tampermonkey-translation-exclusions';
export const listingURL = 'https://greasyfork.org/en/scripts/595754-prevent-code-translation';
const labels = ['English', '简体中文', 'Tiếng Việt', 'Português (Brasil)', 'Español', '한국어', '日本語'];
export const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

export function loadLocale(code) {
    assert(localeCodes.includes(code), `Unsupported locale: ${code}`);
    return JSON.parse(readFileSync(new URL(`../site/locales/${code}.json`, import.meta.url), 'utf8'));
}

export function validateLocale(copy, reference = loadLocale('en'), path = '') {
    if (typeof reference === 'string') {
        assert(typeof copy === 'string' && copy.trim().length, `Missing text: ${path}`);
        if (path === '.scriptName' || path === '.scriptDescription') assert.doesNotMatch(copy, /[\r\n\u2028\u2029]/, `Metadata must be one line: ${path}`);
        assert.deepEqual(copy.match(/\{\w+\}/g) ?? [], reference.match(/\{\w+\}/g) ?? [], `Changed placeholders: ${path}`);
    } else if (Array.isArray(reference)) {
        assert(Array.isArray(copy) && copy.length === reference.length, `Changed list: ${path}`);
        reference.forEach((value, index) => validateLocale(copy[index], value, `${path}[${index}]`));
    } else {
        assert(copy && typeof copy === 'object', `Missing object: ${path}`);
        assert.deepEqual(Object.keys(copy).sort(), Object.keys(reference).sort(), `Changed keys: ${path}`);
        for (const key of Object.keys(reference)) validateLocale(copy[key], reference[key], `${path}.${key}`);
    }
}

export function localePath(code, page = '') {
    assert(localeCodes.includes(code));
    return `${code === 'en' ? '' : `${code}/`}${page}`;
}

function languageMenu(copy, prefix, page) {
    return `<details class="languages"><summary>${escapeHTML(copy.label)} <span aria-hidden="true">⌄</span></summary><nav aria-label="${escapeHTML(copy.nav.language)}">${localeCodes.map((code, index) => `<a href="${prefix}${localePath(code, page)}" lang="${code}" hreflang="${code}"${code === copy.locale ? ' aria-current="page"' : ''}>${labels[index]}</a>`).join('')}</nav></details>`;
}

function shell(copy, content, check = false) {
    const prefix = copy.locale === 'en' ? './' : '../';
    const page = check ? 'verify.html' : '';
    const url = `${siteURL}${localePath(copy.locale, page)}`;
    const title = check ? copy.verify.pageTitle : copy.pageTitle;
    const description = check ? copy.verify.pageDescription : copy.pageDescription;
    return `<!doctype html>
<html lang="${copy.locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHTML(title)}</title>
<meta name="description" content="${escapeHTML(description)}">
<link rel="canonical" href="${url}">
${localeCodes.map(code => `<link rel="alternate" hreflang="${code}" href="${siteURL}${localePath(code, page)}">`).join('\n')}
<link rel="alternate" hreflang="x-default" href="${siteURL}${page}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Prevent Code Translation">
<meta property="og:title" content="${escapeHTML(title)}">
<meta property="og:description" content="${escapeHTML(description)}">
<meta property="og:url" content="${url}">
<meta property="og:locale" content="${copy.ogLocale}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escapeHTML(title)}">
<meta name="twitter:description" content="${escapeHTML(description)}">
<link rel="stylesheet" href="${prefix}assets/site.css">
<script src="${prefix}assets/site.js" defer data-manifest="${prefix}manifest.json"></script>
</head>
<body>
<a class="skip-link" href="#main">${escapeHTML(copy.nav.skip)}</a>
<header class="site-header wrap">
<a class="brand" href="${check ? './' : '#'}" translate="no"><span class="brand-mark" aria-hidden="true">{ }</span><span>Prevent Code<br>Translation</span></a>
<nav class="section-nav" aria-label="${escapeHTML(copy.scriptName)}">${check ? '' : `<a href="#coverage">${escapeHTML(copy.nav.coverage)}</a><a href="#setup">${escapeHTML(copy.nav.setup)}</a>`}</nav>
${languageMenu(copy, prefix, page)}
</header>
<main id="main">${content}</main>
<footer class="site-footer wrap"><a href="${repoURL}">${escapeHTML(copy.footer.source)}</a><a href="${repoURL}/issues">${escapeHTML(copy.footer.issues)}</a><span id="version" data-template="${escapeHTML(copy.footer.version)}" data-error="${escapeHTML(copy.footer.versionError)}">${escapeHTML(copy.footer.versionLoading)}</span></footer>
</body>
</html>\n`;
}

export function renderLanding(copy) {
    const e = escapeHTML;
    const prefix = copy.locale === 'en' ? './' : '../';
    const install = `${prefix}prevent-code-translation.user.js`;
    return shell(copy, `
<section class="hero wrap">
<div class="hero-copy"><h1>${e(copy.hero.line1)}<br><span>${e(copy.hero.line2)}</span></h1>
<p class="hero-body">${e(copy.hero.body)}</p>
<div class="install-actions"><a class="button primary" href="${install}">${e(copy.hero.primary)} <span aria-hidden="true">↗</span></a><a class="secondary" href="${listingURL}">${e(copy.hero.secondary)}</a></div>
<p class="small">${e(copy.hero.note)}</p><p class="existing">${e(copy.hero.existing)}</p>
</div>
<figure class="example">
<div class="example-top"><span>${e(copy.demo.label)}</span><span class="example-dots" aria-hidden="true">•••</span></div>
<div class="demo-switch" hidden role="group" aria-label="${e(copy.demo.label)}"><button type="button" data-demo="original" aria-pressed="false">${e(copy.demo.original)}</button><button type="button" data-demo="translated" aria-pressed="true">${e(copy.demo.translated)}</button></div>
<div class="document-example"><div class="example-prose"><p id="demo-prose" lang="${copy.demo.targetLang}" data-original="Find the available products." data-translated="${e(copy.demo.targetText)}" data-target-lang="${copy.demo.targetLang}">${e(copy.demo.targetText)}</p><span class="annotation">${e(copy.demo.proseLabel)}</span></div>
<pre class="example-code" translate="no"><code><span class="syntax-keyword">const</span> inStock = products.<span class="syntax-function">filter</span>(
  product =&gt; product.stock &gt; <span class="syntax-number">0</span>
);</code></pre><p class="code-status"><span aria-hidden="true">✓</span> ${e(copy.demo.codeLabel)}</p></div>
<figcaption>${e(copy.demo.caption)}</figcaption>
</figure>
</section>
<div class="compatibility wrap"><span aria-hidden="true">↳</span> ${e(copy.hero.compatibility)}</div>
<section class="coverage wrap" id="coverage"><h2>${e(copy.coverage.title)}</h2><ul class="coverage-list">${copy.coverage.items.map(item => `<li><h3>${e(item.title)}</h3><p>${e(item.body)}</p></li>`).join('')}</ul><a class="text-link" href="${repoURL}/blob/main/docs/coverage.md">${e(copy.coverage.details)} <span aria-hidden="true">↗</span></a></section>
<div class="trust-band"><p class="wrap">${e(copy.trust)}</p></div>
<section class="setup wrap" id="setup"><h2>${e(copy.setup.title)}</h2><ol>${copy.setup.steps.map((step, index) => `<li><div><h3>${e(step.title)}</h3><p>${e(step.body)}</p><a href="${['https://www.tampermonkey.net/', install, './verify.html'][index]}">${e(step.link)} <span aria-hidden="true">↗</span></a></div></li>`).join('')}</ol></section>
<section class="questions wrap" id="questions"><h2>${e(copy.faq.title)}</h2><div>${copy.faq.items.map((item, index) => `<details${index === 0 ? ' open' : ''}><summary>${e(item.question)}</summary><p>${e(item.answer)}</p></details>`).join('')}</div></section>`);
}

export function renderVerification(copy) {
    const e = escapeHTML;
    const strings = JSON.stringify({ ...copy.verify, locale: copy.locale }).replace(/</g, '\\u003c');
    const prefix = copy.locale === 'en' ? './' : '../';
    return shell(copy, `<section class="check-page wrap"><h1>${e(copy.verify.title)}</h1><p>${e(copy.verify.intro)}</p><p>${e(copy.verify.instructions)}</p>
<div class="check-fixture"><p id="ordinary">${e(copy.verify.ordinary)}</p>
<pre id="initial-pre"><code id="initial-code">const original = "Keep this code unchanged";</code></pre>
<div class="code-block" id="explicit-code">const explicitlyMarked = true;</div>
<p><kbd id="keys">Ctrl+C</kbd> <math id="math"><mi>x</mi><mo>+</mo><mn>1</mn></math></p>
<div contenteditable="true" id="editor" aria-label="${e(copy.verify.editor)}"><code id="editor-code">editable code</code></div></div>
<button class="button primary" id="add">${e(copy.verify.button)}</button><div id="dynamic"></div><ul id="results" aria-live="polite"></ul>
<p class="small">${e(copy.verify.disclaimer)}</p><p><a href="./">${e(copy.verify.back)}</a> · <a href="${repoURL}/blob/main/docs/coverage.md">${e(copy.coverage.details)}</a></p>
</section><script type="application/json" id="check-copy">${strings}</script><script src="${prefix}assets/verify.js" defer></script>`, true);
}

export function renderDescription(copy) {
    return `${copy.hero.body}\n\n## ${copy.coverage.title}\n\n${copy.coverage.items.map(item => `- **${item.title}** — ${item.body}`).join('\n')}\n\n${copy.trust}\n\n## ${copy.setup.title}\n\n1. ${copy.setup.steps[0].body} [${copy.setup.steps[0].link}](https://www.tampermonkey.net/)\n2. ${copy.setup.steps[1].body}\n3. ${copy.setup.steps[2].body} [${copy.setup.steps[2].link}](${siteURL}${localePath(copy.locale, 'verify.html')})\n\n## ${copy.faq.title}\n\n${copy.faq.items.map(item => `**${item.question}**\n\n${item.answer}`).join('\n\n')}\n\n[${copy.coverage.details}](${repoURL}/blob/main/docs/coverage.md) · [${copy.footer.source}](${repoURL}) · [${copy.footer.issues}](${repoURL}/issues)\n`;
}

export async function buildSite(destination) {
    const reference = loadLocale('en');
    await mkdir(destination, { recursive: true });
    await cp(new URL('../site/assets/', import.meta.url), join(destination, 'assets'), { recursive: true });
    for (const code of localeCodes) {
        const copy = loadLocale(code);
        validateLocale(copy, reference);
        assert.equal(copy.locale, code);
        const directory = join(destination, localePath(code));
        await mkdir(directory, { recursive: true });
        await writeFile(join(directory, 'index.html'), renderLanding(copy));
        await writeFile(join(directory, 'verify.html'), renderVerification(copy));
        await writeFile(join(destination, `greasyfork-description${code === 'en' ? '' : `.${code}`}.md`), renderDescription(copy));
    }
    const urls = localeCodes.map(code => `<url><loc>${siteURL}${localePath(code)}</loc></url>`).join('');
    await writeFile(join(destination, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`);
}
