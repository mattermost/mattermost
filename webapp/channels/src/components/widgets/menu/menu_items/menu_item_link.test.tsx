// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

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
});
