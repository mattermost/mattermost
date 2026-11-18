// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import {test} from 'node:test';

import {element, scanFixture} from './helpers.ts';

const out = () => scanFixture('library_roles');

test('library roles: styled(LibraryComponent) keeps the component\'s role from the built-in table', () => {
    assert.equal(element(out(), 'roles.panel.save--button').aria.role, 'button');
});

test('library roles: a container whose handlers belong to its built-in controls is not itself a control', () => {
    assert.equal(element(out(), 'roles.panel').aria.role, 'region');
    const errors = out().diagnostics.filter((d) => d.severity === 'error');
    assert.deepEqual(errors.map((d) => `${d.rule}: ${d.message}`), []);
});
