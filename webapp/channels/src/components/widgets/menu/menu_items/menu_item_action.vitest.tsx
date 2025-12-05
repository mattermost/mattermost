// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {render} from 'tests/vitest_react_testing_utils';

import {MenuItemActionImpl} from './menu_item_action';

describe('components/MenuItemAction', () => {
    test('should match snapshot', () => {
        const {container} = render(
            <MenuItemActionImpl
                onClick={vi.fn()}
                text='Whatever'
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with extra text', () => {
        const {container} = render(
            <MenuItemActionImpl
                onClick={vi.fn()}
                text='Whatever'
                extraText='Extra Text'
            />,
        );

        expect(container).toMatchSnapshot();
    });
});
