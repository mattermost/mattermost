// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import {MenuItemLinkImpl} from './menu_item_link';

describe('components/MenuItemLink', () => {
    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <MenuItemLinkImpl
                to='/wherever'
                text='Whatever'
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should mark a disabled link with a class instead of a disabled attribute', () => {
        renderWithContext(
            <MenuItemLinkImpl
                to='/wherever'
                text='Whatever'
                disabled={true}
            />,
        );

        const link = screen.getByRole('link', {name: 'Whatever'});
        expect(link).toHaveClass('disabled');
        expect(link).not.toHaveAttribute('disabled');
    });

    test('should not mark an enabled link as disabled', () => {
        renderWithContext(
            <MenuItemLinkImpl
                to='/wherever'
                text='Whatever'
            />,
        );

        const link = screen.getByRole('link', {name: 'Whatever'});
        expect(link).not.toHaveClass('disabled');
        expect(link).not.toHaveAttribute('disabled');
    });
});
