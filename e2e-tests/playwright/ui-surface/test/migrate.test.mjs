// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';

import {migrateTestIds} from '../dist/migrate.js';

function scratch(files) {
    const dir = mkdtempSync(join(tmpdir(), 'migrate-'));
    for (const [rel, content] of Object.entries(files)) {
        const full = join(dir, rel);
        mkdirSync(join(full, '..'), {recursive: true});
        writeFileSync(full, content);
    }
    return dir;
}

test('migrate-testid classifies files and rewrites only safe literal lookups on --apply', () => {
    const dir = scratch({
        'webapp/src/c.tsx': "export const C = () => <button data-testid='legacy_save' data-surface='p.save--button'/>;",
        'webapp/src/c.test.tsx': "it('x', () => { screen.getByTestId('legacy_save'); });",
        'webapp/src/mixed.test.tsx': "it('y', () => { screen.getByTestId('legacy_save'); screen.getByTestId('not_mapped_legacy'); });",
    });
    try {
        const driftMap = {legacy_save: 'p.save--button'};
        const dry = migrateTestIds({webappRoots: [join(dir, 'webapp/src')], specRoots: [], cwd: dir, driftMap, apply: false});
        assert.equal(dry.summary.filesWritten, 0);
        const auto = dry.perFile.find((f) => f.file.endsWith('c.test.tsx'));
        const hand = dry.perFile.find((f) => f.file.endsWith('mixed.test.tsx'));
        assert.equal(auto.status, 'auto');
        assert.equal(hand.status, 'hand'); // has a legacy id without a surface counterpart

        migrateTestIds({webappRoots: [join(dir, 'webapp/src')], specRoots: [], cwd: dir, driftMap, apply: true});
        assert.match(readFileSync(join(dir, 'webapp/src/c.test.tsx'), 'utf8'), /getByTestId\('p\.save--button'\)/);
        // The component's legacy data-testid is renamed to the surface id (drift resolved).
        assert.match(readFileSync(join(dir, 'webapp/src/c.tsx'), 'utf8'), /data-testid='p\.save--button'/);
        // The mixed file is left for hand edits (not auto-rewritten).
        assert.match(readFileSync(join(dir, 'webapp/src/mixed.test.tsx'), 'utf8'), /not_mapped_legacy/);
    } finally {
        rmSync(dir, {recursive: true, force: true});
    }
});
