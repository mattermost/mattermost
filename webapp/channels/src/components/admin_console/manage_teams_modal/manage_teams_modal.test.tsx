// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {General} from 'mattermost-redux/constants';

import ManageTeamsModal from 'components/admin_console/manage_teams_modal/manage_teams_modal';

import {renderWithContext, runPostRenderAct, screen, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

/**
 * `runPostRenderAct` rounds (each `await Promise.resolve()`): (1) passive effects run so `useEffect`
 * starts `loadTeamsAndTeamMembers`; (2) mocked `actions.getTeamMembersForUser` resolves →
 * `getTeamMembers` → `setTeamMembers`; (3) mocked `actions.getTeamsForUser` resolves → `setTeams`.
 */
const MANAGE_TEAMS_MODAL_ASYNC_ROUNDS = 3;

describe('ManageTeamsModal', () => {
    const baseProps = {
        locale: General.DEFAULT_LOCALE,
        onHide: jest.fn(),
        onExited: jest.fn(),
        user: TestHelper.getUserMock({
            id: 'currentUserId',
            last_picture_update: 1234,
            email: 'currentUser@test.com',
            roles: 'system_user',
            username: 'currentUsername',
        }),
        actions: {
            getTeamMembersForUser: jest.fn().mockReturnValue(Promise.resolve({data: []})),
            getTeamsForUser: jest.fn().mockReturnValue(Promise.resolve({data: []})),
            updateTeamMemberSchemeRoles: jest.fn(),
            removeUserFromTeam: jest.fn(),
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should match snapshot init', async () => {
        const {baseElement} = renderWithContext(
            <ManageTeamsModal {...baseProps}/>,
        );

        await runPostRenderAct(MANAGE_TEAMS_MODAL_ASYNC_ROUNDS);

        expect(baseProps.actions.getTeamMembersForUser).toHaveBeenCalledTimes(1);
        expect(baseProps.actions.getTeamsForUser).toHaveBeenCalledTimes(1);

        expect(screen.getByText('Manage Teams')).toBeInTheDocument();
        expect(screen.getByText('@currentUsername')).toBeInTheDocument();
        expect(screen.getByText('currentUser@test.com')).toBeInTheDocument();

        expect(baseElement).toMatchSnapshot();
    });

    test('should call api calls on mount', async () => {
        renderWithContext(
            <ManageTeamsModal {...baseProps}/>,
        );
        await runPostRenderAct(MANAGE_TEAMS_MODAL_ASYNC_ROUNDS);

        expect(baseProps.actions.getTeamMembersForUser).toHaveBeenCalledTimes(1);
        expect(baseProps.actions.getTeamMembersForUser).toHaveBeenCalledWith(baseProps.user.id);
        expect(baseProps.actions.getTeamsForUser).toHaveBeenCalledTimes(1);
        expect(baseProps.actions.getTeamsForUser).toHaveBeenCalledWith(baseProps.user.id);
    });

    test('should show team from api data after load', async () => {
        const mockTeamData = TestHelper.getTeamMock({
            id: '123test',
            name: 'testTeam',
            display_name: 'testTeam',
            delete_at: 0,
        });

        const getTeamMembersForUser = jest.fn().mockReturnValue(Promise.resolve({data: [{team_id: '123test'}]}));
        const getTeamsForUser = jest.fn().mockReturnValue(Promise.resolve({data: [mockTeamData]}));

        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                getTeamMembersForUser,
                getTeamsForUser,
            },
        };

        renderWithContext(
            <ManageTeamsModal {...props}/>,
        );

        await waitFor(() => {
            expect(screen.getByText(mockTeamData.display_name)).toBeInTheDocument();
        });

        // Non-system-admin users get ManageTeamsDropdown; default role label for plain membership.
        expect(screen.getByText('Team Member')).toBeInTheDocument();
    });
});
