// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import {MenuItemActionImpl} from './menu_item_action';

describe('components/MenuItemAction', () => {
    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <MenuItemActionImpl
                onClick={jest.fn()}
                text='Whatever'
            />,
        );

        expect(container).toMatchSnapshot();
    });
    test('should match snapshot with extra text', () => {
        const {container} = renderWithContext(
            <MenuItemActionImpl
                onClick={jest.fn()}
                text='Whatever'
                extraText='Extra Text'
            />,
        );

        expect(container).toMatchSnapshot();
    });
});
