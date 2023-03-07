// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Provider} from 'react-redux';

import {BrowserRouter} from 'react-router-dom';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import mockStore from 'tests/test_store';

import ModalPagination from './modal_pagination';

describe('components/activity_and_insights/insights/modal_pagination', () => {
    const props = {
        hasNext: false,
        offset: 0,
        setOffset: jest.fn(),
    };

    test('check if 1 - 10 renders', async () => {
        const store = await mockStore({});
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <BrowserRouter>
                    <ModalPagination
                        {...props}
                    />
                </BrowserRouter>
            </Provider>,
        );
        expect(wrapper.text().includes('1 - 10')).toBe(true);
    });

    test('check if 20 - 30 renders', async () => {
        const store = await mockStore({});
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <BrowserRouter>
                    <ModalPagination
                        {...props}
                        offset={2}
                    />
                </BrowserRouter>
            </Provider>,
        );
        expect(wrapper.text().includes('20 - 30')).toBe(true);
    });
});
