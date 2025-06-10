// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import EmojiMap from 'utils/emoji_map';
import * as TextFormatting from 'utils/text_formatting';

interface StringsTest {
    actual: string;
    expected: string;
    label: string;
}
const emptyEmojiMap = new EmojiMap(new Map());

describe('TextFormatting.AtMentions', () => {
    describe('At mentions', () => {
        const tests: StringsTest[] = [
            {
                actual: TextFormatting.autolinkAtMentions('@user', new Map()),
                expected: '$MM_ATMENTION0$',
                label: 'should replace mention with token',
            },
            {
                actual: TextFormatting.autolinkAtMentions('abc"@user"def', new Map()),
                expected: 'abc"$MM_ATMENTION0$"def',
                label: 'should replace mention surrounded by punctuation with token',
            },
            {
                actual: TextFormatting.autolinkAtMentions('@user1 @user2', new Map()),
                expected: '$MM_ATMENTION0$ $MM_ATMENTION1$',
                label: 'should replace multiple mentions with tokens',
            },
            {
                actual: TextFormatting.autolinkAtMentions('@user1/@user2/@user3', new Map()),
                expected: '$MM_ATMENTION0$/$MM_ATMENTION1$/$MM_ATMENTION2$',
                label: 'should replace multiple mentions with tokens',
            },
            {
                actual: TextFormatting.autolinkAtMentions('@us_-e.r', new Map()),
                expected: '$MM_ATMENTION0$',
                label: 'should replace multiple mentions containing punctuation with token',
            },
            {
                actual: TextFormatting.autolinkAtMentions('@user.', new Map()),
                expected: '$MM_ATMENTION0$',
                label: 'should capture trailing punctuation as part of mention',
            },
            {
                actual: TextFormatting.autolinkAtMentions('@foo.com @bar.com', new Map()),
                expected: '$MM_ATMENTION0$ $MM_ATMENTION1$',
                label: 'should capture two at mentions with space in between',
            },
            {
                actual: TextFormatting.autolinkAtMentions('@foo.com@bar.com', new Map()),
                expected: '$MM_ATMENTION0$$MM_ATMENTION1$',
                label: 'should capture two at mentions without space in between',
            },
            {
                actual: TextFormatting.autolinkAtMentions('@foo.com@bar.com@baz.com', new Map()),
                expected: '$MM_ATMENTION0$$MM_ATMENTION1$$MM_ATMENTION2$',
                label: 'should capture multiple at mentions without space in between',
            },
        ];
        tests.forEach((test: StringsTest) => {
            it(test.label, () => expect(test.actual).toBe(test.expected));
        });
    });

    it('Not at mentions', () => {
        expect(TextFormatting.autolinkAtMentions('user@host', new Map())).toEqual('user@host');
        expect(TextFormatting.autolinkAtMentions('user@email.com', new Map())).toEqual('user@email.com');
        expect(TextFormatting.autolinkAtMentions('@', new Map())).toEqual('@');
        expect(TextFormatting.autolinkAtMentions('@ ', new Map())).toEqual('@ ');
        expect(TextFormatting.autolinkAtMentions(':@', new Map())).toEqual(':@');
    });

    it('Highlighted at mentions', () => {
        expect(
            TextFormatting.formatText('@user', {atMentions: true, mentionKeys: [{key: '@user'}]}, emptyEmojiMap).trim(),
        ).toEqual(
            '<p><span class="mention--highlight"><span data-mention="user">@user</span></span></p>',
        );
        expect(
            TextFormatting.formatText('@channel', {atMentions: true, mentionKeys: [{key: '@channel'}]}, emptyEmojiMap).trim(),
        ).toEqual(
            '<p><span class="mention--highlight"><span data-mention="channel">@channel</span></span></p>',
        );
        expect(TextFormatting.formatText('@all', {atMentions: true, mentionKeys: [{key: '@all'}]}, emptyEmojiMap).trim(),
        ).toEqual(
            '<p><span class="mention--highlight"><span data-mention="all">@all</span></span></p>',
        );
        expect(TextFormatting.formatText('@USER', {atMentions: true, mentionKeys: [{key: '@user'}]}, emptyEmojiMap).trim(),
        ).toEqual(
            '<p><span class="mention--highlight"><span data-mention="USER">@USER</span></span></p>',
        );
        expect(TextFormatting.formatText('@CHanNEL', {atMentions: true, mentionKeys: [{key: '@channel'}]}, emptyEmojiMap).trim(),

        ).toEqual('<p><span class="mention--highlight"><span data-mention="CHanNEL">@CHanNEL</span></span></p>',
        );
        expect(TextFormatting.formatText('@ALL', {atMentions: true, mentionKeys: [{key: '@all'}]}, emptyEmojiMap).trim(),

        ).toEqual('<p><span class="mention--highlight"><span data-mention="ALL">@ALL</span></span></p>',
        );
        expect(TextFormatting.formatText('@foo.com', {atMentions: true, mentionKeys: [{key: '@foo.com'}]}, emptyEmojiMap).trim(),
        ).toEqual(
            '<p><span class="mention--highlight"><span data-mention="foo.com">@foo.com</span></span></p>',
        );
        expect(TextFormatting.formatText('@foo.com @bar.com', {atMentions: true, mentionKeys: [{key: '@foo.com'}, {key: '@bar.com'}]}, emptyEmojiMap).trim(),

        ).toEqual('<p><span class="mention--highlight"><span data-mention="foo.com">@foo.com</span></span> <span class="mention--highlight"><span data-mention="bar.com">@bar.com</span></span></p>',
        );
        expect(TextFormatting.formatText('@foo.com@bar.com', {atMentions: true, mentionKeys: [{key: '@foo.com'}, {key: '@bar.com'}]}, emptyEmojiMap).trim(),

        ).toEqual('<p><span class="mention--highlight"><span data-mention="foo.com">@foo.com</span></span><span class="mention--highlight"><span data-mention="bar.com">@bar.com</span></span></p>',
        );
    });

    describe('Mix highlight at mentions', () => {
        const tests: StringsTest[] = [
            {
                actual: TextFormatting.formatText('@foo.com @bar.com', {atMentions: true, mentionKeys: [{key: '@foo.com'}]}, emptyEmojiMap).trim(),
                expected: '<p><span class="mention--highlight"><span data-mention="foo.com">@foo.com</span></span> <span data-mention="bar.com">@bar.com</span></p>',
                label: 'should highlight first at mention, with space in between',
            },
            {
                actual: TextFormatting.formatText('@foo.com @bar.com', {atMentions: true, mentionKeys: [{key: '@bar.com'}]}, emptyEmojiMap).trim(),
                expected: '<p><span data-mention="foo.com">@foo.com</span> <span class="mention--highlight"><span data-mention="bar.com">@bar.com</span></span></p>',
                label: 'should highlight second at mention, with space in between',
            },
            {
                actual: TextFormatting.formatText('@foo.com@bar.com', {atMentions: true, mentionKeys: [{key: '@foo.com'}]}, emptyEmojiMap).trim(),
                expected: '<p><span class="mention--highlight"><span data-mention="foo.com">@foo.com</span></span><span data-mention="bar.com">@bar.com</span></p>',
                label: 'should highlight first at mention, without space in between',
            },
            {
                actual: TextFormatting.formatText('@foo.com@bar.com', {atMentions: true, mentionKeys: [{key: '@bar.com'}]}, emptyEmojiMap).trim(),
                expected: '<p><span data-mention="foo.com">@foo.com</span><span class="mention--highlight"><span data-mention="bar.com">@bar.com</span></span></p>',
                label: 'should highlight second at mention, without space in between',
            },
            {
                actual: TextFormatting.formatText('@foo.com@bar.com', {atMentions: true, mentionKeys: [{key: '@user'}]}, emptyEmojiMap).trim(),
                expected: '<p><span data-mention="foo.com">@foo.com</span><span data-mention="bar.com">@bar.com</span></p>',
                label: 'should not highlight any at mention',
            },
        ];

        tests.forEach((test: StringsTest) => {
            it(test.label, () => expect(test.actual).toBe(test.expected));
        });
    });

    describe('Remote mention tokens', () => {
        it('should store and restore remote mention tokens', () => {
            const token = '$MM_ATMENTION_REMOTE1$';
            const mentionText = '@user:org1';

            // Store a token
            TextFormatting.storeRemoteMentionToken(token, mentionText);

            // Test that restoration works
            const textWithToken = `Hello ${token} how are you?`;
            const restoredText = TextFormatting.restoreRemoteMentionTokens(textWithToken);

            expect(restoredText).toBe(`Hello ${mentionText} how are you?`);
        });

        it('should handle multiple remote mention tokens', () => {
            const token1 = '$MM_ATMENTION_REMOTE1$';
            const token2 = '$MM_ATMENTION_REMOTE2$';
            const mention1 = '@user1:org1';
            const mention2 = '@user2:org2';

            // Store tokens
            TextFormatting.storeRemoteMentionToken(token1, mention1);
            TextFormatting.storeRemoteMentionToken(token2, mention2);

            // Test restoration with multiple tokens
            const textWithTokens = `${token1} and ${token2} are collaborating`;
            const restoredText = TextFormatting.restoreRemoteMentionTokens(textWithTokens);

            expect(restoredText).toBe(`${mention1} and ${mention2} are collaborating`);
        });

        it('should handle text without tokens unchanged', () => {
            const normalText = 'Hello @user how are you?';
            const restoredText = TextFormatting.restoreRemoteMentionTokens(normalText);

            expect(restoredText).toBe(normalText);
        });

        it('should handle special characters in tokens correctly', () => {
            const token = '$MM_ATMENTION_REMOTE1$';
            const mentionText = '@user:org1';

            TextFormatting.storeRemoteMentionToken(token, mentionText);

            // Test with special regex characters that need escaping
            const textWithSpecialChars = `(${token}) and [${token}]`;
            const restoredText = TextFormatting.restoreRemoteMentionTokens(textWithSpecialChars);

            expect(restoredText).toBe(`(${mentionText}) and [${mentionText}]`);
        });

        it('should handle remote mentions in at mentions processing', () => {
            const tokens = new Map();

            // Test that @user:org1 gets captured by the AT_MENTION_PATTERN
            const result = TextFormatting.autolinkAtMentions('@user:org1', tokens);

            expect(result).toBe('$MM_ATMENTION0$');
            expect(tokens.get('$MM_ATMENTION0$')?.originalText).toBe('@user:org1');
            expect(tokens.get('$MM_ATMENTION0$')?.value).toBe('<span data-mention="user:org1">@user:org1</span>');
        });
    });
});
