// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import SidebarCategorySortingMenu from './sidebar_category_sorting_menu';

describe('components/sidebar/sidebar_category/sidebar_category_sorting_menu', () => {
    const baseProps = {
        category: TestHelper.getCategoryMock(),
        handleOpenDirectMessagesModal: jest.fn(),
    };

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

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <SidebarCategorySortingMenu {...baseProps}/>,
            initialState,
        );

        expect(container).toMatchSnapshot();
    });
});
