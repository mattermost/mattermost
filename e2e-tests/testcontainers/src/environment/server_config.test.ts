// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {describe, it} from 'node:test';
import assert from 'node:assert/strict';

import {formatConfigValue} from './server_config';

describe('formatConfigValue', () => {
    it('double-quotes strings', () => {
        assert.equal(formatConfigValue('hello'), '"hello"');
    });

    it('escapes internal double quotes in strings', () => {
        assert.equal(formatConfigValue('say "hi"'), '"say \\"hi\\""');
    });

    it('passes numbers as-is', () => {
        assert.equal(formatConfigValue(42), '42');
        assert.equal(formatConfigValue(3.14), '3.14');
    });

    it('passes booleans as-is', () => {
        assert.equal(formatConfigValue(true), 'true');
        assert.equal(formatConfigValue(false), 'false');
    });

    it('formats arrays of primitives as multiple quoted args', () => {
        assert.equal(formatConfigValue(['a', 'b']), '"a" "b"');
    });

    it('formats complex arrays as JSON', () => {
        const value = [{key: 'value'}];
        assert.equal(formatConfigValue(value), `'${JSON.stringify(value)}'`);
    });

    it('formats objects as single-quoted JSON', () => {
        const value = {key: 'value'};
        assert.equal(formatConfigValue(value), `'${JSON.stringify(value)}'`);
    });

    it('returns empty quotes for null', () => {
        assert.equal(formatConfigValue(null), '""');
    });

    it('returns empty quotes for undefined', () => {
        assert.equal(formatConfigValue(undefined), '""');
    });
});
