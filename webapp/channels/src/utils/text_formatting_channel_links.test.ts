// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import EmojiMap from 'utils/emoji_map';
import {TestHelper as TH} from 'utils/test_helper';
import * as TextFormatting from 'utils/text_formatting';
const emojiMap = new EmojiMap(new Map());

describe('TextFormatting.ChannelLinks', () => {
    test('Not channel links', () => {
        expect(
            TextFormatting.formatText('~123', {}, emojiMap).trim(),
        ).toBe(
            '<p>~123</p>',
        );

        expect(
            TextFormatting.formatText('~town-square', {}, emojiMap).trim(),
        ).toBe(
            '<p>~town-square</p>',
        );
    });

    describe('Channel links', () => {
        afterEach(() => {
            delete (window as any).basename;
        });

        test('should link ~town-square', () => {
            expect(
                TextFormatting.formatText('~town-square', {
                    channelNamesMap: {'town-square': 'Town Square'},
                    team: TH.getTeamMock({name: 'myteam'}),
                }, emojiMap).trim(),
            ).toBe(
                '<p><a class="mention-link" href="/myteam/channels/town-square" data-channel-mention="town-square">~Town Square</a></p>',
            );
        });

        test('should link ~town-square followed by a period', () => {
            expect(
                TextFormatting.formatText('~town-square.', {
                    channelNamesMap: {'town-square': 'Town Square'},
                    team: TH.getTeamMock({name: 'myteam'}),
                }, emojiMap).trim(),
            ).toBe(
                '<p><a class="mention-link" href="/myteam/channels/town-square" data-channel-mention="town-square">~Town Square</a>.</p>',
            );
        });

        test('should link ~town-square, with display_name an HTML string', () => {
            expect(
                TextFormatting.formatText('~town-square', {
                    channelNamesMap: {'town-square': '<b>Reception</b>'},
                    team: TH.getTeamMock({name: 'myteam'}),
                }, emojiMap).trim(),
            ).toBe(
                '<p><a class="mention-link" href="/myteam/channels/town-square" data-channel-mention="town-square">~&lt;b&gt;Reception&lt;/b&gt;</a></p>',
            );
        });

        test('should link ~town-square, with a basename defined', () => {
            window.basename = '/subpath';
            expect(
                TextFormatting.formatText('~town-square', {
                    channelNamesMap: {'town-square': '<b>Reception</b>'},
                    team: TH.getTeamMock({name: 'myteam'}),
                }, emojiMap).trim(),
            ).toBe(
                '<p><a class="mention-link" href="/subpath/myteam/channels/town-square" data-channel-mention="town-square">~&lt;b&gt;Reception&lt;/b&gt;</a></p>',
            );
        });

        test('should link in brackets', () => {
            expect(
                TextFormatting.formatText('(~town-square)', {
                    channelNamesMap: {'town-square': 'Town Square'},
                    team: TH.getTeamMock({name: 'myteam'}),
                }, emojiMap).trim(),
            ).toBe(
                '<p>(<a class="mention-link" href="/myteam/channels/town-square" data-channel-mention="town-square">~Town Square</a>)</p>',
            );
        });
    });

    describe('invalid channel links', () => {
        test('should not link when a ~ is in the middle of a word', () => {
            expect(
                TextFormatting.formatText('aa~town-square', {
                    channelNamesMap: {'town-square': 'Town Square'},
                    team: TH.getTeamMock({name: 'myteam'}),
                }, emojiMap).trim(),
            ).toBe(
                '<p>aa~town-square</p>',
            );
        });
    });
});
