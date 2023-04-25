// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as TextFormatting from 'utils/text_formatting';
import EmojiMap from 'utils/emoji_map';

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
});
