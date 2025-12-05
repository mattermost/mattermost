// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {MemoryRouter} from 'react-router-dom';

import {render} from 'tests/vitest_react_testing_utils';

import {MenuItemLinkImpl} from './menu_item_link';

describe('components/MenuItemLink', () => {
    test('should match snapshot', () => {
        const {container} = render(
            <MemoryRouter>
                <MenuItemLinkImpl
                    to='/wherever'
                    text='Whatever'
                />
            </MemoryRouter>,
        );

        expect(container).toMatchSnapshot();
    });
});
