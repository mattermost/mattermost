// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import {TestHelper} from 'utils/test_helper';
import Constants from 'utils/constants';

import SidebarCategorySortingMenu from './sidebar_category_sorting_menu';

describe('components/sidebar/sidebar_category/sidebar_category_sorting_menu', () => {
    const baseProps = {
        category: TestHelper.getCategoryMock(),
        handleOpenDirectMessagesModal: jest.fn(),
        selectedDmNumber: Constants.DM_AND_GM_SHOW_COUNTS[0],
        currentUserId: TestHelper.getUserMock().id,
        setCategorySorting: jest.fn(),
        savePreferences: jest.fn(),
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <SidebarCategorySortingMenu {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
