// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import {test} from 'node:test';

import {scanFixture} from './helpers.ts';

import type {Manifest} from '../src/manifest_types.ts';
import {diagnosticCounts, unrenderedTestIds} from '../src/report.ts';

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

test('report: the manifest holds no diagnostics; the diagnostic counts count warnings per rule', () => {
    const out = scanFixture('checks');
    assert.ok(!('diagnostics' in out.manifest));
    const {warnings} = diagnosticCounts(out.result.stats, [...out.diagnostics, {rule: 'unresolved', severity: 'warning', at: 'x', message: 'm'}]);
    assert.equal(warnings.unresolved, out.diagnostics.filter((d) => d.rule === 'unresolved' && d.severity === 'warning').length + 1);
});

test('report: the diagnostic counts count errors and explicit exceptions independently of coverage', () => {
    const out = scanFixture('checks');
    const counts = diagnosticCounts(out.result.stats, [
        {rule: 'unresolved', severity: 'error', at: 'x', message: 'unresolved'},
        {rule: 'unresolved', severity: 'warning', at: 'y', message: 'unresolved'},
    ], {allow: [{}], strictExceptions: [{}, {}], keyFields: {allow: [{}, {freeForm: true}]}});
    assert.deepEqual(counts.errors, {unresolved: 1});
    assert.equal(counts.ceilings.allow, 1);
    assert.equal(counts.ceilings.strictExceptions, 2);
    assert.equal(counts.ceilings.keyFields, 2);
    assert.equal(counts.ceilings.freeFormKeyFields, 1);
});
