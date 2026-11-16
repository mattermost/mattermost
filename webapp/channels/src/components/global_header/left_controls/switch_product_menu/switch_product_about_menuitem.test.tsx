// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import ProductSwitcherAboutMenuItem from './switch_product_about_menuitem';

describe('ProductSwitcherAboutMenuItem', () => {
    test('should show the configured site name', () => {
        renderWithContext(<ProductSwitcherAboutMenuItem siteName='Contoso Chat'/>);

        expect(screen.getByText('About Contoso Chat')).toBeInTheDocument();
    });

    test('should fall back to Mattermost when no site name is configured', () => {
        renderWithContext(<ProductSwitcherAboutMenuItem/>);

        expect(screen.getByText('About Mattermost')).toBeInTheDocument();
    });
});
