// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getChannelMember} from 'mattermost-redux/actions/channels';
import {getTeamMember} from 'mattermost-redux/actions/teams';

import testConfigureStore from 'tests/test_store';

import {TestHelper} from 'utils/test_helper';

import {getMembershipForEntities} from './profile_popover';
import mergeObjects from 'packages/mattermost-redux/test/merge_objects';

jest.mock('mattermost-redux/actions/channels', () => ({
    getChannelMember: jest.fn(() => ({type: 'GET_CHANNEL_MEMBER'})),
}));
jest.mock('mattermost-redux/actions/teams', () => ({
    getTeamMember: jest.fn(() => ({type: 'GET_TEAM_MEMBER'})),
}));

describe('getMembershipForEntities', () => {
    const baseState = {
        entities: {
            channels: {
                membersInChannel: {},
            },
            teams: {
                membersInTeam: {},
            },
        },
    };

    const userId = 'userId';
    const teamId = 'teamId';
    const channelId = 'channelId';

    const getChannelMemberMock = getChannelMember as jest.Mock;
    const getTeamMemberMock = getTeamMember as jest.Mock;

    test('should not fetch channel member in a DM/GM', () => {
        const store = testConfigureStore(baseState);

        store.dispatch(getMembershipForEntities(userId, teamId, ''));

        expect(getChannelMemberMock).not.toHaveBeenCalled();
    });

    test('should only fetch channel member when not already loaded', () => {
        let store = testConfigureStore(baseState);

        store.dispatch(getMembershipForEntities(teamId, userId, channelId));

        expect(getChannelMemberMock).toHaveBeenCalledWith(channelId, userId);

        jest.clearAllMocks();

        store = testConfigureStore(mergeObjects(baseState, {
            entities: {
                channels: {
                    membersInChannel: {
                        channelId: {
                            userId: TestHelper.getChannelMembershipMock({user_id: userId, channel_id: channelId}),
                        },
                    },
                },
            },
        }));

        store.dispatch(getMembershipForEntities(teamId, userId, channelId));

        expect(getChannelMemberMock).not.toHaveBeenCalled();
    });

    test('should only fetch team member when not already loaded', () => {
        let store = testConfigureStore(baseState);

        store.dispatch(getMembershipForEntities(teamId, userId, channelId));

        expect(getTeamMemberMock).toHaveBeenCalledWith(teamId, userId);

        jest.clearAllMocks();

        store = testConfigureStore(mergeObjects(baseState, {
            entities: {
                teams: {
                    membersInTeam: {
                        teamId: {
                            userId: TestHelper.getTeamMembershipMock({user_id: userId, team_id: teamId}),
                        },
                    },
                },
            },
        }));

        store.dispatch(getMembershipForEntities(teamId, userId, channelId));

        expect(getTeamMemberMock).not.toHaveBeenCalled();
    });
});
