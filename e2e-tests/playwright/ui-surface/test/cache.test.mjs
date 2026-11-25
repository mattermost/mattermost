// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';

import {incrementalScan} from '../dist/cache.js';
import {extractSurface} from '../dist/scan.js';

test('incremental scan matches a full scan and reuses the cache on a warm run', () => {
    const root = mkdtempSync(join(tmpdir(), 'inc-'));
    mkdirSync(join(root, 'src'), {recursive: true});
    writeFileSync(
        join(root, 'src/a.tsx'),
        'export const A=()=>(<div data-surface="p"><button data-surface="p.save--button"/></div>);',
    );
    writeFileSync(
        join(root, 'src/b.tsx'),
        'export const B=()=>(<div data-surface="q"><div data-surface="q.on--checkbox"/></div>);',
    );
    const cacheDir = join(root, '.cache');
    try {
        const full = extractSurface({roots: [join(root, 'src')], cwd: root});
        const cold = incrementalScan({roots: [join(root, 'src')], cwd: root, cacheDir});
        assert.equal(cold.cacheMisses, 2);
        assert.equal(cold.cacheHits, 0);

        // Same diagnostics as a full scan (role-fit on the div checkbox).
        const ids = (r) => r.diagnostics.map((d) => `${d.rule}:${d.id}`).sort();
        assert.deepEqual(ids(cold), ids(full));

        const warm = incrementalScan({roots: [join(root, 'src')], cwd: root, cacheDir});
        assert.equal(warm.cacheHits, 2);
        assert.equal(warm.cacheMisses, 0);
        assert.deepEqual(ids(warm), ids(full));

        // Editing one file invalidates only its cache entry.
        writeFileSync(join(root, 'src/a.tsx'), 'export const A=()=><div data-surface="p"/>;');
        const edited = incrementalScan({roots: [join(root, 'src')], cwd: root, cacheDir});
        assert.equal(edited.cacheMisses, 1);
        assert.equal(edited.cacheHits, 1);
    } finally {
        rmSync(root, {recursive: true, force: true});
    }
});
