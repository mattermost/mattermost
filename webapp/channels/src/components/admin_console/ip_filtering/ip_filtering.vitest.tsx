// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {IntlProvider} from 'react-intl';
import {Provider} from 'react-redux';
import {BrowserRouter as Router} from 'react-router-dom';

import type {Installation} from '@mattermost/types/cloud';
import type {AllowedIPRange, FetchIPResponse} from '@mattermost/types/config';

import {Client4} from 'mattermost-redux/client';

import configureStore from 'store';

import ModalController from 'components/modal_controller';

import {render, fireEvent, waitFor, screen, act} from 'tests/vitest_react_testing_utils';

import IPFiltering from './index';

vi.mock('mattermost-redux/client', () => ({
    Client4: {
        applyIPFilters: vi.fn(),
        getIPFilters: vi.fn(),
        getCurrentIP: vi.fn(),
        getInstallation: vi.fn(),
    },
}));

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
    const applyIPFiltersMock = vi.fn(() => Promise.resolve(ipFilters));
    const getIPFiltersMock = vi.fn(() => Promise.resolve(ipFilters));
    const getCurrentIPMock = vi.fn(() => Promise.resolve({ip: currentIP} as FetchIPResponse));
    const getInstallationMock = vi.fn(() => Promise.resolve({id: 'abc123', state: 'stable'} as Installation));

    beforeEach(() => {
        vi.clearAllMocks();
        Client4.applyIPFilters = applyIPFiltersMock;
        Client4.getIPFilters = getIPFiltersMock;
        Client4.getCurrentIP = getCurrentIPMock;
        Client4.getInstallation = getInstallationMock;
    });

    const mockedStore = configureStore({
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
                    <ModalController/>
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

    test('adds a new IP filter when the "Add IP Filter" button is clicked', async () => {
        const {getByLabelText, getByText} = render(wrapWithIntlProviderAndStore(<IPFiltering/>));

        await waitFor(() => {
            expect(getByText('Add Filter')).toBeInTheDocument();
        });

        fireEvent.click(getByText('Add Filter'));

        const descriptionInput = getByLabelText('Enter a name for this rule');
        const cidrInput = getByLabelText('Enter IP Range');
        const saveButton = screen.getByTestId('save-add-edit-button');

        fireEvent.change(cidrInput, {target: {value: '192.168.0.0/16'}});
        fireEvent.change(descriptionInput, {target: {value: 'Test IP Filter 2'}});
        fireEvent.click(saveButton);

        await waitFor(() => {
            expect(getByText('Test IP Filter 2')).toBeInTheDocument();
            expect(getByText('192.168.0.0/16')).toBeInTheDocument();
        });
    });

    test('edits an existing IP filter when the "Edit" button is clicked', async () => {
        const {getByLabelText, getByText, queryByText} = render(wrapWithIntlProviderAndStore(<IPFiltering/>));

        await waitFor(() => {
            expect(getByText('Test IP Filter')).toBeInTheDocument();
        });

        fireEvent.mouseEnter(screen.getByText('Test IP Filter'));
        fireEvent.click(screen.getByRole('button', {
            name: /Edit/i,
        }));

        const descriptionInput = getByLabelText('Enter a name for this rule');
        const cidrInput = getByLabelText('Enter IP Range');
        const saveButton = screen.getByTestId('save-add-edit-button');

        fireEvent.change(cidrInput, {target: {value: '192.168.0.0/16'}});
        fireEvent.change(descriptionInput, {target: {value: 'zzzzzfilter'}});
        fireEvent.click(saveButton);

        await waitFor(() => {
            expect(getByText('zzzzzfilter')).toBeInTheDocument();
            expect(getByText('192.168.0.0/16')).toBeInTheDocument();

            // ensure that the old description is gone, because we've now changed it
            expect(queryByText('Test IP Filter')).toBeNull();
        });
    });

    test('deletes an existing IP filter when the "Delete" button is clicked', async () => {
        const {getByText, queryByText} = render(wrapWithIntlProviderAndStore(<IPFiltering/>));

        await waitFor(() => {
            expect(getByText('Test IP Filter')).toBeInTheDocument();
        });

        fireEvent.mouseEnter(screen.getByText('Test IP Filter'));
        fireEvent.click(screen.getByRole('button', {
            name: /Delete/i,
        }));

        const confirmButton = getByText('Delete filter');

        fireEvent.click(confirmButton);

        await waitFor(() => {
            expect(queryByText('Test IP Filter')).not.toBeInTheDocument();
        });
    });

    test('saves changes when the "Save" button is clicked', async () => {
        const applyIPFiltersMockLocal = vi.fn(() => Promise.resolve(ipFilters));
        Client4.applyIPFilters = applyIPFiltersMockLocal;

        const {getByText, queryByText} = render(wrapWithIntlProviderAndStore(<IPFiltering/>));

        await waitFor(() => {
            expect(screen.getByTestId('filterToggle-button')).toBeInTheDocument();
            expect(screen.getByRole('button', {pressed: true})).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId('filterToggle-button'));

        await waitFor(() => {
            expect(screen.getByRole('button', {pressed: false})).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(queryByText('Test IP Filter')).not.toBeInTheDocument();
        });

        fireEvent.click(getByText('Save'));
        fireEvent.click(screen.getByTestId('save-confirmation-button'));

        await waitFor(() => {
            expect(applyIPFiltersMockLocal).toHaveBeenCalledTimes(1);
        });
    });

    test('Save button is disabled when users IP is not within the allowed ranges', async () => {
        const {getByLabelText, getByText, queryByText, getByTestId} = render(wrapWithIntlProviderAndStore(<IPFiltering/>));

        await waitFor(() => {
            expect(getByText('Test IP Filter')).toBeInTheDocument();
        });

        fireEvent.mouseEnter(screen.getByText('Test IP Filter'));
        fireEvent.click(screen.getByRole('button', {
            name: /Edit/i,
        }));

        const descriptionInput = getByLabelText('Enter a name for this rule');
        const cidrInput = getByLabelText('Enter IP Range');
        const saveButton = screen.getByTestId('save-add-edit-button');

        fireEvent.change(cidrInput, {target: {value: '192.168.0.0/16'}});
        fireEvent.change(descriptionInput, {target: {value: 'zzzzzfilter'}});
        fireEvent.click(saveButton);

        await waitFor(() => {
            expect(getByText('zzzzzfilter')).toBeInTheDocument();
            expect(getByText('192.168.0.0/16')).toBeInTheDocument();

            // ensure that the old description is gone, because we've now changed it
            expect(queryByText('Test IP Filter')).toBeNull();
            expect(getByTestId('saveSetting')).toBeDisabled();
        });
    });

    test('Save button is disabled with a spinner when the page is loaded with a not-stable installation', async () => {
        const getInstallationNotStableMock = vi.fn(() => Promise.resolve({id: 'abc123', state: 'update-in-progress'} as Installation));
        Client4.getInstallation = getInstallationNotStableMock;

        // Use fake timers with shouldAdvanceTime to allow waitFor to work
        vi.useFakeTimers({shouldAdvanceTime: true});

        const {getByText, queryByText} = render(wrapWithIntlProviderAndStore(<IPFiltering/>));

        await waitFor(() => {
            expect(screen.getByTestId('filterToggle-button')).toBeInTheDocument();
            expect(screen.getByRole('button', {pressed: true})).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId('filterToggle-button'));

        await waitFor(() => {
            expect(screen.getByRole('button', {pressed: false})).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(queryByText('Test IP Filter')).not.toBeInTheDocument();
        });

        expect(getByText('Other changes being applied...')).toBeInTheDocument();
        expect(getByText('Other changes being applied...').closest('button')).toBeDisabled();

        // Adjust mock so it now returns a stable state
        Client4.getInstallation = getInstallationMock;

        // Advance timers past the 5000ms polling interval (see index.tsx)
        // to trigger the installation state check, wrapped in act() to handle state updates
        await act(async () => {
            await vi.advanceTimersByTimeAsync(5100);
        });

        await waitFor(() => {
            expect(getByText('Save')).toBeInTheDocument();
        });

        vi.useRealTimers();
    });
});
