// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import assert from 'assert';

import * as TextFormatting from 'utils/text_formatting.jsx';

describe('TextFormatting.AtMentions', function() {
    it('At mentions', function() {
        assert.equal(
            TextFormatting.autolinkAtMentions('@user', new Map(), {user: {}}),
            '$MM_ATMENTION0',
            'should replace explicit mention with token'
        );

        assert.equal(
            TextFormatting.autolinkAtMentions('abc"@user"def', new Map(), {user: {}}),
            'abc"$MM_ATMENTION0"def',
            'should replace explicit mention surrounded by punctuation with token'
        );

        assert.equal(
            TextFormatting.autolinkAtMentions('@user1 @user2', new Map(), {user1: {}, user2: {}}),
            '$MM_ATMENTION0 $MM_ATMENTION1',
            'should replace multiple explicit mentions with tokens'
        );

        assert.equal(
            TextFormatting.autolinkAtMentions('@us_-e.r', new Map(), {'us_-e.r': {}}),
            '$MM_ATMENTION0',
            'should replace multiple explicit mentions containing punctuation with token'
        );

        assert.equal(
            TextFormatting.autolinkAtMentions('@us_-e.r', new Map(), {'us_-e.r': {}}),
            '$MM_ATMENTION0',
            'should replace multiple explicit mentions containing valid punctuation with token'
        );

        assert.equal(
            TextFormatting.autolinkAtMentions('@user.', new Map(), {user: {}}),
            '$MM_ATMENTION0.',
            'should replace explicit mention followed by period with token'
        );

        assert.equal(
            TextFormatting.autolinkAtMentions('@user.', new Map(), {'user.': {}}),
            '$MM_ATMENTION0',
            'should replace explicit mention ending with period with token'
        );
    });

    it('Not at mentions', function() {
        assert.equal(
            TextFormatting.autolinkAtMentions('user@host', new Map(), {user: {}, host: {}}),
            'user@host'
        );

        assert.equal(
            TextFormatting.autolinkAtMentions('user@email.com', new Map(), {user: {}, email: {}}),
            'user@email.com'
        );

        assert.equal(
            TextFormatting.autolinkAtMentions('@user', new Map(), {}),
            '@user'
        );

        assert.equal(
            TextFormatting.autolinkAtMentions('@user.', new Map(), {}),
            '@user.',
            'should assume username doesn\'t end in punctuation'
        );

        assert.equal(
            TextFormatting.autolinkAtMentions('@will', new Map(), {william: {}}),
            '@will',
            'should return same text without token'
        );

        assert.equal(
            TextFormatting.autolinkAtMentions('@william', new Map(), {will: {}}),
            '@william',
            'should return same text without token'
        );
    });
});
