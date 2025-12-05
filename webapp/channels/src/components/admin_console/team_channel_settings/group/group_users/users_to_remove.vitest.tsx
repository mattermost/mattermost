// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {TeamMembership} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {renderWithContext, waitFor} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import UsersToRemove from './users_to_remove';

describe('components/admin_console/team_channel_settings/group/UsersToRemove', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    function createUser(id: string, username: string, bot: boolean): UserProfile {
        return TestHelper.getUserMock({
            id,
            username,
            is_bot: bot,
        });
    }

    function createMembership(userId: string, admin: boolean): TeamMembership {
        return TestHelper.getTeamMembershipMock({
            user_id: userId,
            roles: admin ? 'team_user team_admin' : 'team_user',
            scheme_admin: admin,
        });
    }

    const user1 = createUser('userid1', 'user-1', false);
    const membership1 = createMembership('userId1', false);
    const user2 = createUser('userid2', 'user-2', false);
    const membership2 = createMembership('userId2', true);
    const scope: 'team' | 'channel' = 'team';
    const baseProps = {
        members: [user1, user2],
        memberships: {[user1.id]: membership1, [user2.id]: membership2},
        total: 2,
        searchTerm: '',
        scope,
        scopeId: 'team',
        enableGuestAccounts: true,
        filters: {},

        actions: {
            loadTeamMembersForProfilesList: vi.fn().mockResolvedValue({}),
            loadChannelMembersForProfilesList: vi.fn().mockResolvedValue({}),
            setModalSearchTerm: vi.fn(),
            setModalFilters: vi.fn(),
        },
    };

    test('should match snapshot with 2 users', async () => {
        const {container} = renderWithContext(
            <UsersToRemove
                {...baseProps}
            />,
        );
        await waitFor(() => {
            expect(baseProps.actions.loadTeamMembersForProfilesList).toHaveBeenCalled();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with guests disabled', async () => {
        const {container} = renderWithContext(
            <UsersToRemove
                {...baseProps}
                enableGuestAccounts={false}
            />,
        );
        await waitFor(() => {
            expect(baseProps.actions.loadTeamMembersForProfilesList).toHaveBeenCalled();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot searching with filters', async () => {
        const {container} = renderWithContext(
            <UsersToRemove
                {...baseProps}
                searchTerm={'foo'}
                filters={{roles: ['system_user']}}
            />,
        );
        await waitFor(() => {
            expect(baseProps.actions.loadTeamMembersForProfilesList).toHaveBeenCalled();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot loading', async () => {
        // Simulate loading state by providing empty members and total
        const {container} = renderWithContext(
            <UsersToRemove
                {...baseProps}
                members={[]}
                total={0}
            />,
        );

        // When members is empty, componentDidMount won't call loadTeamMembersForProfilesList
        // but will still update loading state
        await waitFor(() => {
            // Wait for component to finish mounting
            expect(container.querySelector('.DataGrid_loading')).not.toBeInTheDocument();
        });
        expect(container).toMatchSnapshot();
    });
});
