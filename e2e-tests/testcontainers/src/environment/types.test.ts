// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {describe, it} from 'node:test';
import assert from 'node:assert/strict';

import {formatElapsed} from './types';

describe('formatElapsed', () => {
    it('shows one decimal for < 10 seconds', () => {
        assert.equal(formatElapsed(5000), '5.0s');
        assert.equal(formatElapsed(1234), '1.2s');
        assert.equal(formatElapsed(9900), '9.9s');
    });

    it('shows whole seconds for 10s–59s', () => {
        assert.equal(formatElapsed(10_000), '10s');
        assert.equal(formatElapsed(15_000), '15s');
        assert.equal(formatElapsed(59_500), '60s');
    });

    it('shows minutes and seconds for >= 60s', () => {
        assert.equal(formatElapsed(60_000), '1m 0s');
        assert.equal(formatElapsed(90_000), '1m 30s');
        assert.equal(formatElapsed(125_000), '2m 5s');
    });

    it('handles zero', () => {
        assert.equal(formatElapsed(0), '0.0s');
    });
});
