// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {describe, it} from 'node:test';
import assert from 'node:assert/strict';

import {parseCommand} from './mmctl';

describe('parseCommand', () => {
    it('parses simple arguments', () => {
        assert.deepEqual(parseCommand('config set Key value'), ['config', 'set', 'Key', 'value']);
    });

    it('handles double-quoted strings', () => {
        assert.deepEqual(parseCommand('user create --email "test@test.com" --username testuser'), [
            'user',
            'create',
            '--email',
            'test@test.com',
            '--username',
            'testuser',
        ]);
    });

    it('handles single-quoted strings', () => {
        assert.deepEqual(parseCommand("config set Key 'hello world'"), ['config', 'set', 'Key', 'hello world']);
    });

    it('handles mixed quotes', () => {
        assert.deepEqual(parseCommand(`config set Key "value with 'inner' quotes"`), [
            'config',
            'set',
            'Key',
            "value with 'inner' quotes",
        ]);
    });

    it('handles multiple spaces between args', () => {
        assert.deepEqual(parseCommand('config   set   Key   value'), ['config', 'set', 'Key', 'value']);
    });

    it('returns empty array for empty string', () => {
        assert.deepEqual(parseCommand(''), []);
    });
});
