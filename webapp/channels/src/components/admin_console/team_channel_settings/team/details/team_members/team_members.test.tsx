// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import type {Team, TeamMembership} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {TestHelper} from 'utils/test_helper';

import TeamMembers from './team_members';

describe('admin_console/team_channel_settings/team/TeamMembers', () => {
    const user1: UserProfile = Object.assign(TestHelper.getUserMock({id: 'user-1'}));
    const membership1: TeamMembership = Object.assign(TestHelper.getTeamMembershipMock({user_id: 'user-1'}));
    const user2: UserProfile = Object.assign(TestHelper.getUserMock({id: 'user-2'}));
    const membership2: TeamMembership = Object.assign(TestHelper.getTeamMembershipMock({user_id: 'user-2'}));
    const user3: UserProfile = Object.assign(TestHelper.getUserMock({id: 'user-3'}));
    const membership3: TeamMembership = Object.assign(TestHelper.getTeamMembershipMock({user_id: 'user-3'}));
    const team: Team = Object.assign(TestHelper.getTeamMock({id: 'team-1'}));

    const baseProps = {
        filters: {},
        teamId: 'team-1',
        team,
        users: [user1, user2, user3],
        usersToRemove: {},
        usersToAdd: {},
        teamMembers: {
            [user1.id]: membership1,
            [user2.id]: membership2,
            [user3.id]: membership3,
        },
        enableGuestAccounts: true,

        totalCount: 3,
        loading: false,
        searchTerm: '',
        onAddCallback: jest.fn(),
        onRemoveCallback: jest.fn(),
        updateRole: jest.fn(),

        actions: {
            getTeamStats: jest.fn(),
            loadProfilesAndReloadTeamMembers: jest.fn(),
            searchProfilesAndTeamMembers: jest.fn(),
            getFilteredUsersStats: jest.fn(),
            setUserGridSearch: jest.fn(),
            setUserGridFilters: jest.fn(),
        },
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <TeamMembers {...baseProps}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot loading no users', () => {
        const wrapper = shallow(
            <TeamMembers
                {...baseProps}
                users={[]}
                teamMembers={{}}
                totalCount={0}
                loading={true}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
