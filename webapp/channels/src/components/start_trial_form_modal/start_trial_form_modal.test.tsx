// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Provider} from 'react-redux';
import {BrowserRouter} from 'react-router-dom';

import {trackEvent} from 'actions/telemetry_actions';

import {
    act,
    renderWithIntl,
    screen,
} from 'tests/react_testing_utils';
import type {
    RenderResult} from 'tests/react_testing_utils';
import mockStore from 'tests/test_store';
import {ModalIdentifiers} from 'utils/constants';

import StartTrialFormModal from '.';

jest.mock('actions/telemetry_actions.jsx', () => {
    const original = jest.requireActual('actions/telemetry_actions.jsx');
    return {
        ...original,
        trackEvent: jest.fn(),
    };
});

describe('components/start_trial_form_modal/start_trial_form_modal', () => {
    const state = {
        entities: {
            users: {
                currentUserId: 'user1',
                profiles: {
                    user1: {
                        id: 'user1',
                        roles: '',
                        email: 'test@mattermost.com',
                    },
                },
            },
            general: {
                license: {
                    IsLicensed: 'true',
                    Cloud: 'false',
                },
                config: {
                    TelemetryId: 'test123',
                },
            },
        },
        views: {
            modals: {
                modalState: {
                    [ModalIdentifiers.START_TRIAL_FORM_MODAL]: {
                        open: 'true',
                    },
                },
            },
            admin: {
                navigationBlock: {
                    blocked: true,
                },
            },
        },
    };

    const handleOnClose = jest.fn();

    const props = {
        onClose: handleOnClose,
        page: 'some_modal',
    };

    test('should match snapshot', async () => {
        const store = await mockStore(state);
        let wrapper: RenderResult | HTMLElement | null;
        await act(async () => {
            wrapper = await renderWithIntl(
                <Provider store={store}>
                    <BrowserRouter>
                        <StartTrialFormModal {...props}/>
                    </BrowserRouter>
                </Provider>);
        });
        expect(wrapper!).toMatchSnapshot();
    });

    test('should pre-fill email, fire trackEvent', async () => {
        const store = await mockStore(state);
        await act(async () => {
            await renderWithIntl(
                <Provider store={store}>
                    <BrowserRouter>
                        <StartTrialFormModal {...props}/>
                    </BrowserRouter>
                </Provider>);
        });
        expect(screen.getByDisplayValue('test@mattermost.com')).toBeInTheDocument();
        expect(trackEvent).toHaveBeenCalled();
    });

    test('Start trial button should be disabled on load', async () => {
        const store = await mockStore(state);
        await act(async () => {
            await renderWithIntl(
                <Provider store={store}>
                    <BrowserRouter>
                        <StartTrialFormModal {...props}/>
                    </BrowserRouter>
                </Provider>);
        });
        expect(screen.getByRole('button', {name: 'Start trial'})).toBeDisabled();
    });
});
