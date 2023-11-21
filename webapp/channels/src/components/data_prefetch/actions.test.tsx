// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel, ChannelMembership} from '@mattermost/types/channels';
import type {RelationOneToOne} from '@mattermost/types/utilities';

import {TestHelper} from 'utils/test_helper';

import {prefetchQueue} from './actions';

describe('DataPrefetchActions', () => {
    const unreadChannels: Channel[] = [];
    const channelMemberships: RelationOneToOne<Channel, ChannelMembership> = {};
    for (let i = 0; i < 25; i++) {
        unreadChannels.push(TestHelper.getChannelMock({id: 'channel' + i}));
        channelMemberships['channel' + i] = TestHelper.getChannelMembershipMock({channel_id: 'channel' + i});
    }

    const mentionChannels: Channel[] = [];
    for (let i = 25; i < 50; i++) {
        mentionChannels.push(TestHelper.getChannelMock({id: 'channel' + i}));
        channelMemberships['channel' + i] = TestHelper.getChannelMembershipMock({channel_id: 'channel' + i, mention_count_root: 1});
    }

    it('prefetchQueue', () => {
        // Unread channels only
        expect(prefetchQueue(unreadChannels, channelMemberships, true)).toEqual({1: [], 2: [], 3: []});

        const unreadChannels9 = unreadChannels.slice(0, 9);
        let unreadQueue = prefetchQueue(unreadChannels9, channelMemberships, true);
        expect(unreadQueue['1'].length).toBe(0);
        expect(unreadQueue['2'].length).toBe(9);

        const unreadChannels10 = unreadChannels.slice(0, 10);
        unreadQueue = prefetchQueue(unreadChannels10, channelMemberships, true);
        expect(unreadQueue['1'].length).toBe(0);
        expect(unreadQueue['2'].length).toBe(0);

        // Mention channels only
        expect(prefetchQueue(mentionChannels, channelMemberships, true)).toEqual({1: [], 2: [], 3: []});

        const mentionChannels9 = mentionChannels.slice(0, 9);
        let mentionQueue = prefetchQueue(mentionChannels9, channelMemberships, true);
        expect(mentionQueue['1'].length).toBe(9);
        expect(unreadQueue['2'].length).toBe(0);

        const mentionChannels10 = mentionChannels.slice(0, 10);
        mentionQueue = prefetchQueue(mentionChannels10, channelMemberships, true);
        expect(mentionQueue['1'].length).toBe(10);
        expect(unreadQueue['2'].length).toBe(0);

        // Mixing unread and mention channels
        expect(prefetchQueue([...unreadChannels, ...mentionChannels], channelMemberships, true)).toEqual({1: [], 2: [], 3: []});

        const mixedQueue = prefetchQueue([...unreadChannels9, ...mentionChannels10], channelMemberships, true);
        expect(mixedQueue['1'].length).toBe(10);
        expect(mixedQueue['2'].length).toBe(0);
    });
});
