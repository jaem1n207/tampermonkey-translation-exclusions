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

const easeOut = 'cubic-bezier(0.23, 1, 0.32, 1)';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const demo = document.getElementById('demo-prose');
if (demo) {
    const prose = demo.querySelector('span');
    const buttons = [...document.querySelectorAll('[data-demo]')];
    const toggle = document.querySelector('.demo-switch');
    let selected = 'translated';
    let animation;
    toggle.hidden = false;

    const showSelected = () => {
        prose.textContent = selected === 'translated' ? demo.dataset.translated : demo.dataset.original;
        demo.lang = selected === 'translated' ? demo.dataset.targetLang : 'en';
    };
    const settle = () => {
        if (animation) {
            animation.onfinish = null;
            animation.cancel();
            animation = null;
        }
        showSelected();
    };
    reducedMotion.addEventListener('change', settle);

    for (const button of buttons) {
        button.addEventListener('click', event => {
            const instant = event.detail === 0 || typeof prose.animate !== 'function';
            toggle.toggleAttribute('data-instant', instant);
            if (button.dataset.demo === selected && !instant) return;
            selected = button.dataset.demo;
            for (const other of buttons) other.setAttribute('aria-pressed', String(other === button));
            if (instant) return settle();

            // Resume from the visible opacity when another click interrupts a fade.
            const opacity = getComputedStyle(prose).opacity;
            const interrupted = animation && animation.playState !== 'finished';
            if (animation) {
                animation.onfinish = null;
                animation.cancel();
            }
            if (reducedMotion.matches) {
                showSelected();
                animation = prose.animate([{ opacity: interrupted ? opacity : 0.85 }, { opacity: 1 }], { duration: 80, easing: easeOut });
                return;
            }
            const outgoing = prose.animate([{ opacity }, { opacity: 0 }], { duration: 60, easing: easeOut, fill: 'forwards' });
            animation = outgoing;
            outgoing.onfinish = () => {
                showSelected();
                animation = prose.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 140, easing: easeOut });
                outgoing.cancel();
            };
        });
    }
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

// Carry a manual choice between pages even if localStorage is blocked.
const selectedLanguage = new URL(location.href).searchParams.get('lang');
if (selectedLanguage === document.documentElement.lang) {
    for (const link of document.querySelectorAll('[data-language-link]')) {
        const url = new URL(link.href);
        url.searchParams.set('lang', selectedLanguage);
        link.href = url.href;
    }
}
