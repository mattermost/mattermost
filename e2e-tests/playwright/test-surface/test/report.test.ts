// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {test} from 'node:test';

import {scanFixture} from './helpers.ts';

import type {Manifest} from '../src/manifest_types.ts';
import {unrenderedTestIds, writeReports} from '../src/report.ts';

const manifest = {elements: [{template: 'panel.save--button'}, {template: 'list.row:{key}--link'}, {template: '{key}'}]} as unknown as Manifest;

test('report: testids tests query that no template produces', () => {
    const out = unrenderedTestIds(manifest, [{path: 'a.test.tsx',
        text: [
            "expect(screen.queryByTestId('panel.save--button')).toBeInTheDocument();",
            "screen.getByTestId('list.row:abc--link');",
            "expect(screen.queryByTestId('oldSaveButton')).not.toBeInTheDocument();",
            "cy.get('[data-testid=\"gone\"]');",
            "jest.mock('./x', () => () => <div data-testid='mocked'/>); screen.getByTestId('mocked');",
        ].join('\n')}]);
    assert.deepEqual(out, [{testId: 'gone', files: ['a.test.tsx']}, {testId: 'oldSaveButton', files: ['a.test.tsx']}]);
});

test('report: the manifest holds no diagnostics', () => {
    assert.ok(!('diagnostics' in scanFixture('checks').manifest));
});

test('report: a lookup with extra arguments is collected', () => {
    const out = unrenderedTestIds(manifest, [{path: 'a.test.tsx', text: "screen.queryByTestId('oldSaveButton', {exact: true});\nscreen.getByTestId('other',{});\n"}]);
    assert.deepEqual(out.map((o) => o.testId), ['oldSaveButton', 'other']);
});

test('report: diagnostics files of an earlier run are removed, other files are kept', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-reports-'));
    try {
        const out = scanFixture('checks');
        const at = {rule: 'old-rule', severity: 'error', at: 'a.tsx:1', message: 'm'} as unknown as Parameters<typeof writeReports>[2][number];
        writeReports(dir, out.result, [at]);
        assert.ok(fs.existsSync(path.join(dir, 'diagnostics_old_rule.txt')));
        fs.writeFileSync(path.join(dir, 'notes.txt'), 'keep');
        writeReports(dir, out.result, []);
        assert.ok(!fs.existsSync(path.join(dir, 'diagnostics_old_rule.txt')));
        assert.ok(fs.existsSync(path.join(dir, 'diagnostics.json')));
        assert.ok(fs.existsSync(path.join(dir, 'notes.txt')));
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});
