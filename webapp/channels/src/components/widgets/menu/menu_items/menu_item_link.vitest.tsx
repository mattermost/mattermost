// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render} from '@testing-library/react';
import React from 'react';
import {MemoryRouter} from 'react-router-dom';
import {describe, test, expect} from 'vitest';

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
