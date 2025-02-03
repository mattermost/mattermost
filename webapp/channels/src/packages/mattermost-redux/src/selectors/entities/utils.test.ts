// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {General} from 'mattermost-redux/constants';
import deepFreezeAndThrowOnMutation from 'mattermost-redux/utils/deep_freeze';

import {makeAddLastViewAtToProfiles} from './utils';

import TestHelper from '../../../test/test_helper';

describe('utils.makeAddLastViewAtToProfiles', () => {
    it('Should return profiles with last_viewed_at from membership if channel and membership exists', () => {
        const currentUser = TestHelper.fakeUserWithStatus(General.ONLINE);
        const user1 = TestHelper.fakeUserWithStatus(General.OUT_OF_OFFICE);
        const user2 = TestHelper.fakeUserWithStatus(General.OFFLINE);
        const user3 = TestHelper.fakeUserWithStatus(General.DND);
        const user4 = TestHelper.fakeUserWithStatus(General.AWAY);

        const profiles = {
            [user1.id]: user1,
            [user2.id]: user2,
            [user3.id]: user3,
            [user4.id]: user4,
        };

        const statuses = {
            [user1.id]: user1.status,
            [user2.id]: user2.status,
            [user3.id]: user3.status,
            [user4.id]: user4.status,
        };

        const channel1 = TestHelper.fakeDmChannel(currentUser.id, user1.id);
        const channel2 = TestHelper.fakeDmChannel(currentUser.id, user2.id);
        const channel3 = TestHelper.fakeDmChannel(currentUser.id, user3.id);

        const channels = {
            [channel1.id]: channel1,
            [channel2.id]: channel2,
            [channel3.id]: channel3,
        };

        const membership1 = {...TestHelper.fakeChannelMember(currentUser.id, channel1.id), last_viewed_at: 1};
        const membership2 = {...TestHelper.fakeChannelMember(currentUser.id, channel2.id), last_viewed_at: 2};
        const membership3 = {...TestHelper.fakeChannelMember(currentUser.id, channel3.id), last_viewed_at: 3};

        const myMembers = {
            [membership1.channel_id]: membership1,
            [membership2.channel_id]: membership2,
            [membership3.channel_id]: membership3,
        };

        const channelsInTeam = {
            '': new Set([channel1.id, channel2.id, channel3.id]),
        };

        const testState = deepFreezeAndThrowOnMutation({
            entities: {
                users: {
                    currentUserId: currentUser.id,
                    profiles,
                    statuses,
                },
                teams: {
                    currentTeamId: 'currentTeam',
                },
                channels: {
                    channels,
                    channelsInTeam,
                    myMembers,
                },
                general: {
                    config: {},
                },
                preferences: {
                    myPreferences: {},
                },
            },
        });

        const addLastViewAtToProfiles = makeAddLastViewAtToProfiles();
        expect(addLastViewAtToProfiles(testState, [user1, user2, user3, user4])).toEqual([{...user1, last_viewed_at: 1}, {...user2, last_viewed_at: 2}, {...user3, last_viewed_at: 3}, {...user4, last_viewed_at: 0}]);
    });
});
