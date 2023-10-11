// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithFullContext, screen} from 'tests/react_testing_utils';

import {MenuItemBlockableLinkImpl} from './menu_item_blockable_link';

describe('components/MenuItemBlockableLink', () => {
    test('should render my link', () => {
        renderWithFullContext(
            <MenuItemBlockableLinkImpl
                to='/wherever'
                text='Whatever'
            />,
        );

        screen.getByText('Whatever');
        expect((screen.getByRole('link') as HTMLAnchorElement).href).toContain('/wherever');
    });
});
