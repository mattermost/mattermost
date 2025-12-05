// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';

import {MenuItemExternalLinkImpl} from './menu_item_external_link';

describe('components/MenuItemExternalLink', () => {
    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <MenuItemExternalLinkImpl
                url='http://test.com'
                text='Whatever'
            />,
        );

        const link = screen.getByRole('link');
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute('href', 'http://test.com');
        expect(screen.getByText('Whatever')).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });
});
