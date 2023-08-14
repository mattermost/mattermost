// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import * as redux from 'react-redux';

import {shallow} from 'enzyme';

import {CategorySorting} from '@mattermost/types/channel_categories';

import {CategoryTypes} from 'mattermost-redux/constants/channel_categories';

import CreateNewCategoryMenuItem from './create_new_category_menu_item';

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
            lastUnreadChannel: '',
        },
    },
};

jest.spyOn(redux, 'useSelector').mockImplementation((cb) => cb(initialState));
jest.spyOn(redux, 'useDispatch').mockReturnValue((t) => t);

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
        const wrapper = shallow(
            <SidebarCategoryMenu {...baseProps}/>,
        );

        expect(wrapper.find(`#rename-${categoryId}`)).toHaveLength(1);
        expect(wrapper.find(CreateNewCategoryMenuItem)).toHaveLength(1);
        expect(wrapper.find(`#delete-${categoryId}`)).toHaveLength(1);

        expect(wrapper).toMatchSnapshot();
    });

    test('should show correct menu itemsu when category is favorites', () => {
        const props = {
            ...baseProps,
            category: {
                ...baseProps.category,
                type: CategoryTypes.FAVORITES,
            },
        };

        const wrapper = shallow(
            <SidebarCategoryMenu {...props}/>,
        );

        expect(wrapper.find(`#rename-${categoryId}`)).toHaveLength(0);
        expect(wrapper.find(`#delete-${categoryId}`)).toHaveLength(0);
    });

    test('should show correct menu items when category is direct messages', () => {
        const props = {
            ...baseProps,
            category: {
                ...baseProps.category,
                type: CategoryTypes.DIRECT_MESSAGES,
            },
        };

        const wrapper = shallow(
            <SidebarCategoryMenu {...props}/>,
        );

        expect(wrapper.find(`#mute-${categoryId}`)).toHaveLength(0);
    });

    test('should show correct menu items when category is not direct messages', () => {
        const props = {
            ...baseProps,
            category: {
                ...baseProps.category,
                type: CategoryTypes.CUSTOM,
            },
        };

        const wrapper = shallow(
            <SidebarCategoryMenu {...props}/>,
        );

        expect(wrapper.find(`#mute-${categoryId}`)).toHaveLength(1);
    });
});
