// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import {describe, test} from 'node:test';

import {mergePayloads} from './validate.mjs';

describe('mergePayloads', () => {
    test('merges a locale\'s answer files, and reports a key answered in two', () => {
        const {payload, errors} = mergePayloads([
            {file: 'a.json', payload: {webapp: {'app.a': 'A'}, notes: {'webapp:app.a': 'The English is wrong'}}},
            {file: 'b.json', payload: {webapp: {'app.b': 'B', 'app.a': 'again'}}},
        ]);
        assert.deepEqual(payload, {webapp: {'app.a': 'A', 'app.b': 'B'}, notes: {'webapp:app.a': 'The English is wrong'}});
        assert.deepEqual(errors, ['webapp.app.a: in both a.json and b.json']);
    });

    test('reports a field that is not an object, and keeps what other files gave it', () => {
        const {payload, errors} = mergePayloads([
            {file: 'a.json', payload: {notes: {'webapp:app.a': 'The English is wrong'}}},
            {file: 'b.json', payload: {notes: null, webapp: ['app.b']}},
        ]);
        assert.deepEqual(payload.notes, {'webapp:app.a': 'The English is wrong'});
        assert.deepEqual(errors, ['b.json: notes is not a JSON object', 'b.json: webapp is not a JSON object']);
    });
});
