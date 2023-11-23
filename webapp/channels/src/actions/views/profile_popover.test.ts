// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getChannelMember} from 'mattermost-redux/actions/channels';
import {getTeamMember} from 'mattermost-redux/actions/teams';

import testConfigureStore from 'tests/test_store';

import {getMembershipForEntities} from './profile_popover';

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

    test('should only fetch team member in a DM/GM', () => {
        const store = testConfigureStore(baseState);

        store.dispatch(getMembershipForEntities(teamId, userId, ''));

        expect(getChannelMemberMock).not.toHaveBeenCalled();
        expect(getTeamMemberMock).toHaveBeenCalledWith(teamId, userId);
    });

    test('should fetch both team and channel member for regular channels', () => {
        const store = testConfigureStore(baseState);

        store.dispatch(getMembershipForEntities(teamId, userId, channelId));

        expect(getChannelMemberMock).toHaveBeenCalledWith(channelId, userId);
        expect(getTeamMemberMock).toHaveBeenCalledWith(teamId, userId);
    });
});
