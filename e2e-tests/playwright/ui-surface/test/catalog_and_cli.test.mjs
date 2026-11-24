// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

import {emitGenerated, extractMessages, extractOpenApi} from '../dist/catalog.js';
import {runCli} from '../dist/cli.js';
import {extractSurface} from '../dist/scan.js';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, '../../../..');

test('extractOpenApi and extractMessages load real Mattermost specs and i18n catalog', () => {
    const ops = extractOpenApi(join(repoRoot, 'api/v4/source'));
    assert.ok(ops.length >= 450, `Expected 450+ OpenAPI operations, got ${ops.length}`);
    const createPost = ops.find((op) => op.id === 'CreatePost');
    assert.deepEqual(createPost?.method, 'POST');
    assert.deepEqual(createPost?.path, '/api/v4/posts');

    const messages = extractMessages(join(repoRoot, 'webapp/channels/src/i18n/en.json'));
    assert.ok(Object.keys(messages).length > 1000);
});

test('emitGenerated writes api, messages, and flat non-generic surface code', () => {
    const outDir = mkdtempSync(join(tmpdir(), 'ui-surface-gen-'));
    try {
        const surface = extractSurface({
            roots: [],
            files: {
                // eslint-disable-next-line no-template-curly-in-string
                'modal.tsx': 'export const M = ({id}: {id: string}) => <><button data-testid="confirm_modal.confirm--button" /><li data-testid={`confirm_modal.item:${id}--listitem`} /></>;',
            },
        });
        const ops = extractOpenApi(join(repoRoot, 'api/v4/source'));
        const pages = JSON.parse(readFileSync(resolve(testDir, '../pages.json'), 'utf8'));
        const res = emitGenerated({
            outDir,
            surface,
            ops,
            pages,
            enJsonPath: join(repoRoot, 'webapp/channels/src/i18n/en.json'),
        });
        assert.equal(res.files.length, 3);
        const surfaceTs = readFileSync(join(outDir, 'surface.generated.ts'), 'utf8');
        assert.match(surfaceTs, /confirm_modal: \(root\?: Locator\)/);
        assert.match(surfaceTs, /item: \(key: string\) =>/);
        assert.doesNotMatch(surfaceTs, /NotRendered/);
    } finally {
        rmSync(outDir, {recursive: true, force: true});
    }
});

test('CLI map and check return expected output and exit codes', async () => {
    const origOut = process.stdout.write.bind(process.stdout);
    let captured = '';
    process.stdout.write = (chunk) => {
        captured += String(chunk);
        return true;
    };
    try {
        const code = await runCli(['map', '--page', 'channels', '--format', 'md']);
        assert.equal(code, 0);
        assert.match(captured, /## Page: channels/);
        assert.match(captured, /\/:team\/channels\/:channel/);
    } finally {
        process.stdout.write = origOut;
    }
});
