// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {describe, it} from 'node:test';
import assert from 'node:assert/strict';

import {validateContainerId, validateNetworkId} from './docker_cli';

describe('validateContainerId', () => {
    it('accepts a valid 12-char hex ID', () => {
        assert.equal(validateContainerId('abcdef012345'), 'abcdef012345');
    });

    it('accepts a valid 64-char hex ID', () => {
        const id = 'a'.repeat(64);
        assert.equal(validateContainerId(id), id);
    });

    it('rejects a short ID (< 12 chars)', () => {
        assert.throws(() => validateContainerId('abcdef'), /Invalid Docker container ID/);
    });

    it('rejects an ID with uppercase letters', () => {
        assert.throws(() => validateContainerId('ABCDEF012345'), /Invalid Docker container ID/);
    });

    it('rejects an ID with special characters', () => {
        assert.throws(() => validateContainerId('abcdef01234!'), /Invalid Docker container ID/);
    });

    it('rejects an empty string', () => {
        assert.throws(() => validateContainerId(''), /Invalid Docker container ID/);
    });

    it('rejects an ID with spaces', () => {
        assert.throws(() => validateContainerId('abcdef 12345'), /Invalid Docker container ID/);
    });
});

describe('validateNetworkId', () => {
    it('accepts a valid 12-char hex ID', () => {
        assert.equal(validateNetworkId('abcdef012345'), 'abcdef012345');
    });

    it('accepts a valid 64-char hex ID', () => {
        const id = 'b'.repeat(64);
        assert.equal(validateNetworkId(id), id);
    });

    it('rejects a short ID (< 12 chars)', () => {
        assert.throws(() => validateNetworkId('abcdef'), /Invalid Docker network ID/);
    });

    it('rejects an ID with uppercase letters', () => {
        assert.throws(() => validateNetworkId('ABCDEF012345'), /Invalid Docker network ID/);
    });

    it('rejects an ID with special characters', () => {
        assert.throws(() => validateNetworkId('abcdef01234!'), /Invalid Docker network ID/);
    });
});
