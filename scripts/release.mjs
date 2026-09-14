import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, appendFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { buildSite, localeCodes, loadLocale, validateLocale } from './site.mjs';
import { Script } from 'node:vm';

export const repository = 'jaem1n207/tampermonkey-translation-exclusions';
export const baseURL = 'https://jaem1n207.github.io/tampermonkey-translation-exclusions';
export const filename = 'prevent-code-translation.user.js';
export const metadataFilename = 'prevent-code-translation.meta.js';
export const sha256 = text => createHash('sha256').update(text).digest('hex');

export function versionFor(runNumber, runAttempt) {
    for (const value of [runNumber, runAttempt]) {
        assert.match(value ?? '', /^[1-9]\d*$/, 'Actions run number and attempt must be positive integers');
        assert(Number.isSafeInteger(Number(value)), 'Run number is too large');
    }
    return `1.${runNumber}.${runAttempt}`;
}

export function compareVersions(left, right) {
    const pattern = /^\d+\.\d+\.\d+$/;
    assert.match(left, pattern);
    assert.match(right, pattern);
    const a = left.split('.').map(BigInt);
    const b = right.split('.').map(BigInt);
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
    }
    return 0;
}

export function metadata(text) {
    const header = text.match(/^\/\/ ==UserScript==\r?\n([\s\S]*?)^\/\/ ==\/UserScript==/m);
    assert(header, 'Userscript metadata header is missing');
    const fields = new Map();
    for (const match of header[1].matchAll(/^\/\/\s+@(\w+)\s+(.+)$/gm)) {
        if (['name', 'namespace', 'version', 'updateURL', 'downloadURL'].includes(match[1])) {
            assert(!fields.has(match[1]), `Duplicate @${match[1]}`);
            fields.set(match[1], match[2].trim());
        }
    }
    for (const key of ['name', 'namespace', 'version', 'updateURL', 'downloadURL']) {
        assert(fields.has(key), `Missing @${key}`);
    }
    assert.equal(fields.get('updateURL'), `${baseURL}/${metadataFilename}`);
    assert.equal(fields.get('downloadURL'), `${baseURL}/${filename}`);
    return { header: header[0], fields };
}

export function renderRelease(source, version, commit) {
    assert.match(version, /^1\.[1-9]\d*\.[1-9]\d*$/);
    assert.match(commit ?? '', /^[0-9a-f]{40}$/, 'A complete source commit SHA is required');
    const initial = metadata(source);
    assert.equal(initial.fields.get('version'), '0.0.0', 'Source version is a placeholder, managed by the release build');
    assert.doesNotMatch(initial.header, /^\/\/\s+@(?:name|description):/m, 'Localized metadata is managed by the release build');
    const english = loadLocale('en');
    assert.equal(english.scriptName, initial.fields.get('name'), 'Keep the installed script identity stable');
    const localized = localeCodes.filter(code => code !== 'en').map(code => {
        const copy = loadLocale(code);
        validateLocale(copy, english);
        return `// @name:${code} ${copy.scriptName}\n// @description:${code} ${copy.scriptDescription}`;
    }).join('\n');
    const script = source
        .replace(/^\/\/\s+@version\s+.+$/m, `// @version      ${version}`)
        .replace('// ==/UserScript==', `${localized}\n// ==/UserScript==`);
    new Script(script, { filename });
    const { header } = metadata(script);
    const manifest = { version, commit, repository, sha256: sha256(script), scriptURL: `${baseURL}/${filename}`, updateURL: `${baseURL}/${metadataFilename}` };
    return { script, meta: `${header}\n`, manifest };
}

export async function shouldPublish({ commit, latestCommit, version, fetcher = fetch }) {
    if (commit !== latestCommit) return false;
    const response = await fetcher(`${baseURL}/manifest.json`, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (response.status === 404) return true;
    assert(response.ok, `Existing deployment returned HTTP ${response.status}`);
    const published = await response.json();
    assert.equal(published.repository, repository);
    return compareVersions(version, published.version) > 0;
}

export async function verifyDeployment({ version, commit, fetcher = fetch } = {}) {
    const paths = ['manifest.json', metadataFilename, filename];
    const bodies = await Promise.all(paths.map(async path => {
        const response = await fetcher(`${baseURL}/${path}`, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
        assert(response.ok, `${path}: HTTP ${response.status}`);
        return response.text();
    }));
    const manifest = JSON.parse(bodies[0]);
    assert.equal(manifest.repository, repository);
    assert.equal(manifest.scriptURL, `${baseURL}/${filename}`);
    assert.equal(manifest.updateURL, `${baseURL}/${metadataFilename}`);
    assert.match(manifest.commit, /^[0-9a-f]{40}$/);
    assert.match(manifest.version, /^1\.[1-9]\d*\.[1-9]\d*$/);
    const meta = metadata(bodies[1]);
    const script = metadata(bodies[2]);
    assert.equal(bodies[1], `${script.header}\n`, 'Update metadata and downloaded script differ');
    assert.equal(meta.fields.get('version'), manifest.version);
    assert.equal(script.fields.get('version'), manifest.version);
    assert.equal(sha256(bodies[2]), manifest.sha256, 'Published script hash mismatch');
    if (version !== undefined) assert.equal(manifest.version, version, 'Published version is stale');
    if (commit !== undefined) assert.equal(manifest.commit, commit, 'Published commit is stale');
    new Script(bodies[2], { filename });
    return manifest;
}

async function main(command) {
    if (command === 'build') {
        const version = versionFor(process.env.GITHUB_RUN_NUMBER, process.env.GITHUB_RUN_ATTEMPT);
        const source = await readFile(new URL(`../src/${filename}`, import.meta.url), 'utf8');
        const release = renderRelease(source, version, process.env.GITHUB_SHA);
        await mkdir('dist', { recursive: true });
        await buildSite('dist');
        await Promise.all([
            writeFile(`dist/${filename}`, release.script),
            writeFile(`dist/${metadataFilename}`, release.meta),
            writeFile('dist/manifest.json', `${JSON.stringify(release.manifest, null, 2)}\n`),
            writeFile('dist/.nojekyll', ''),
        ]);
        console.log(JSON.stringify(release.manifest, null, 2));
    } else if (command === 'guard') {
        assert.equal(process.env.GITHUB_REF, 'refs/heads/main');
        const response = await fetch(`https://api.github.com/repos/${repository}/commits/main`, {
            headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${process.env.GH_TOKEN}` },
            signal: AbortSignal.timeout(15000),
        });
        assert(response.ok, `Cannot verify main: HTTP ${response.status}`);
        const latest = await response.json();
        const publish = await shouldPublish({ commit: process.env.GITHUB_SHA, latestCommit: latest.sha, version: versionFor(process.env.GITHUB_RUN_NUMBER, process.env.GITHUB_RUN_ATTEMPT) });
        await appendFile(process.env.GITHUB_OUTPUT, `publish=${publish}\n`);
        console.log(publish ? 'Current main and newer release: publishing.' : 'Superseded commit or version: skipping publication.');
    } else if (command === 'verify') {
        const version = process.env.GITHUB_RUN_NUMBER ? versionFor(process.env.GITHUB_RUN_NUMBER, process.env.GITHUB_RUN_ATTEMPT) : undefined;
        const attempts = process.env.CI ? 18 : 1;
        for (let attempt = 1; attempt <= attempts; attempt++) {
            try {
                const manifest = await verifyDeployment({ version, commit: process.env.GITHUB_SHA });
                console.log(JSON.stringify(manifest, null, 2));
                return;
            } catch (error) {
                if (attempt === attempts) throw error;
                console.log(`Waiting for Pages publication (${attempt}/${attempts}): ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, 10000));
            }
        }
    } else {
        throw new Error('Usage: node scripts/release.mjs build|guard|verify');
    }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    await main(process.argv[2]);
}
