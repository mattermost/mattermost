// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen} from '@testing-library/react';
import {useSelector, useDispatch} from 'react-redux';

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getProfilesInChannel} from 'mattermost-redux/actions/users';

import MembersTab from 'components/persistent_rhs/members_tab';
import DMListPage from 'components/dm_list_page';
import {loadStatusesForProfilesList, loadStatusesByIds} from 'actions/status_actions';

jest.mock('react-redux', () => ({
    useSelector: jest.fn(),
    useDispatch: jest.fn(),
}));

jest.mock('mattermost-redux/selectors/entities/channels', () => ({
    getCurrentChannel: jest.fn(),
    getCurrentChannelId: jest.fn(),
}));

jest.mock('mattermost-redux/selectors/entities/preferences', () => ({
    getTeammateNameDisplaySetting: jest.fn(),
}));

jest.mock('mattermost-redux/selectors/entities/users', () => ({
    getCurrentUserId: jest.fn(),
}));

jest.mock('mattermost-redux/selectors/entities/teams', () => ({
    getCurrentRelativeTeamUrl: jest.fn(),
}));

jest.mock('mattermost-redux/actions/users', () => ({
    getProfilesInChannel: jest.fn(),
}));

jest.mock('mattermost-redux/actions/channels', () => ({
    getChannelMembers: jest.fn(() => ({type: 'MOCK_GET_CHANNEL_MEMBERS'})),
}));

jest.mock('mattermost-redux/actions/posts', () => ({
    getPosts: jest.fn(() => ({type: 'MOCK_GET_POSTS'})),
}));

jest.mock('actions/status_actions', () => ({
    loadStatusesForProfilesList: jest.fn(() => ({type: 'MOCK_LOAD_STATUSES_LIST'})),
    loadStatusesByIds: jest.fn(() => ({type: 'MOCK_LOAD_STATUSES_IDS'})),
}));

jest.mock('selectors/views/guilded_layout', () => ({
    getChannelMembersGroupedByStatus: jest.fn(),
    getAllDmChannelsWithUsers: jest.fn(),
    getLastPostInChannel: jest.fn(),
}));

jest.mock('react-router-dom', () => ({
    useHistory: () => ({
        push: jest.fn(),
    }),
}));

describe('Guilded Layout Status Syncing', () => {
    const dispatch = jest.fn();

    beforeEach(() => {
        (useDispatch as jest.Mock).mockReturnValue(dispatch);
        dispatch.mockClear();
    });

    describe('MembersTab', () => {
        it('should load statuses when profiles are fetched on mount', async () => {
            const mockChannel = {id: 'channel_id_1'};
            const mockProfiles = [{id: 'user_1'}, {id: 'user_2'}];
            
            (useSelector as jest.Mock).mockImplementation((selector) => {
                if (selector === getCurrentChannel) {
                    return mockChannel;
                }
                return null;
            });

            (getProfilesInChannel as jest.Mock).mockReturnValue(() => Promise.resolve({data: mockProfiles}));

            render(<MembersTab />);

            // Wait for the promise to resolve
            await new Promise((resolve) => setTimeout(resolve, 0));

            expect(getProfilesInChannel).toHaveBeenCalledWith('channel_id_1', 0, 100);
            expect(loadStatusesForProfilesList).toHaveBeenCalledWith(mockProfiles);
            expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({type: 'MOCK_LOAD_STATUSES_LIST'}));
        });
    });

    describe('DMListPage', () => {
        it('should load statuses for all DM users on mount', () => {
            const mockDms = [
                {type: 'dm', user: {id: 'user_dm_1'}, channel: {id: 'chan_1'}},
                {type: 'group', users: [{id: 'user_gm_1'}, {id: 'user_gm_2'}], channel: {id: 'chan_2'}},
            ];

            (useSelector as jest.Mock).mockImplementation((selector) => {
                // This is a bit simplified, in reality it would be the selector function itself
                return mockDms;
            });

            // We need to mock the specific call to getAllDmChannelsWithUsers
            // In the component: const allDms = useSelector(getAllDmChannelsWithUsers);
            (useSelector as jest.Mock).mockReturnValue(mockDms);

            render(<DMListPage />);

            expect(loadStatusesByIds).toHaveBeenCalledWith(['user_dm_1', 'user_gm_1', 'user_gm_2']);
            expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({type: 'MOCK_LOAD_STATUSES_IDS'}));
        });
    });
});
