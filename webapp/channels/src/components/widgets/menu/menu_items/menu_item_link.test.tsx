// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {BrowserRouter as Router} from 'react-router-dom';

import {render, screen} from 'tests/react_testing_utils';

import {MenuItemLinkImpl} from './menu_item_link';

describe('components/MenuItemLink', () => {
    test('should render link with correct attributes', () => {
        render(
            <Router>
                <MenuItemLinkImpl
                    to='/wherever'
                    text='Whatever'
                />
            </Router>,
        );

        const link = screen.getByRole('link');
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute('href', '/wherever');
        expect(screen.getByText('Whatever')).toBeInTheDocument();
    });
});
