// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import {test} from 'node:test';

import {element, scanFixture} from './helpers.ts';

const out = () => scanFixture('library');
const templates = () => out().manifest.elements.map((e) => e.template);

test('library: a usage with testId renders the parts the library publishes', () => {
    for (const t of ['library.settings_modal--dialog', 'library.settings_modal.back--button', 'library.settings_modal.close--button', 'library.settings_modal.tabs', 'library.settings_modal.tabs.tab:{key}--tab']) {
        assert.ok(templates().includes(t), `${t} in\n${templates().join('\n')}`);
    }
    assert.equal(element(out(), 'library.settings_modal.close--button').aria.role, 'button');
    assert.equal(element(out(), 'library.settings_modal--dialog').aria.role, 'dialog');
    assert.deepEqual(element(out(), 'library.settings_modal.tabs.tab:{key}--tab').key?.kind, 'string');
});

test('library: parts gated on a prop follow the usage (IconButton toggled)', () => {
    assert.ok(templates().includes('library.settings_modal.pin--togglebutton'));
    assert.ok(!templates().includes('library.settings_modal.pin--button'));
    assert.ok(templates().includes('library.settings_modal.edit--button'));
    assert.ok(!templates().includes('library.settings_modal.edit--togglebutton'));
});

test('library: an explicit data-testid wins over the derived root, and lands with the published role', () => {
    assert.ok(!templates().includes('library.settings_modal.derived--button'));
    assert.equal(element(out(), 'library.settings_modal.explicit--button').aria.role, 'button');
});

test('library: a published part with an untyped key fails strict keys at its usage', () => {
    const errors = out().diagnostics.filter((d) => d.severity === 'error');
    assert.ok(errors.length);
    assert.ok(errors.every((d) => d.rule === 'key-origin' && d.template === 'library.settings_modal.tabs.tab:{key}--tab'));
    assert.equal(out().report.scopes['library.settings_modal.tabs'], undefined, 'an unresolved string key never declares an unrestricted family');
});

test('library: the manifest records the libraries the scan read, with their version and whether they published parts', () => {
    assert.deepEqual(out().manifest.generatedFrom.libraries, [{package: 'compass', version: 'lib/compass/test-parts.json', parts: true}]);
});
