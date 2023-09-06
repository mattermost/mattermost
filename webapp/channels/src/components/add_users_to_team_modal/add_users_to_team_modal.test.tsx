// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {TestHelper} from 'utils/test_helper';

import AddUsersToTeamModal from './add_users_to_team_modal';

describe('components/admin_console/add_users_to_team_modal/AddUsersToTeamModal', () => {
    function createUser(id: string, username: string, bot: boolean): UserProfile {
        return TestHelper.getUserMock({
            id,
            username,
            is_bot: bot,
        });
    }

    const user1 = createUser('userid1', 'user-1', false);
    const user2 = createUser('userid2', 'user-2', false);
    const removedUser = createUser('userid-not-removed', 'user-not-removed', false);
    const team: Team = TestHelper.getTeamMock({
        id: 'team-1',
        create_at: 1589222794545,
        update_at: 1589222794545,
        delete_at: 0,
        display_name: 'test-team',
        name: 'test-team',
        description: '',
        email: '',
        type: 'O',
        company_name: '',
        allowed_domains: '',
        invite_id: '',
        allow_open_invite: true,
        scheme_id: '',
        group_constrained: false,
    });

    const baseProps = {
        team,
        users: [user1, user2],

        excludeUsers: {},
        includeUsers: {},

        onAddCallback: jest.fn(),
        onExited: jest.fn(),

        actions: {
            getProfilesNotInTeam: jest.fn(),
            searchProfiles: jest.fn().mockResolvedValue({data: []}),
        },
    };

    test('should match snapshot with 2 users', () => {
        const wrapper = shallow(
            <AddUsersToTeamModal
                {...baseProps}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with 2 users, 1 included and 1 removed', () => {
        const wrapper = shallow(
            <AddUsersToTeamModal
                {...baseProps}
                includeUsers={{[removedUser.id]: removedUser}}
                excludeUsers={{[user1.id]: user1}}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match state when handleHide is called', () => {
        const wrapper = shallow(
            <AddUsersToTeamModal {...baseProps}/>,
        );

        wrapper.setState({show: true});
        (wrapper.instance() as AddUsersToTeamModal).handleHide();
        expect(wrapper.state('show')).toEqual(false);
    });

    test('should search', () => {
        const wrapper = shallow(
            <AddUsersToTeamModal
                {...baseProps}
            />,
        );
        const addUsers = wrapper.instance() as AddUsersToTeamModal;

        // search profiles when search term given
        addUsers.search('foo');
        expect(baseProps.actions.searchProfiles).toHaveBeenCalledTimes(1);
        expect(baseProps.actions.getProfilesNotInTeam).toHaveBeenCalledTimes(1);

        // get profiles when no search term
        addUsers.search('');
        expect(baseProps.actions.searchProfiles).toHaveBeenCalledTimes(1);
        expect(baseProps.actions.getProfilesNotInTeam).toHaveBeenCalledTimes(2);
    });
});
