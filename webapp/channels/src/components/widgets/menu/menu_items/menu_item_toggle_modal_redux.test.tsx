// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import {MenuItemToggleModalReduxImpl} from './menu_item_toggle_modal_redux';

describe('components/MenuItemToggleModalRedux', () => {
    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <MenuItemToggleModalReduxImpl
                modalId='test'
                dialogType={jest.fn()}
                dialogProps={{test: 'test'}}
                text='Whatever'
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with extra text', () => {
        const {container} = renderWithContext(
            <MenuItemToggleModalReduxImpl
                modalId='test'
                dialogType={jest.fn()}
                dialogProps={{test: 'test'}}
                text='Whatever'
                extraText='Extra text'
            />,
        );

        expect(container).toMatchSnapshot();
    });
});
