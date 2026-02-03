// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ChannelNotifyProps} from '@mattermost/types/channels';
import type {Post} from '@mattermost/types/posts';
import type {UsersState} from '@mattermost/types/users';

import {
    areChannelMentionsIgnored,
    filterChannelsMatchingTerm,
    sortChannelsByRecency,
    sortChannelsByDisplayName,
    sortChannelsByTypeListAndDisplayName,
    completeDirectGroupInfo,
} from 'mattermost-redux/utils/channel_utils';

import TestHelper from '../../test/test_helper';
import {General, Users} from '../constants';

describe('ChannelUtils', () => {
    it('areChannelMentionsIgnored', () => {
        const currentUserNotifyProps1 = TestHelper.fakeUserNotifyProps({channel: 'true'});
        const channelMemberNotifyProps1 = TestHelper.fakeChannelNotifyProps({ignore_channel_mentions: Users.IGNORE_CHANNEL_MENTIONS_DEFAULT as 'default'});
        expect(areChannelMentionsIgnored(channelMemberNotifyProps1, currentUserNotifyProps1)).toBe(false);

        const currentUserNotifyProps2 = TestHelper.fakeUserNotifyProps({channel: 'true'});
        const channelMemberNotifyProps2 = TestHelper.fakeChannelNotifyProps({ignore_channel_mentions: Users.IGNORE_CHANNEL_MENTIONS_OFF as 'off'});
        expect(areChannelMentionsIgnored(channelMemberNotifyProps2, currentUserNotifyProps2)).toBe(false);

        const currentUserNotifyProps3 = TestHelper.fakeUserNotifyProps({channel: 'true'});
        const channelMemberNotifyProps3 = TestHelper.fakeChannelNotifyProps({ignore_channel_mentions: Users.IGNORE_CHANNEL_MENTIONS_ON as 'on'});
        expect(areChannelMentionsIgnored(channelMemberNotifyProps3, currentUserNotifyProps3)).toBe(true);

        const currentUserNotifyProps4 = TestHelper.fakeUserNotifyProps({channel: 'false'});
        const channelMemberNotifyProps4 = TestHelper.fakeChannelNotifyProps({ignore_channel_mentions: Users.IGNORE_CHANNEL_MENTIONS_DEFAULT as 'default'});
        expect(areChannelMentionsIgnored(channelMemberNotifyProps4, currentUserNotifyProps4)).toBe(true);

        const currentUserNotifyProps5 = TestHelper.fakeUserNotifyProps({channel: 'false'});
        const channelMemberNotifyProps5 = TestHelper.fakeChannelNotifyProps({ignore_channel_mentions: Users.IGNORE_CHANNEL_MENTIONS_OFF as 'off'});
        expect(areChannelMentionsIgnored(channelMemberNotifyProps5, currentUserNotifyProps5)).toBe(false);

        const currentUserNotifyProps6 = TestHelper.fakeUserNotifyProps({channel: 'false'});
        const channelMemberNotifyProps6 = TestHelper.fakeChannelNotifyProps({ignore_channel_mentions: Users.IGNORE_CHANNEL_MENTIONS_ON as 'on'});
        expect(areChannelMentionsIgnored(channelMemberNotifyProps6, currentUserNotifyProps6)).toBe(true);

        const currentUserNotifyProps7 = TestHelper.fakeUserNotifyProps({channel: 'true'});
        const channelMemberNotifyProps7 = null as unknown as ChannelNotifyProps;
        expect(areChannelMentionsIgnored(channelMemberNotifyProps7, currentUserNotifyProps7)).toBe(false);

        const currentUserNotifyProps8 = TestHelper.fakeUserNotifyProps({channel: false as unknown as 'false'});
        const channelMemberNotifyProps8 = null as unknown as ChannelNotifyProps;
        expect(areChannelMentionsIgnored(channelMemberNotifyProps8, currentUserNotifyProps8)).toBe(false);
    });

    it('filterChannelsMatchingTerm', () => {
        const channel1 = TestHelper.fakeChannel('');
        channel1.display_name = 'channel1';
        channel1.name = 'blargh1';
        const channel2 = TestHelper.fakeChannel('');
        channel2.display_name = 'channel2';
        channel2.name = 'blargh2';
        const channels = [channel1, channel2];

        expect(filterChannelsMatchingTerm(channels, 'chan')).toEqual(channels);
        expect(filterChannelsMatchingTerm(channels, 'CHAN')).toEqual(channels);
        expect(filterChannelsMatchingTerm(channels, 'blargh')).toEqual(channels);
        expect(filterChannelsMatchingTerm(channels, 'channel1')).toEqual([channel1]);
        expect(filterChannelsMatchingTerm(channels, 'junk')).toEqual([]);
        expect(filterChannelsMatchingTerm(channels, 'annel')).toEqual([]);
    });

    it('sortChannelsByRecency', () => {
        const channelA = TestHelper.fakeChannel('');
        channelA.id = 'channel_a';
        channelA.last_post_at = 1;

        const channelB = TestHelper.fakeChannel('');
        channelB.last_post_at = 2;
        channelB.id = 'channel_b';

        // sorting depends on channel's last_post_at when both channels don't have last post
        expect(sortChannelsByRecency({}, channelA, channelB)).toBe(1);

        // sorting depends on create_at of channel's last post if it's greater than the channel's last_post_at
        const lastPosts: Record<string, Post> = {
            channel_a: TestHelper.fakePostOverride({id: 'post_id_1', create_at: 5, update_at: 5}),
            channel_b: TestHelper.fakePostOverride({id: 'post_id_2', create_at: 7, update_at: 7}),
        };

        // should return 2, comparison of create_at (7 - 5)
        expect(sortChannelsByRecency(lastPosts, channelA, channelB)).toBe(2);

        // sorting remains the same even if channel's last post is updated (e.g. edited, updated reaction, etc)
        lastPosts.channel_a.update_at = 10;

        // should return 2, comparison of create_at (7 - 5)
        expect(sortChannelsByRecency(lastPosts, channelA, channelB)).toBe(2);

        // sorting depends on create_at of channel's last post if it's greater than the channel's last_post_at
        lastPosts.channel_a.create_at = 10;

        // should return 2, comparison of create_at (7 - 10)
        expect(sortChannelsByRecency(lastPosts, channelA, channelB)).toBe(-3);
    });

    it('sortChannelsByDisplayName', () => {
        const channelA = TestHelper.fakeChannelOverride({
            name: 'channelA',
            team_id: 'teamId',
            display_name: 'Unit Test channelA',
            type: 'O',
            delete_at: 0,
        });

        const channelB = TestHelper.fakeChannelOverride({
            name: 'channelB',
            team_id: 'teamId',
            display_name: 'Unit Test channelB',
            type: 'O',
            delete_at: 0,
        });

        expect(sortChannelsByDisplayName('en', channelA, channelB)).toBe(-1);
        expect(sortChannelsByDisplayName('en', channelB, channelA)).toBe(1);

        // When a channel does not have a display name set
        Reflect.deleteProperty(channelB, 'display_name');
        expect(sortChannelsByDisplayName('en', channelA, channelB)).toBe(-1);
        expect(sortChannelsByDisplayName('en', channelB, channelA)).toBe(1);
    });

    it('sortChannelsByTypeListAndDisplayName', () => {
        const channelOpen1 = TestHelper.fakeChannelOverride({
            name: 'channelA',
            team_id: 'teamId',
            display_name: 'Unit Test channelA',
            type: General.OPEN_CHANNEL,
            delete_at: 0,
        });

        const channelOpen2 = TestHelper.fakeChannelOverride({
            name: 'channelB',
            team_id: 'teamId',
            display_name: 'Unit Test channelB',
            type: General.OPEN_CHANNEL,
            delete_at: 0,
        });

        const channelPrivate = TestHelper.fakeChannelOverride({
            name: 'channelC',
            team_id: 'teamId',
            display_name: 'Unit Test channelC',
            type: General.PRIVATE_CHANNEL,
            delete_at: 0,
        });

        const channelDM = TestHelper.fakeChannelOverride({
            name: 'channelD',
            team_id: 'teamId',
            display_name: 'Unit Test channelD',
            type: General.DM_CHANNEL,
            delete_at: 0,
        });

        const channelGM = TestHelper.fakeChannelOverride({
            name: 'channelE',
            team_id: 'teamId',
            display_name: 'Unit Test channelE',
            type: General.GM_CHANNEL,
            delete_at: 0,
        });

        let sortfn = sortChannelsByTypeListAndDisplayName.bind(null, 'en', [General.OPEN_CHANNEL, General.PRIVATE_CHANNEL, General.DM_CHANNEL, General.GM_CHANNEL]);
        const actual = [channelOpen1, channelPrivate, channelDM, channelGM, channelOpen2].sort(sortfn);
        const expected = [channelOpen1, channelOpen2, channelPrivate, channelDM, channelGM];
        expect(actual).toEqual(expected);

        // Skipped Open Channel type should sort last but open channels should still sort in alphabetical order
        sortfn = sortChannelsByTypeListAndDisplayName.bind(null, 'en', [General.DM_CHANNEL, General.GM_CHANNEL, General.PRIVATE_CHANNEL]);
        const actualOutput = JSON.stringify([channelOpen1, channelPrivate, channelDM, channelGM, channelOpen2].sort(sortfn));
        const expectedOutput = JSON.stringify([channelDM, channelGM, channelPrivate, channelOpen1, channelOpen2]);
        expect(actualOutput).toEqual(expectedOutput);
    });

    describe('completeDirectGroupInfo', () => {
        const currentUserId = 'current_user_id';
        const currentUser = {id: currentUserId, username: 'current_user_id', first_name: '', last_name: ''};
        const user1 = {id: 'user1', username: 'user1', first_name: '', last_name: ''};
        const user2 = {id: 'user2', username: 'user2', first_name: '', last_name: ''};
        const user3 = {id: 'user3', username: 'user3', first_name: '', last_name: ''};

        const usersState = {
            currentUserId,
            profiles: {
                [user1.id]: user1,
                [user2.id]: user2,
                [user3.id]: user3,
                [currentUserId]: currentUser,
            },
            profilesInChannel: {
                channel1: new Set([user1.id, user2.id]),
                channel2: new Set([user1.id, user2.id, user3.id]),
            },
        } as any as UsersState;

        const baseChannel = TestHelper.fakeChannelOverride({
            id: 'channel1',
            type: General.GM_CHANNEL,
            display_name: '',
        });

        it('should set display name from profilesInChannel', () => {
            const channel = {...baseChannel, id: 'channel1'};
            const result = completeDirectGroupInfo(usersState, 'username', channel);
            expect(result.display_name).toBe('user1, user2');
        });

        it('should set display name for larger group', () => {
            const channel = {...baseChannel, id: 'channel2'};
            const result = completeDirectGroupInfo(usersState, 'username', channel);
            expect(result.display_name).toBe('user1, user2, user3');
        });

        it('should use existing display_name when no profilesInChannel', () => {
            const channel = {...baseChannel, id: 'channel3', display_name: 'user1, user2'};
            const result = completeDirectGroupInfo(usersState, 'username', channel);
            expect(result.display_name).toBe('user1, user2');
        });

        it('should return original channel when usernames not found', () => {
            const channel = {...baseChannel, id: 'channel3', display_name: 'unknown1, unknown2'};
            const result = completeDirectGroupInfo(usersState, 'username', channel);
            expect(result).toBe(channel);
        });

        it('should include current user when omitCurrentUser is false', () => {
            const channel = {...baseChannel, id: 'channel1'};
            const result = completeDirectGroupInfo(usersState, 'username', channel, false);
            expect(result.display_name).toBe('current_user_id, user1, user2');
        });
    });
});
