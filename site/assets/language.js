(() => {
    'use strict';

    const script = document.currentScript;
    const supported = script.dataset.locales.split(',');
    const current = document.documentElement.lang;
    const url = new URL(location.href);
    const requested = url.searchParams.get('lang');
    const selected = supported.includes(requested) ? requested : null;
    const storageKey = 'prevent-code-translation:language';
    let saved;
    try {
        if (selected) localStorage.setItem(storageKey, selected);
        saved = localStorage.getItem(storageKey);
    } catch {
        // The explicit URL still works when browser storage is unavailable.
    }

    // Keep shared language-specific URLs; detect language at default entry points.
    let language = selected || (current !== 'en' ? current : null);
    if (!language && supported.includes(saved)) language = saved;
    if (!language) {
        const preferences = navigator.languages?.length ? navigator.languages : [navigator.language];
        for (const preference of preferences) {
            const tag = preference.toLowerCase();
            language = supported.find(code => code.toLowerCase() === tag)
                || supported.find(code => code.split('-')[0] === tag.split('-')[0]);
            if (language) break;
        }
    }
    if (!language || language === current) return;

    const base = new URL('../', script.src);
    const target = new URL(`${language === 'en' ? '' : `${language}/`}${script.dataset.page}`, base);
    target.search = url.search;
    target.hash = url.hash;
    location.replace(target.href);
})();
