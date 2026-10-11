// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
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

    test.each([
        ['allowed', true, true],
        ['denied', false, false],
    ])('should offer Open a direct message only while dm_gm_start is %s', async (_, allowed, expected) => {
        renderWithContext(
            <SidebarCategorySortingMenu {...baseProps}/>,
            {
                ...initialState,
                entities: {
                    ...initialState.entities,
                    general: {config: {FeatureFlagPermissionPolicies: 'true'}},
                    renderPermissions: {byResource: {permission: {'': {dm_gm_start: {allowed, evaluated: true, generation: 1}}}}},
                },
            },
        );

        await userEvent.click(screen.getByRole('button', {name: `${baseProps.category.display_name} category options`}));

        expect(screen.getByRole('menuitem', {name: /Sort/})).toBeInTheDocument();
        expect(Boolean(screen.queryByRole('menuitem', {name: 'Open a direct message'}))).toBe(expected);
    });
});
