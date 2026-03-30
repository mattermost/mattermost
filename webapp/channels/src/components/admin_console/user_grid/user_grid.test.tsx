// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {TeamMembership} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import UserGrid from './user_grid';

describe('components/admin_console/user_grid/UserGrid', () => {
    function createUser(id: string, username: string, bot: boolean): UserProfile {
        return TestHelper.getUserMock({
            id,
            username,
            is_bot: bot,
        });
    }

    function createMembership(userId: string, admin: boolean): TeamMembership {
        return TestHelper.getTeamMembershipMock({
            team_id: 'team',
            user_id: userId,
            roles: admin ? 'team_user team_admin' : 'team_user',
            scheme_admin: admin,
        });
    }

    const user1 = createUser('userid1', 'user-1', false);
    const membership1 = createMembership('userId1', false);
    const user2 = createUser('userid2', 'user-2', false);
    const membership2 = createMembership('userId2', false);
    const notSavedUser = createUser('userid-not-saved', 'user-not-saved', false);
    const scope: 'team' | 'channel' = 'team';
    const baseProps = {
        users: [user1, user2],
        memberships: {[user1.id]: membership1, [user2.id]: membership2},

        excludeUsers: {},
        includeUsers: {},
        scope,

        loadPage: jest.fn(),
        onSearch: jest.fn(),
        removeUser: jest.fn(),
        updateMembership: jest.fn(),

        totalCount: 2,
        loading: false,
        term: '',

        filterProps: {
            options: {},
            keys: [],
            onFilter: jest.fn(),
        },
    };

    test('should match snapshot with 2 users', () => {
        const {container} = renderWithContext(
            <UserGrid
                {...baseProps}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with 2 users and 1 added included', () => {
        const {container} = renderWithContext(
            <UserGrid
                {...baseProps}
                includeUsers={{[notSavedUser.id]: notSavedUser}}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with 2 users and 1 removed user', () => {
        const {container} = renderWithContext(
            <UserGrid
                {...baseProps}
                excludeUsers={{[user1.id]: user1}}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should return pagination props while taking into account added or removed users when getPaginationProps is called', () => {
        // Test initial state: 2 users should show "1 - 2 of 2"
        const {rerender} = renderWithContext(
            <UserGrid {...baseProps}/>,
        );

        expect(screen.getByText('1 - 2 of 2')).toBeInTheDocument();

        // Test with 1 included user: should show "1 - 3 of 3"
        rerender(
            <UserGrid
                {...baseProps}
                includeUsers={{[notSavedUser.id]: notSavedUser}}
            />,
        );

        expect(screen.getByText('1 - 3 of 3')).toBeInTheDocument();

        // Test with 1 excluded user: should show "1 - 1 of 1"
        rerender(
            <UserGrid
                {...baseProps}
                includeUsers={{}}
                excludeUsers={{[user1.id]: user1}}
            />,
        );

        expect(screen.getByText('1 - 1 of 1')).toBeInTheDocument();
    });
});
