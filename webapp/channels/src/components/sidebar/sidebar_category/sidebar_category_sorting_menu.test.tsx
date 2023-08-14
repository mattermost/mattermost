// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import * as redux from 'react-redux';
import {shallow} from 'enzyme';

import {TestHelper} from 'utils/test_helper';

import SidebarCategorySortingMenu from './sidebar_category_sorting_menu';

const initialState = {
    entities: {
        users: {
            currentUserId: 'user_id',
        },
        preferences: {
            myPreferences: {
                'sidebar_settings--limit_visible_dms_gms': {
                    value: '10',
                },
            },
        },
    },
};

jest.spyOn(redux, 'useSelector').mockImplementation((cb) => cb(initialState));
jest.spyOn(redux, 'useDispatch').mockReturnValue((t) => t);

describe('components/sidebar/sidebar_category/sidebar_category_sorting_menu', () => {
    const baseProps = {
        category: TestHelper.getCategoryMock(),
        handleOpenDirectMessagesModal: jest.fn(),
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <SidebarCategorySortingMenu {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
