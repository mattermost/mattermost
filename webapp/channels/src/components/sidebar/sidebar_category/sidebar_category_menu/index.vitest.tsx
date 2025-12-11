// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {CategorySorting} from '@mattermost/types/channel_categories';

import {CategoryTypes} from 'mattermost-redux/constants/channel_categories';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

import SidebarCategoryMenu from '.';

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

    test('should match snapshot and contain correct buttons', () => {
        const {container} = renderWithContext(
            <SidebarCategoryMenu {...baseProps}/>,
            initialState,
        );

        expect(container).toMatchSnapshot();
    });

    test('should show correct menu itemsu when category is favorites', () => {
        const props = {
            ...baseProps,
            category: {
                ...baseProps.category,
                type: CategoryTypes.FAVORITES,
            },
        };

        const {container} = renderWithContext(
            <SidebarCategoryMenu {...props}/>,
            initialState,
        );

        expect(container).toMatchSnapshot();
    });

    test('should show correct menu items when category is direct messages', () => {
        const props = {
            ...baseProps,
            category: {
                ...baseProps.category,
                type: CategoryTypes.DIRECT_MESSAGES,
            },
        };

        const {container} = renderWithContext(
            <SidebarCategoryMenu {...props}/>,
            initialState,
        );

        expect(container).toMatchSnapshot();
    });

    test('should show correct menu items when category is not direct messages', () => {
        const props = {
            ...baseProps,
            category: {
                ...baseProps.category,
                type: CategoryTypes.CUSTOM,
            },
        };

        const {container} = renderWithContext(
            <SidebarCategoryMenu {...props}/>,
            initialState,
        );

        expect(container).toMatchSnapshot();
    });
});
