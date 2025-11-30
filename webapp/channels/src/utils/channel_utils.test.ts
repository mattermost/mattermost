// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as Utils from 'utils/channel_utils';

describe('Channel Utils', () => {
    describe('findNextUnreadChannelId', () => {
        test('no channels are unread', () => {
            const curChannelId = '3';
            const allChannelIds = ['1', '2', '3', '4', '5'];
            const unreadChannelIds: string[] = [];

            expect(Utils.findNextUnreadChannelId(curChannelId, allChannelIds, unreadChannelIds, 1)).toEqual(-1);
        });

        test('only current channel is unread', () => {
            const curChannelId = '3';
            const allChannelIds = ['1', '2', '3', '4', '5'];
            const unreadChannelIds = ['3'];

            expect(Utils.findNextUnreadChannelId(curChannelId, allChannelIds, unreadChannelIds, 1)).toEqual(-1);
        });

        test('going forward to unread channels', () => {
            const curChannelId = '3';
            const allChannelIds = ['1', '2', '3', '4', '5'];
            const unreadChannelIds = ['1', '4', '5'];

            expect(Utils.findNextUnreadChannelId(curChannelId, allChannelIds, unreadChannelIds, 1)).toEqual(3);
        });

        test('going forward to unread channels with wrapping', () => {
            const curChannelId = '3';
            const allChannelIds = ['1', '2', '3', '4', '5'];
            const unreadChannelIds = ['1', '2'];

            expect(Utils.findNextUnreadChannelId(curChannelId, allChannelIds, unreadChannelIds, 1)).toEqual(0);
        });

        test('going backwards to unread channels', () => {
            const curChannelId = '3';
            const allChannelIds = ['1', '2', '3', '4', '5'];
            const unreadChannelIds = ['1', '4', '5'];

            expect(Utils.findNextUnreadChannelId(curChannelId, allChannelIds, unreadChannelIds, -1)).toEqual(0);
        });

        test('going backwards to unread channels with wrapping', () => {
            const curChannelId = '3';
            const allChannelIds = ['1', '2', '3', '4', '5'];
            const unreadChannelIds = ['3', '4', '5'];

            expect(Utils.findNextUnreadChannelId(curChannelId, allChannelIds, unreadChannelIds, -1)).toEqual(4);
        });
    });

    describe('getActiveTabFromRoute', () => {
        test('returns "messages" for regular channel route', () => {
            const match = {
                path: '/team/channel/:channelId',
                params: {},
            };

            expect(Utils.getActiveTabFromRoute(match)).toBe('messages');
        });

        test('returns "messages" for route without wiki pattern', () => {
            const match = {
                path: '/team/channel/:channelId/files',
                params: {},
            };

            expect(Utils.getActiveTabFromRoute(match)).toBe('messages');
        });

        test('returns wiki tab id for wiki route with wikiId', () => {
            const match = {
                path: '/wiki/:channelId([a-z0-9]{26})/:wikiId([a-z0-9]{26})',
                params: {wikiId: 'abc123def456ghi789jkl012'},
            };

            expect(Utils.getActiveTabFromRoute(match)).toBe('wiki-abc123def456ghi789jkl012');
        });

        test('returns "messages" for wiki route without wikiId param', () => {
            const match = {
                path: '/wiki/:channelId([a-z0-9]{26})/:wikiId([a-z0-9]{26})',
                params: {},
            };

            expect(Utils.getActiveTabFromRoute(match)).toBe('messages');
        });
    });
});
