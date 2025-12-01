// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Group, GroupPermissions} from '@mattermost/types/groups';

import {renderWithContext} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import UserGroupsList from './user_groups_list';

describe('component/user_groups_modal', () => {
    const currentUser = TestHelper.getUserMock({
        id: 'current_user_id',
        roles: 'system_user',
    });

    const initialState = {
        entities: {
            users: {
                currentUserId: currentUser.id,
                profiles: {
                    [currentUser.id]: currentUser,
                },
            },
            general: {
                license: {},
                config: {},
            },
            admin: {
                prevTrialLicense: {},
            },
            cloud: {
                subscription: undefined,
            },
            groups: {
                groups: {},
            },
            roles: {
                roles: {},
            },
        },
    };

    const baseProps = {
        onExited: vi.fn(),
        onScroll: vi.fn(),
        onToggle: vi.fn(),
        groups: [],
        searchTerm: '',
        backButtonAction: vi.fn(),
        groupPermissionsMap: {},
        loading: false,
        loadMoreGroups: vi.fn(),
        hasNextPage: false,
        actions: {
            openModal: vi.fn(),
            archiveGroup: vi.fn(),
            restoreGroup: vi.fn(),
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

    test('should match snapshot without groups', () => {
        const {container} = renderWithContext(
            <UserGroupsList
                {...baseProps}
            />,
            initialState,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with groups', () => {
        const groups = getGroups(3);
        const permissions = getPermissions(groups);

        const {container} = renderWithContext(
            <UserGroupsList
                {...baseProps}
                groups={groups}
                groupPermissionsMap={permissions}
            />,
            initialState,
        );
        expect(container).toMatchSnapshot();
    });
});
