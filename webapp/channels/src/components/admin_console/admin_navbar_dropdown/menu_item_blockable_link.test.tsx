// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {screen} from '@testing-library/react';

import {MenuItemBlockableLinkImpl} from './menu_item_blockable_link';
import {renderWithIntl} from 'tests/react_testing_utils';
import {Provider} from 'react-redux';
import store from 'stores/redux_store';
import {BrowserRouter} from 'react-router-dom';

describe('components/MenuItemBlockableLink', () => {
    test('should render my link', () => {
        renderWithIntl(
            <BrowserRouter>
                <Provider store={store}>
                    <MenuItemBlockableLinkImpl
                        to='/wherever'
                        text='Whatever'
                    />
                </Provider>
            </BrowserRouter>,
        );

        screen.getByText('Whatever');
        expect((screen.getByRole('link') as HTMLAnchorElement).href).toContain('/wherever');
    });
});
