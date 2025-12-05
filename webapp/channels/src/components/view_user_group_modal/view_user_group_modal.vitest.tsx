// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserProfile} from '@mattermost/types/users';
import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, screen, fireEvent, waitFor} from 'tests/vitest_react_testing_utils';

import type {GlobalState} from 'types/store';

import ViewUserGroupModal from './view_user_group_modal';

describe('component/view_user_group_modal', () => {
    const users = [
        {
            id: 'user-1',
            username: 'user1',
            first_name: 'user',
            last_name: 'one',
            delete_at: 0,
        } as UserProfile,
        {
            id: 'user-2',
            username: 'user2',
            first_name: 'user',
            last_name: 'otwo',
            delete_at: 0,
        } as UserProfile,
    ];

    const group = {
        id: 'groupid123',
        name: 'group',
        display_name: 'Group Name',
        description: 'Group description',
        source: 'custom',
        remote_id: null,
        create_at: 1637349374137,
        update_at: 1637349374137,
        delete_at: 0,
        has_syncables: false,
        member_count: 6,
        allow_reference: true,
        scheme_admin: false,
    };

    const baseProps = {
        onExited: vi.fn(),
        searchTerm: '',
        groupId: 'groupid123',
        group,
        users,
        backButtonCallback: vi.fn(),
        backButtonAction: vi.fn(),
        currentUserId: 'user-1',
        permissionToEditGroup: true,
        permissionToJoinGroup: true,
        permissionToLeaveGroup: true,
        permissionToArchiveGroup: true,
        isGroupMember: false,
        actions: {
            getGroup: vi.fn().mockImplementation(() => Promise.resolve()),
            getUsersInGroup: vi.fn().mockImplementation(() => Promise.resolve()),
            setModalSearchTerm: vi.fn(),
            openModal: vi.fn(),
            searchProfiles: vi.fn().mockImplementation(() => Promise.resolve()),
            removeUsersFromGroup: vi.fn().mockImplementation(() => Promise.resolve()),
            addUsersToGroup: vi.fn().mockImplementation(() => Promise.resolve()),
            archiveGroup: vi.fn().mockImplementation(() => Promise.resolve()),
        },
    };

    const initialState: DeepPartial<GlobalState> = {
        entities: {
            general: {
                config: {},
            },
            users: {
                currentUserId: 'user-1',
                profiles: {
                    'user-1': {
                        id: 'user-1',
                        username: 'user1',
                        first_name: 'user',
                        last_name: 'one',
                        delete_at: 0,
                        roles: 'system_user',
                    } as UserProfile,
                    'user-2': {
                        id: 'user-2',
                        username: 'user2',
                        first_name: 'user',
                        last_name: 'otwo',
                        delete_at: 0,
                        roles: 'system_user',
                    } as UserProfile,
                },
            },
            groups: {
                groups: {
                    groupid123: group,
                },
                myGroups: ['groupid123'],
            },
            roles: {
                roles: {
                    system_user: {
                        permissions: [],
                    },
                },
            },
            teams: {
                currentTeamId: 'team1',
            },
            preferences: {
                myPreferences: {},
            },
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('should match snapshot', async () => {
        const {container} = renderWithContext(
            <ViewUserGroupModal
                {...baseProps}
            />,
            initialState,
        );

        // Wait for async actions to complete
        await waitFor(() => {
            expect(baseProps.actions.getGroup).toHaveBeenCalled();
        });

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, search user1', async () => {
        renderWithContext(
            <ViewUserGroupModal
                {...baseProps}
                searchTerm='user1'
            />,
            initialState,
        );

        // Wait for async actions to complete
        await waitFor(() => {
            expect(baseProps.actions.getGroup).toHaveBeenCalled();
        });

        // Find the search input and simulate change
        const searchInput = screen.getByTestId('searchInput');
        expect(searchInput).toBeInTheDocument();

        // Clear mock calls from initialization
        baseProps.actions.setModalSearchTerm.mockClear();

        // Simulate search input change to empty
        fireEvent.change(searchInput, {target: {value: ''}});
        expect(baseProps.actions.setModalSearchTerm).toHaveBeenCalledWith('');
    });
});
