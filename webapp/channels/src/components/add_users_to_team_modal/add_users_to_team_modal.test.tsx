// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {defaultIntl} from 'tests/helpers/intl-test-helper';
import {renderWithContext, act} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import {AddUsersToTeamModal} from './add_users_to_team_modal';
import type {AddUsersToTeamModal as AddUsersToTeamModalClass} from './add_users_to_team_modal';

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
        intl: defaultIntl,

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
        const {baseElement} = renderWithContext(
            <AddUsersToTeamModal
                {...baseProps}
            />,
        );
        expect(baseElement).toMatchSnapshot();
    });

    test('should match snapshot with 2 users, 1 included and 1 removed', () => {
        const {container} = renderWithContext(
            <AddUsersToTeamModal
                {...baseProps}
                includeUsers={{[removedUser.id]: removedUser}}
                excludeUsers={{[user1.id]: user1}}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match state when handleHide is called', () => {
        const ref = React.createRef<AddUsersToTeamModalClass>();
        renderWithContext(
            <AddUsersToTeamModal
                {...baseProps}
                ref={ref}
            />,
        );

        act(() => {
            ref.current!.setState({show: true});
        });
        act(() => {
            ref.current!.handleHide();
        });
        expect(ref.current!.state.show).toEqual(false);
    });

    test('should search', () => {
        const ref = React.createRef<AddUsersToTeamModalClass>();
        renderWithContext(
            <AddUsersToTeamModal
                {...baseProps}
                ref={ref}
            />,
        );
        const addUsers = ref.current!;

        // search profiles when search term given
        act(() => {
            addUsers.search('foo');
        });
        expect(baseProps.actions.searchProfiles).toHaveBeenCalledTimes(1);
        expect(baseProps.actions.getProfilesNotInTeam).toHaveBeenCalledTimes(1);

        // get profiles when no search term
        act(() => {
            addUsers.search('');
        });
        expect(baseProps.actions.searchProfiles).toHaveBeenCalledTimes(1);
        expect(baseProps.actions.getProfilesNotInTeam).toHaveBeenCalledTimes(2);
    });
});
