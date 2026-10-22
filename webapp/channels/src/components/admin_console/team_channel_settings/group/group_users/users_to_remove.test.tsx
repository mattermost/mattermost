// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import UsersToRemove from './users_to_remove';

describe('components/admin_console/team_channel_settings/group/UsersToRemove', () => {
    const user1 = TestHelper.getUserMock({id: 'userid1', username: 'user-1', is_bot: false});
    const membership1 = TestHelper.getTeamMembershipMock({user_id: 'userid1', roles: 'team_user', scheme_admin: false});
    const user2 = TestHelper.getUserMock({id: 'userid2', username: 'user-2', is_bot: false});
    const membership2 = TestHelper.getTeamMembershipMock({user_id: 'userid2', roles: 'team_user team_admin', scheme_admin: true});
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
            loadTeamMembersForProfilesList: jest.fn().mockResolvedValue({}),
            loadChannelMembersForProfilesList: jest.fn().mockResolvedValue({}),
            setModalSearchTerm: jest.fn(),
            setModalFilters: jest.fn(),
        },
    };

    test('should match snapshot with 2 users', async () => {
        const {container} = renderWithContext(
            <UsersToRemove
                {...baseProps}
            />,
        );

        await waitFor(() => {
            expect(container.querySelector('.DataGrid_loading')).not.toBeInTheDocument();
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
            expect(container.querySelector('.DataGrid_loading')).not.toBeInTheDocument();
        });

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot loading', () => {
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                loadTeamMembersForProfilesList: jest.fn().mockReturnValue(new Promise(() => {})),
                loadChannelMembersForProfilesList: jest.fn().mockReturnValue(new Promise(() => {})),
            },
        };

        const {container} = renderWithContext(
            <UsersToRemove
                {...props}
            />,
        );

        expect(container).toMatchSnapshot();
    });
});
