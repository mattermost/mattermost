// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import path from 'node:path';
import {test} from 'node:test';

import {element, FIXTURES, scanFixture} from './helpers.ts';

import {loadConfig} from '../src/config.ts';
import {staleReferences} from '../src/stale_refs.ts';

const out = () => scanFixture('reach');

test('reach: elements in files the entries never import are unreachable, through index re-exports and import()', () => {
    assert.equal(element(out(), 'live.row').unreachable, undefined);
    assert.equal(element(out(), 'lazy.label--text').unreachable, undefined, 'a lazily imported module is loaded');
    assert.equal(element(out(), 'orphan.go--button').unreachable, true);
    assert.equal(element(out(), 'legacyRow').unreachable, true, 'a live shared component whose value only flows from dead code');
    assert.ok(!out().diagnostics.some((d) => d.message.includes('orphan.go--button') || d.message.includes('legacyRow')));
    assert.ok(out().result.notReachableFiles?.some((file) => file.endsWith('orphan.tsx')));
    assert.ok(!out().report.scopes.orphan, 'unreachable scopes are not generated');
});

test('stale references: e2e queries that match no testid are errors; prefixes, regexes and allowed ids are not', () => {
    const config = loadConfig(path.join(FIXTURES, 'reach', 'test-surface.config.json'));
    const ds = staleReferences(out().manifest, config);
    assert.deepEqual(ds.map((d) => [d.rule, d.severity, d.at, d.message.split(' ')[0]]), [
        ['stale-reference', 'error', 'e2e/sample.spec.ts:5', '"live.renamed_row"'],
        ['stale-reference', 'error', 'e2e/sample.spec.ts:15', '"cypress.renamed_row"'],
    ]);
});
