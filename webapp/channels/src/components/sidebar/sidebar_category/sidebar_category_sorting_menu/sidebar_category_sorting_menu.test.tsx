// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import {CategoryTypes} from 'mattermost-redux/constants/channel_categories';

import {TestHelper} from 'utils/test_helper';
import Constants from 'utils/constants';

import SidebarCategorySortingMenu from './sidebar_category_sorting_menu';

describe('components/sidebar/sidebar_category/sidebar_category_sorting_menu', () => {
    const baseProps = {
        category: TestHelper.getCategoryMock(),
        handleCtaMenuItemOnClick: jest.fn(),
        selectedDmNumber: Constants.DM_AND_GM_SHOW_COUNTS[0],
        currentUserId: TestHelper.getUserMock().id,
        setCategorySorting: jest.fn(),
        savePreferences: jest.fn(),
    };

    test('should match snapshot for type Custom', () => {
        const wrapper = shallow(
            <SidebarCategorySortingMenu {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot for type Channel', () => {
        const wrapper = shallow(
            <SidebarCategorySortingMenu
                {...baseProps}
                category={{...baseProps.category, type: CategoryTypes.CHANNELS}}
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot for type DM', () => {
        const wrapper = shallow(
            <SidebarCategorySortingMenu
                {...baseProps}
                category={{...baseProps.category, type: CategoryTypes.DIRECT_MESSAGES}}
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot for type Apps', () => {
        const wrapper = shallow(
            <SidebarCategorySortingMenu
                {...baseProps}
                category={{...baseProps.category, type: CategoryTypes.APPS}}
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
