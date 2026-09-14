'use strict';

const version = document.getElementById('version');
const script = document.querySelector('script[data-manifest]');
fetch(script.dataset.manifest, { cache: 'no-store', signal: AbortSignal.timeout(5000) })
    .then(response => {
        if (!response.ok) throw new Error('Version request failed');
        return response.json();
    })
    .then(manifest => {
        if (!/^1\.[1-9]\d*\.[1-9]\d*$/.test(manifest.version)) throw new Error('Invalid version');
        version.textContent = version.dataset.template.replace('{version}', manifest.version);
    })
    .catch(() => { version.textContent = version.dataset.error; });

const prose = document.getElementById('demo-prose');
if (prose) document.querySelector('.demo-switch').hidden = false;
for (const button of document.querySelectorAll('[data-demo]')) {
    button.addEventListener('click', () => {
        const translated = button.dataset.demo === 'translated';
        prose.textContent = translated ? prose.dataset.translated : prose.dataset.original;
        prose.lang = translated ? prose.dataset.targetLang : 'en';
        for (const other of document.querySelectorAll('[data-demo]')) other.setAttribute('aria-pressed', String(other === button));
    });
}

const languages = document.querySelector('.languages');
document.addEventListener('click', event => {
    if (!languages.contains(event.target)) languages.open = false;
});
languages.addEventListener('keydown', event => {
    if (event.key === 'Escape' && languages.open) {
        languages.open = false;
        languages.querySelector('summary').focus();
    }
});
