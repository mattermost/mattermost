// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserProfile} from '@mattermost/types/users';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

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
        onExited: jest.fn(),
        searchTerm: '',
        groupId: 'groupid123',
        group,
        users,
        backButtonCallback: jest.fn(),
        backButtonAction: jest.fn(),
        currentUserId: 'user-1',
        permissionToEditGroup: true,
        permissionToJoinGroup: true,
        permissionToLeaveGroup: true,
        permissionToArchiveGroup: true,
        isGroupMember: false,
        actions: {
            getGroup: jest.fn().mockImplementation(() => Promise.resolve()),
            getUsersInGroup: jest.fn().mockImplementation(() => Promise.resolve()),
            setModalSearchTerm: jest.fn(),
            openModal: jest.fn(),
            searchProfiles: jest.fn().mockImplementation(() => Promise.resolve()),
            removeUsersFromGroup: jest.fn().mockImplementation(() => Promise.resolve()),
            addUsersToGroup: jest.fn().mockImplementation(() => Promise.resolve()),
            archiveGroup: jest.fn().mockImplementation(() => Promise.resolve()),
        },
    };

    const initialState = {
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
                        roles: 'system_user',
                    },
                },
            },
            groups: {
                groups: {
                    groupid123: group,
                },
                myGroups: [],
            },
            roles: {
                roles: {},
            },
        },
    };

    test('should match snapshot', () => {
        const {baseElement} = renderWithContext(
            <ViewUserGroupModal
                {...baseProps}
            />,
            initialState as any,
            {useMockedStore: true},
        );
        expect(baseElement).toMatchSnapshot();
    });

    test('should match snapshot, search user1', async () => {
        renderWithContext(
            <ViewUserGroupModal
                {...baseProps}
                searchTerm='user1'
            />,
            initialState as any,
            {useMockedStore: true},
        );

        // Find the search input by data-testid
        const searchInput = screen.getByTestId('searchInput');
        expect(searchInput).toBeInTheDocument();

        // Simulate search input change - clear first then type
        await userEvent.clear(searchInput);
        expect(baseProps.actions.setModalSearchTerm).toHaveBeenCalledTimes(1);
        expect(baseProps.actions.setModalSearchTerm).toHaveBeenCalledWith('');

        // Each character typed triggers onChange, verify the action was called
        await userEvent.type(searchInput, 'user1');
        expect(baseProps.actions.setModalSearchTerm).toHaveBeenCalledTimes(6);
    });
});
