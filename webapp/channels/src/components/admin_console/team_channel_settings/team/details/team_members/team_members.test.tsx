// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// No direct testing library imports needed
import React from 'react';

import type {Team, TeamMembership} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import TeamMembers from './team_members';

// Mock components to simplify testing
jest.mock('components/admin_console/user_grid/user_grid', () => {
    return function MockUserGrid() {
        return <div data-testid='user-grid'/>;
    };
});

jest.mock('components/widgets/admin_console/admin_panel', () => {
    return function MockAdminPanel(props: any) {
        return (
            <div data-testid='admin-panel'>
                <div className='header'>{typeof props.title === 'object' ? props.title.defaultMessage : props.title}</div>
                <div className='body'>{props.children}</div>
            </div>
        );
    };
});

jest.mock('components/toggle_modal_button', () => {
    return function MockToggleModalButton(props: any) {
        return <button data-testid='toggle-modal-button'>{props.children}</button>;
    };
});

describe('admin_console/team_channel_settings/team/TeamMembers', () => {
    const user1: UserProfile = TestHelper.getUserMock({id: 'user-1'});
    const membership1: TeamMembership = TestHelper.getTeamMembershipMock({user_id: 'user-1'});
    const user2: UserProfile = TestHelper.getUserMock({id: 'user-2'});
    const membership2: TeamMembership = TestHelper.getTeamMembershipMock({user_id: 'user-2'});
    const user3: UserProfile = TestHelper.getUserMock({id: 'user-3'});
    const membership3: TeamMembership = TestHelper.getTeamMembershipMock({user_id: 'user-3'});
    const team: Team = TestHelper.getTeamMock({id: 'team-1'});

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
            getTeamStats: jest.fn().mockResolvedValue({}),
            loadProfilesAndReloadTeamMembers: jest.fn().mockResolvedValue({}),
            searchProfilesAndTeamMembers: jest.fn().mockResolvedValue({}),
            getFilteredUsersStats: jest.fn().mockResolvedValue({}),
            setUserGridSearch: jest.fn().mockResolvedValue({}),
            setUserGridFilters: jest.fn().mockResolvedValue({}),
        },
    };

    test('should render properly with users', () => {
        const {container, getByTestId} = renderWithContext(
            <TeamMembers {...baseProps}/>,
        );

        expect(getByTestId('admin-panel')).toBeInTheDocument();
        expect(getByTestId('user-grid')).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    test('should render properly when loading with no users', () => {
        const props = {
            ...baseProps,
            users: [],
            teamMembers: {},
            totalCount: 0,
            loading: true,
        };

        const {container, getByTestId} = renderWithContext(
            <TeamMembers {...props}/>,
        );

        expect(getByTestId('admin-panel')).toBeInTheDocument();
        expect(getByTestId('user-grid')).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });
});
