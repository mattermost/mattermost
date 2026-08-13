// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {CategorySorting} from '@mattermost/types/channel_categories';

import {CategoryTypes} from 'mattermost-redux/constants/channel_categories';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import SidebarCategoryMenu from '.';

describe('components/sidebar/sidebar_category/sidebar_category_menu', () => {
    const categoryId = 'test_category_id';
    const baseProps = {
        category: {
            id: categoryId,
            team_id: 'team1',
            user_id: '',
            type: CategoryTypes.CUSTOM,
            display_name: 'custom_category_1',
            channel_ids: ['channel_id'],
            sorting: CategorySorting.Alphabetical,
            muted: false,
            collapsed: false,
        },
    };

    const initialState = {
        entities: {
            preferences: {
                myPreferences: {},
            },
            channels: {
                channels: {},
                channelsInTeam: {},
            },
            users: {
                currentUserId: '',
                profiles: {},
            },
            teams: {
                currentTeamId: '',
            },
            general: {
                config: {
                    ExperimentalGroupUnreadChannels: 'default_off',
                },
            },
        },
        views: {
            channel: {
                lastUnreadChannel: null,
            },
        },
    };

    test('should match snapshot and contain correct buttons', async () => {
        const {container} = renderWithContext(
            <SidebarCategoryMenu {...baseProps}/>,
            initialState,
        );

        // Open the menu
        await userEvent.click(screen.getByRole('button', {name: /custom_category_1 category options/i}));

        expect(screen.getByRole('menuitem', {name: /rename category/i})).toBeInTheDocument();
        expect(screen.getByRole('menuitem', {name: /create new category/i})).toBeInTheDocument();
        expect(screen.getByRole('menuitem', {name: /delete category/i})).toBeInTheDocument();
        expect(screen.getByRole('menuitem', {name: /mute category/i})).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    test('should show correct menu items when category is favorites', async () => {
        const props = {
            ...baseProps,
            category: {
                ...baseProps.category,
                type: CategoryTypes.FAVORITES,
            },
        };

        renderWithContext(
            <SidebarCategoryMenu {...props}/>,
            initialState,
        );

        // Open the menu
        await userEvent.click(screen.getByRole('button', {name: /custom_category_1 category options/i}));

        expect(screen.queryByRole('menuitem', {name: /rename category/i})).not.toBeInTheDocument();
        expect(screen.queryByRole('menuitem', {name: /delete category/i})).not.toBeInTheDocument();
    });

    test('should show correct menu items when category is direct messages', async () => {
        const props = {
            ...baseProps,
            category: {
                ...baseProps.category,
                type: CategoryTypes.DIRECT_MESSAGES,
            },
        };

        renderWithContext(
            <SidebarCategoryMenu {...props}/>,
            initialState,
        );

        // Open the menu
        await userEvent.click(screen.getByRole('button', {name: /custom_category_1 category options/i}));

        expect(screen.queryByRole('menuitem', {name: /mute category/i})).not.toBeInTheDocument();
    });

    test('should show correct menu items when category is not direct messages', async () => {
        const props = {
            ...baseProps,
            category: {
                ...baseProps.category,
                type: CategoryTypes.CUSTOM,
            },
        };

        renderWithContext(
            <SidebarCategoryMenu {...props}/>,
            initialState,
        );

        // Open the menu
        await userEvent.click(screen.getByRole('button', {name: /custom_category_1 category options/i}));

        expect(screen.getByRole('menuitem', {name: /mute category/i})).toBeInTheDocument();
    });
});
