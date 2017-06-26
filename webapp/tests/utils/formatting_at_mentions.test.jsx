// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import assert from 'assert';

import * as TextFormatting from 'utils/text_formatting.jsx';

describe('TextFormatting.AtMentions', function() {
    it('At mentions', function() {
        assert.equal(
            TextFormatting.autolinkAtMentions('@user', new Map()),
            '$MM_ATMENTION0',
            'should replace mention with token'
        );

        assert.equal(
            TextFormatting.autolinkAtMentions('abc"@user"def', new Map()),
            'abc"$MM_ATMENTION0"def',
            'should replace mention surrounded by punctuation with token'
        );

        assert.equal(
            TextFormatting.autolinkAtMentions('@user1 @user2', new Map()),
            '$MM_ATMENTION0 $MM_ATMENTION1',
            'should replace multiple mentions with tokens'
        );

        assert.equal(
            TextFormatting.autolinkAtMentions('@user1/@user2/@user3', new Map()),
            '$MM_ATMENTION0/$MM_ATMENTION1/$MM_ATMENTION2',
            'should replace multiple mentions with tokens'
        );

        assert.equal(
            TextFormatting.autolinkAtMentions('@us_-e.r', new Map()),
            '$MM_ATMENTION0',
            'should replace multiple mentions containing punctuation with token'
        );

        assert.equal(
            TextFormatting.autolinkAtMentions('@user.', new Map()),
            '$MM_ATMENTION0',
            'should capture trailing punctuation as part of mention'
        );
    });

    it('Not at mentions', function() {
        assert.equal(
            TextFormatting.autolinkAtMentions('user@host', new Map()),
            'user@host'
        );

        assert.equal(
            TextFormatting.autolinkAtMentions('user@email.com', new Map()),
            'user@email.com'
        );
    });
});
