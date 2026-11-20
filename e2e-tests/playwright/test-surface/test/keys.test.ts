// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import {test} from 'node:test';

import {scanFixture} from './helpers.ts';

import {keyOf, keyOfTestId, keyedPattern} from '../lint/grammar.js';

const diagnostics = () => scanFixture('keys').diagnostics.filter((item) => item.rule === 'key-origin');

test('keys: known prefix and suffix preserve every character of a raw id', () => {
    for (const value of ['com.mattermost.calls', 'ServiceSettings.SiteURL', 'a:b--c', 'a--button', 'a\nb', '["x"]']) {
        const testId = `x.item:${value}--text`;
        assert.equal(keyOf(testId, 'x.item:', '--text'), value);
        assert.equal(keyOfTestId(testId), value);
        assert.ok(keyedPattern('x.item:', '--text').test(testId));
    }
    assert.equal(keyOf('other.item:x--text', 'x.item:', '--text'), null);
    assert.equal(keyOf('x.item:--text', 'x.item:', '--text'), null);
});

test('keys: strict origins reject names and untyped strings but retain entity ids', () => {
    const errors = diagnostics();
    for (const name of ['name', 'raw', 'typed_raw']) {
        assert.ok(errors.some((item) => item.template?.startsWith(`keys.${name}:`)), name);
    }
    for (const name of ['id', 'plugin']) {
        assert.ok(!errors.some((item) => item.template?.startsWith(`keys.${name}:`)), name);
    }
});

test('keys: free-form origins and ambiguous sets need role suffixes', () => {
    for (const name of ['raw', 'bare_plugin', 'ambiguous']) {
        assert.ok(diagnostics().some((item) => item.template?.startsWith(`keys.${name}:`) && item.message.includes('role suffix')), name);
    }
});

test('keys: composite keys and keyed scopes are explicit errors', () => {
    assert.ok(diagnostics().some((item) => item.template?.startsWith('keys.composite:') && item.message.includes('multiple pieces')));
    assert.ok(diagnostics().some((item) => item.message.includes('component scope cannot contain a key')));
});
