'use strict';
const copy = JSON.parse(document.getElementById('check-copy').textContent);

const marked = element => !!element && element.classList.contains('notranslate') && element.getAttribute('translate') === 'no';
let shadowCode;
let frame;
let added = false;
function inspect() {
    const cases = [
        [copy.cases[0], marked(document.getElementById('initial-pre')) && marked(document.getElementById('initial-code'))],
        [copy.cases[1], !document.getElementById('ordinary').hasAttribute('translate')],
        [copy.cases[2], marked(document.getElementById('explicit-code'))],
        [copy.cases[3], marked(document.getElementById('keys')) && marked(document.getElementById('math'))],
        [copy.cases[4], marked(document.getElementById('editor'))],
        [copy.cases[5], !document.getElementById('editor-code').hasAttribute('translate')],
    ];
    if (added) {
        cases.push(
            [copy.cases[6], [...document.querySelectorAll('#dynamic pre, #dynamic code')].every(marked)],
            [copy.cases[7], marked(shadowCode)],
            [copy.cases[8], marked(frame.contentDocument?.querySelector('code'))],
        );
    }
    document.getElementById('results').replaceChildren(...cases.map(([label, passed]) => {
        const item = document.createElement('li');
        item.className = passed ? 'pass' : 'fail';
        item.textContent = `${passed ? copy.pass : copy.fail}: ${label}`;
        return item;
    }));
}
document.getElementById('add').addEventListener('click', () => {
    added = true;
    const original = document.getElementById('initial-code');
    original.classList.remove('notranslate');
    original.removeAttribute('translate');
    original.textContent = 'const reusedNode = true;';
    const dynamic = document.getElementById('dynamic');
    dynamic.innerHTML = '<pre><code>const loadedLater = true;</code></pre>';
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<code>const insideShadow = true;</code>';
    shadowCode = shadow.querySelector('code');
    frame = document.createElement('iframe');
    frame.title = copy.frameTitle;
    frame.srcdoc = `<!doctype html><html lang="${copy.locale}"><meta charset="utf-8"><code>const insideFrame = true;</code></html>`;
    frame.addEventListener('load', () => setTimeout(inspect, 100), { once: true });
    dynamic.append(host, frame);
    setTimeout(inspect, 100);
});
setTimeout(inspect, 500);
