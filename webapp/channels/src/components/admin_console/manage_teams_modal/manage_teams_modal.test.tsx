// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen, waitFor} from '@testing-library/react';
import {act} from 'react-dom/test-utils';

import {General} from 'mattermost-redux/constants';

import ManageTeamsModal from 'components/admin_console/manage_teams_modal/manage_teams_modal';
import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

// Mock the ManageTeamsDropdown component to avoid testing its internal logic
jest.mock('./manage_teams_dropdown', () => {
    return jest.fn((props) => {
        // Store props on mock function for later assertions
        (jest.fn as any).mockDropdownProps = props;
        return <div data-testid="mock-manage-teams-dropdown" />;
    });
});

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
        let container;
        await act(async () => {
            const result = renderWithContext(<ManageTeamsModal {...baseProps}/>);
            container = result.container;
        });
        expect(container).toMatchSnapshot();
    });

    test('should call api calls on mount', async () => {
        await act(async () => {
            renderWithContext(<ManageTeamsModal {...baseProps}/>);
        });

        expect(baseProps.actions.getTeamMembersForUser).toHaveBeenCalledTimes(1);
        expect(baseProps.actions.getTeamMembersForUser).toHaveBeenCalledWith(baseProps.user.id);
        expect(baseProps.actions.getTeamsForUser).toHaveBeenCalledTimes(1);
        expect(baseProps.actions.getTeamsForUser).toHaveBeenCalledWith(baseProps.user.id);
    });

    test('should render teams and team members from api calls', async () => {
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

        await act(async () => {
            renderWithContext(<ManageTeamsModal {...props}/>);
        });

        // Wait for the team name to appear in the DOM
        await waitFor(() => {
            expect(screen.getByText('testTeam')).toBeInTheDocument();
        });

        // Check that the ManageTeamsDropdown received the correct props
        const ManageTeamsDropdown = require('./manage_teams_dropdown');
        expect(ManageTeamsDropdown).toHaveBeenCalled();
        expect((jest.fn as any).mockDropdownProps.teamMember).toEqual({team_id: '123test'});
    });
});
