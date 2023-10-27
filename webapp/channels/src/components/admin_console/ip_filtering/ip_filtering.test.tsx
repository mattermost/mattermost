// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, fireEvent, waitFor, screen} from '@testing-library/react';
import React from 'react';
import {IntlProvider} from 'react-intl';
import {Provider} from 'react-redux';
import {BrowserRouter as Router} from 'react-router-dom';

import type {AllowedIPRange, FetchIPResponse} from '@mattermost/types/config';

import {Client4} from 'mattermost-redux/client';

import testConfigureStore from 'tests/test_store';

import IPFiltering from './index';

jest.mock('mattermost-redux/client');

describe('IPFiltering', () => {
    const ipFilters = [
        {
            cidr_block: '10.0.0.0/8',
            description: 'Test IP Filter',
            enabled: true,
        },
    ] as AllowedIPRange[];

    const intlProviderProps = {
        defaultLocale: 'en',
        locale: 'en',
    };
    const currentIP = '10.0.0.1';
    const applyIPFiltersMock = jest.fn(() => Promise.resolve(ipFilters));
    const getIPFiltersMock = jest.fn(() => Promise.resolve(ipFilters));
    const getCurrentIPMock = jest.fn(() => Promise.resolve({ip: currentIP} as FetchIPResponse));

    beforeEach(() => {
        Client4.applyIPFilters = applyIPFiltersMock;
        Client4.getIPFilters = getIPFiltersMock;
        Client4.getCurrentIP = getCurrentIPMock;
    });

    const mockedStore = testConfigureStore({
        entities: {
            users: {
                currentUserId: 'current_user_id',
            },
            general: {
                config: {},
                license: {},
            },
        },
        views: {
            admin: {
                navigationBlock: {
                    blocked: false,
                },
            },
        },
    });

    const wrapWithIntlProviderAndStore = (component: JSX.Element) => (
        <Router>
            <IntlProvider {...intlProviderProps}>
                <Provider store={mockedStore} >
                    {component}
                </Provider>
            </IntlProvider>
        </Router>
    );

    test('renders the IP Filtering page', async () => {
        const {getByText} = render(wrapWithIntlProviderAndStore(<IPFiltering/>));

        expect(getByText('IP Filtering')).toBeInTheDocument();
        expect(getByText('Enable IP Filtering')).toBeInTheDocument();

        await waitFor(() => {
            expect(getByText('Add Filter')).toBeInTheDocument();
            expect(getByText('Test IP Filter')).toBeInTheDocument();
            expect(getByText('10.0.0.0/8')).toBeInTheDocument();
        });

        expect(getByText('Save')).toBeInTheDocument();
    });

    test('disables IP Filtering when the toggle is turned off', async () => {
        render(wrapWithIntlProviderAndStore(<IPFiltering/>));

        await waitFor(() => {
            expect(screen.getByTestId('filterToggle-button')).toBeInTheDocument();
            expect(screen.getByRole('button', {pressed: true})).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId('filterToggle-button'));

        await waitFor(() => {
            expect(screen.getByRole('button', {pressed: false})).toBeInTheDocument();
        });
    });
});
