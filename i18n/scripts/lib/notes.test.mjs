// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import {test} from 'node:test';

import {formatNotes} from './notes.mjs';

test('locales share a line for the same note, and keep their own for a different one', () => {
    const {text, counts} = formatNotes({
        ru: {'webapp:a': {kind: 'english', text: 'Typo: "teh"'}, 'webapp:b': {kind: 'english', text: 'Ambiguous: save what?'}},
        de: {'webapp:a': {kind: 'english', text: 'Typo: "teh"'}, 'webapp:b': {kind: 'english', text: 'No plural for the count'}},
        ja: {'server:c': {kind: 'choice', text: 'Kept the katakana loanword'}},
    });
    assert.deepEqual(counts, {english: 2, choice: 1});
    assert.equal(text, [
        '#### Defects in the English',
        '',
        '- `webapp:a` (de, ru): Typo: "teh"',
        '- `webapp:b`',
        '  - de: No plural for the count',
        '  - ru: Ambiguous: save what?',
        '',
        '#### Translation choices to check',
        '',
        '- `server:c` (ja): Kept the katakana loanword',
        '',
    ].join('\n'));
});
