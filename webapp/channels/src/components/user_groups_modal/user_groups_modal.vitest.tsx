// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Group} from '@mattermost/types/groups';

import {renderWithContext, waitFor} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import UserGroupsModal from './user_groups_modal';

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
        groups: [],
        myGroups: [],
        archivedGroups: [],
        searchTerm: '',
        currentUserId: currentUser.id,
        backButtonAction: vi.fn(),
        actions: {
            getGroups: vi.fn().mockResolvedValue({data: []}),
            setModalSearchTerm: vi.fn(),
            getGroupsByUserIdPaginated: vi.fn().mockResolvedValue({data: []}),
            searchGroups: vi.fn().mockResolvedValue({data: []}),
            openModal: vi.fn(),
        },
        canCreateCustomGroups: true,
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

    test('should match snapshot without groups', async () => {
        const {baseElement} = renderWithContext(
            <UserGroupsModal
                {...baseProps}
            />,
            initialState,
        );

        // Wait for async state updates to complete
        await waitFor(() => {
            expect(baseProps.actions.getGroups).toHaveBeenCalled();
        });

        expect(baseElement).toMatchSnapshot();
    });

    test('should match snapshot with groups', async () => {
        const groups = getGroups(3);
        const myGroups = getGroups(1);

        // Build state with groups for getGroupListPermissions
        const groupsObj: Record<string, Group> = {};
        groups.forEach((g) => {
            groupsObj[g.id] = g;
        });

        const stateWithGroups = {
            ...initialState,
            entities: {
                ...initialState.entities,
                groups: {
                    groups: groupsObj,
                },
            },
        };

        renderWithContext(
            <UserGroupsModal
                {...baseProps}
                groups={groups}
                myGroups={myGroups}
            />,
            stateWithGroups,
        );

        // Wait for async state updates to complete
        await waitFor(() => {
            expect(baseProps.actions.getGroups).toHaveBeenCalled();
        });

        // Verify modal is rendered (modal renders to document.body, not container)
        expect(document.querySelector('#userGroupsModal')).toBeInTheDocument();
        expect(document.querySelector('.user-groups-list')).toBeInTheDocument();

        // Verify filter dropdown is present
        expect(document.querySelector('.groups-filter-btn')).toBeInTheDocument();

        // Verify group rows are rendered (virtualized list renders visible items)
        const groupRows = document.querySelectorAll('.group-row');
        expect(groupRows.length).toBeGreaterThan(0);

        // Verify groups are rendered with correct content
        expect(document.querySelector('[aria-label="Group 0 group"]')).toBeInTheDocument();
        expect(document.querySelector('.group-display-name')).toHaveTextContent('Group 0');
        expect(document.querySelector('.group-name')).toHaveTextContent('@group0');
    });
});
