// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-template-curly-in-string -- cases quote template-literal syntax */

import assert from 'node:assert/strict';
import {test} from 'node:test';

import {isE2eRule, parseDisable} from './disables.js';

test('a directive is read as its rules and its reason', () => {
    assert.deepEqual(parseDisable(' eslint-disable-next-line test-surface/e2e-observe-actions -- the menu closes itself'), {rules: ['test-surface/e2e-observe-actions'], reason: 'the menu closes itself'});
    assert.deepEqual(parseDisable(' eslint-disable no-console, test-surface/e2e-no-floating-actions '), {rules: ['no-console', 'test-surface/e2e-no-floating-actions'], reason: ''});
    assert.deepEqual(parseDisable(' eslint-disable-line'), {rules: [], reason: ''});
    assert.equal(parseDisable(' a comment about eslint-disable'), null);
    assert.equal(parseDisable(' eslint-disabled'), null);
});

test('every spec rule of the plugin needs a reason, other rules do not', () => {
    for (const rule of ['test-surface/e2e-observe-actions', 'test-surface/e2e-no-floating-actions', 'test-surface/e2e-no-literal-locators', 'test-surface/e2e-no-locator-action', 'test-surface/e2e-no-url-assertions']) {
        assert.equal(isE2eRule(rule), true, rule);
    }
    for (const rule of ['no-console', 'test-surface/testid-grammar', 'e2e-no-literal-locators', '@typescript-eslint/no-non-null-assertion']) {
        assert.equal(isE2eRule(rule), false, rule);
    }
});
