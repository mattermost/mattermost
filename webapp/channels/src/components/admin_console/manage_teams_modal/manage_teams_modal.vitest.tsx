// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {General} from 'mattermost-redux/constants';

import {renderWithContext, screen, waitFor, act} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ManageTeamsModal from './manage_teams_modal';

describe('ManageTeamsModal', () => {
    const user = TestHelper.getUserMock({
        id: 'currentUserId',
        last_picture_update: 1234,
        email: 'currentUser@test.com',
        roles: 'system_user',
        username: 'currentUsername',
    });

    const createBaseProps = () => ({
        locale: General.DEFAULT_LOCALE,
        onHide: vi.fn(),
        onExited: vi.fn(),
        user,
        actions: {
            getTeamMembersForUser: vi.fn().mockReturnValue(Promise.resolve({data: []})),
            getTeamsForUser: vi.fn().mockReturnValue(Promise.resolve({data: []})),
            updateTeamMemberSchemeRoles: vi.fn(),
            removeUserFromTeam: vi.fn(),
        },
    });

    test('should match snapshot init', async () => {
        const props = createBaseProps();
        const {baseElement} = renderWithContext(<ManageTeamsModal {...props}/>);
        await waitFor(() => {
            expect(props.actions.getTeamMembersForUser).toHaveBeenCalled();
        });
        expect(baseElement).toMatchSnapshot();
    });

    test('should call api calls on mount', async () => {
        const props = createBaseProps();
        renderWithContext(<ManageTeamsModal {...props}/>);

        await waitFor(() => {
            expect(props.actions.getTeamMembersForUser).toHaveBeenCalledTimes(1);
        });

        expect(props.actions.getTeamMembersForUser).toHaveBeenCalledWith(props.user.id);
        expect(props.actions.getTeamsForUser).toHaveBeenCalledTimes(1);
        expect(props.actions.getTeamsForUser).toHaveBeenCalledWith(props.user.id);
    });

    test('should save data in state from api calls', async () => {
        const mockTeamData = TestHelper.getTeamMock({
            id: '123test',
            name: 'testTeam',
            display_name: 'testTeam',
            delete_at: 0,
        });

        const getTeamMembersForUser = vi.fn().mockReturnValue(Promise.resolve({data: [{team_id: '123test'}]}));
        const getTeamsForUser = vi.fn().mockReturnValue(Promise.resolve({data: [mockTeamData]}));

        const props = {
            ...createBaseProps(),
            actions: {
                getTeamMembersForUser,
                getTeamsForUser,
                updateTeamMemberSchemeRoles: vi.fn(),
                removeUserFromTeam: vi.fn(),
            },
        };

        await act(async () => {
            renderWithContext(<ManageTeamsModal {...props}/>);
        });

        // Wait for the team name to appear
        await waitFor(() => {
            expect(screen.getByText(mockTeamData.display_name)).toBeInTheDocument();
        });
    });
});
