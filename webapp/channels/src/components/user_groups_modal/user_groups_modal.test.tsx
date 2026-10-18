// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Group} from '@mattermost/types/groups';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import UserGroupsModal from './user_groups_modal';

describe('component/user_groups_modal', () => {
    const baseProps = {
        onExited: jest.fn(),
        groups: [],
        myGroups: [],
        archivedGroups: [],
        searchTerm: '',
        currentUserId: 'user1',
        backButtonAction: jest.fn(),
        actions: {
            getGroups: jest.fn().mockResolvedValue({data: []}),
            setModalSearchTerm: jest.fn(),
            getGroupsByUserIdPaginated: jest.fn().mockResolvedValue({data: []}),
            searchGroups: jest.fn().mockResolvedValue({data: []}),
            openModal: jest.fn(),
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

    function getGroupsMap(groups: Group[]) {
        const groupsMap: Record<string, Group> = {};
        groups.forEach((g) => {
            groupsMap[g.id] = g;
        });
        return groupsMap;
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
            groups: {
                groups: {},
                myGroups: [],
            },
            roles: {
                roles: {},
            },
        },
    };

    test('should match snapshot without groups', () => {
        const {baseElement} = renderWithContext(
            <UserGroupsModal
                {...baseProps}
            />,
            initialState as any,
            {useMockedStore: true},
        );
        expect(baseElement).toMatchSnapshot();
    });

    test('should match snapshot with groups', () => {
        const groups = getGroups(3);
        const myGroups = getGroups(1);

        const stateWithGroups = {
            ...initialState,
            entities: {
                ...initialState.entities,
                groups: {
                    ...initialState.entities.groups,
                    groups: getGroupsMap(groups),
                },
            },
        };

        // Suppress expected DOM nesting warning from component's button structure
        const originalError = console.error;
        console.error = jest.fn();

        const {baseElement} = renderWithContext(
            <UserGroupsModal
                {...baseProps}
                groups={groups}
                myGroups={myGroups}
            />,
            stateWithGroups as any,
            {useMockedStore: true},
        );
        expect(baseElement).toMatchSnapshot();

        console.error = originalError;
    });

    test('User Groups modal search uses Compass SearchInput at medium size', () => {
        // Modal content portals to document.body; use baseElement, not container.
        const {baseElement} = renderWithContext(
            <UserGroupsModal
                {...baseProps}
            />,
            initialState as any,
            {useMockedStore: true},
        );

        expect(screen.getByTestId('searchInput')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Search Groups')).toBeInTheDocument();
        expect(baseElement.querySelector('[class*="_search-input"]')).not.toBeNull();
        expect(baseElement.querySelector('[class*="_search-input--size-medium"]')).not.toBeNull();
        expect(baseElement.querySelector('[class*="_text-input"]')).toBeNull();
    });

    test('clicking the clear icon clears the search term', async () => {
        const setModalSearchTerm = jest.fn();
        renderWithContext(
            <UserGroupsModal
                {...baseProps}
                searchTerm='engineering'
                actions={{
                    ...baseProps.actions,
                    setModalSearchTerm,
                }}
            />,
            initialState as any,
            {useMockedStore: true},
        );

        const searchInput = screen.getByTestId('searchInput');
        expect(searchInput).toHaveValue('engineering');

        const clearButton = screen.getByTestId('clear-search');
        expect(clearButton).toHaveAttribute('tabindex', '0');
        await userEvent.click(clearButton);

        expect(setModalSearchTerm).toHaveBeenCalledWith('');
    });
});
