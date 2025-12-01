// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';

import {MenuItemToggleModalReduxImpl} from './menu_item_toggle_modal_redux';

describe('components/MenuItemToggleModalRedux', () => {
    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <MenuItemToggleModalReduxImpl
                modalId='test'
                dialogType={vi.fn()}
                dialogProps={{test: 'test'}}
                text='Whatever'
            />,
        );

        expect(screen.getByText('Whatever')).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with extra text', () => {
        const {container} = renderWithContext(
            <MenuItemToggleModalReduxImpl
                modalId='test'
                dialogType={vi.fn()}
                dialogProps={{test: 'test'}}
                text='Whatever'
                extraText='Extra text'
            />,
        );

        expect(screen.getByText('Whatever')).toBeInTheDocument();
        expect(screen.getByText('Extra text')).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });
});
