// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Group, GroupPermissions} from '@mattermost/types/groups';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import UserGroupsList from './user_groups_list';

describe('component/user_groups_modal', () => {
    const baseProps = {
        onExited: jest.fn(),
        onScroll: jest.fn(),
        onToggle: jest.fn(),
        groups: [],
        searchTerm: '',
        backButtonAction: jest.fn(),
        groupPermissionsMap: {},
        loading: false,
        loadMoreGroups: jest.fn(),
        hasNextPage: false,
        actions: {
            openModal: jest.fn(),
            archiveGroup: jest.fn(),
            restoreGroup: jest.fn(),
        },
    };

    function getGroups(numberOfGroups: number) {
        const groups: Group[] = [];
        for (let i = 0; i < numberOfGroups; i++) {
            groups.push({
                id: `group${i}`,
                name: `group${i}`,
                display_name: `Group ${i}`,
                description: `Group ${i} description`,
                source: 'custom',
                remote_id: null,
                create_at: 1637349374137,
                update_at: 1637349374137,
                delete_at: 0,
                has_syncables: false,
                member_count: i + 1,
                allow_reference: true,
                scheme_admin: false,
            });
        }

        return groups;
    }

    function getPermissions(groups: Group[]) {
        const groupPermissionsMap: Record<string, GroupPermissions> = {};
        groups.forEach((g) => {
            groupPermissionsMap[g.id] = {
                can_delete: true,
                can_manage_members: true,
                can_restore: true,
            };
        });

        return groupPermissionsMap;
    }

    const initialState = {
        entities: {
            general: {
                license: {
                    Cloud: 'false',
                },
                config: {},
            },
            cloud: {},
            admin: {
                prevTrialLicense: {
                    IsLicensed: 'false',
                },
            },
            users: {
                currentUserId: 'user1',
                profiles: {
                    user1: {
                        id: 'user1',
                        roles: 'system_user',
                    },
                },
            },
        },
    };

    test('should match snapshot without groups', () => {
        const {baseElement} = renderWithContext(
            <UserGroupsList
                {...baseProps}
            />,
            initialState as any,
            {useMockedStore: true},
        );
        expect(baseElement).toMatchSnapshot();
    });

    test('should match snapshot with groups', () => {
        const groups = getGroups(3);
        const permissions = getPermissions(groups);

        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        const {baseElement} = renderWithContext(
            <UserGroupsList
                {...baseProps}
                groups={groups}
                groupPermissionsMap={permissions}
            />,
            initialState as any,
            {useMockedStore: true},
        );
        expect(baseElement).toMatchSnapshot();

        expect(consoleErrorSpy).not.toHaveBeenCalledWith(expect.stringContaining('validateDOMNesting'));
        consoleErrorSpy.mockRestore();
    });

    test('should render separate row and actions buttons for each group', async () => {
        const groups = getGroups(1);
        const permissions = getPermissions(groups);

        renderWithContext(
            <UserGroupsList
                {...baseProps}
                groups={[
                    {
                        ...groups[0],
                        delete_at: 123,
                    },
                ]}
                groupPermissionsMap={permissions}
            />,
            initialState as any,
            {useMockedStore: true},
        );

        const rowButton = screen.getByRole('button', {name: 'Group 0 group, Archived'});
        const actionsButton = screen.getByRole('button', {name: 'Group 0 actions'});

        expect(rowButton).toBeInTheDocument();
        expect(actionsButton).toBeInTheDocument();
        expect(rowButton).not.toContainElement(actionsButton);

        await userEvent.click(actionsButton);
        expect(screen.getByRole('menuitem', {name: 'View Group'})).toBeInTheDocument();
    });
});
