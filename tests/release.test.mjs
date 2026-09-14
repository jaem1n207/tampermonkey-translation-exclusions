import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { baseURL, filename, metadataFilename, repository, versionFor, compareVersions, metadata, renderRelease, shouldPublish, verifyDeployment } from '../scripts/release.mjs';

const source = await readFile(new URL(`../src/${filename}`, import.meta.url), 'utf8');
const commit = 'a'.repeat(40);
const version = '1.2.1';
const release = renderRelease(source, version, commit);
const fixture = overrides => {
    const bodies = {
        'manifest.json': JSON.stringify(release.manifest),
        [filename]: release.script,
        [metadataFilename]: release.meta,
        ...overrides,
    };
    return async url => {
        assert(url.startsWith(`${baseURL}/`));
        const path = new URL(url).pathname.split('/').at(-1);
        return new Response(bodies[path] ?? '', { status: bodies[path] === undefined ? 404 : 200 });
    };
};

test('push and retry versions increase numerically', () => {
    assert.equal(versionFor('2', '1'), '1.2.1');
    assert.equal(versionFor('2', '2'), '1.2.2');
    assert.equal(compareVersions('1.10.1', '1.9.99'), 1);
    assert.equal(compareVersions('1.2.2', '1.2.1'), 1);
    assert.equal(compareVersions('1.2.2', '1.2.2'), 0);
    assert.equal(compareVersions('1.2.2', '1.3.1'), -1);
});

test('invalid release identifiers are rejected', () => {
    for (const value of [undefined, '', '0', '-1', '1.5', '1\n// injected', '01', '9007199254740993']) {
        assert.throws(() => versionFor(value, '1'));
        assert.throws(() => versionFor('1', value));
    }
    assert.throws(() => renderRelease(source, version, 'main'));
});

test('build preserves executable code and script identity', () => {
    const initial = metadata(source);
    const built = metadata(release.script);
    assert.equal(source.slice(initial.header.length), release.script.slice(built.header.length));
    assert.equal(built.fields.get('name'), initial.fields.get('name'));
    assert.equal(built.fields.get('namespace'), initial.fields.get('namespace'));
    assert.equal(built.fields.get('version'), version);
    assert.equal(release.meta, `${built.header}\n`);
    assert.equal(release.manifest.commit, commit);
});

test('duplicate metadata, wrong update channels and manual versions fail the build', () => {
    assert.throws(() => renderRelease(source.replace('// ==/UserScript==', '// @version 2.0.0\n// ==/UserScript=='), version, commit));
    assert.throws(() => renderRelease(source.replace('0.0.0', '0.0.1'), version, commit));
    assert.throws(() => renderRelease(source.replace(`${baseURL}/${filename}`, 'https://example.com/other.user.js'), version, commit));
    assert.throws(() => renderRelease(source.replace('// @updateURL', '// @ignoredUpdateURL'), version, commit));
});

test('superseded commits never publish', async () => {
    let requested = false;
    assert.equal(await shouldPublish({ commit, latestCommit: 'b'.repeat(40), version, fetcher: async () => { requested = true; } }), false);
    assert.equal(requested, false);
});

test('first deployment is allowed only on a 404 response', async () => {
    const check = status => shouldPublish({ commit, latestCommit: commit, version, fetcher: async () => new Response('', { status }) });
    assert.equal(await check(404), true);
    await assert.rejects(check(500));
    await assert.rejects(check(403));
});

test('old runs cannot downgrade or overwrite a newer release', async () => {
    const check = candidate => shouldPublish({ commit, latestCommit: commit, version: candidate, fetcher: fixture() });
    assert.equal(await check('1.1.99'), false);
    assert.equal(await check('1.2.1'), false);
    assert.equal(await check('1.2.2'), true);
    assert.equal(await check('1.3.1'), true);
});

test('malformed existing deployment fails closed', async () => {
    await assert.rejects(shouldPublish({ commit, latestCommit: commit, version, fetcher: fixture({ 'manifest.json': '{}' }) }));
    await assert.rejects(shouldPublish({ commit, latestCommit: commit, version, fetcher: fixture({ 'manifest.json': JSON.stringify({ repository, version: 'unknown' }) }) }));
});

test('public metadata, full script and manifest verify together', async () => {
    assert.deepEqual(await verifyDeployment({ version, commit, fetcher: fixture() }), release.manifest);
});

test('stale version or source commit is rejected', async () => {
    await assert.rejects(verifyDeployment({ version: '1.3.1', commit, fetcher: fixture() }));
    await assert.rejects(verifyDeployment({ version, commit: 'b'.repeat(40), fetcher: fixture() }));
});

test('mixed deployments, changed script bodies and missing files are rejected', async () => {
    await assert.rejects(verifyDeployment({ fetcher: fixture({ [metadataFilename]: release.meta.replace(version, '1.1.1') }) }));
    await assert.rejects(verifyDeployment({ fetcher: fixture({ [filename]: `${release.script}\n// changed after build` }) }));
    await assert.rejects(verifyDeployment({ fetcher: fixture({ [filename]: undefined }) }));
});
