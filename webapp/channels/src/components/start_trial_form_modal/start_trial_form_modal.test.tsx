// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {BrowserRouter} from 'react-router-dom';

import type {DeepPartial} from '@mattermost/types/utilities';

import {trackEvent} from 'actions/telemetry_actions';

import {
    renderWithContext,
    screen,
    waitFor,
} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';

import type {GlobalState} from 'types/store';

import StartTrialFormModal from '.';

jest.mock('actions/telemetry_actions.jsx', () => {
    const original = jest.requireActual('actions/telemetry_actions.jsx');
    return {
        ...original,
        trackEvent: jest.fn(),
    };
});

describe('components/start_trial_form_modal/start_trial_form_modal', () => {
    const state: DeepPartial<GlobalState> = {
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
                        open: true,
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
        const wrapper = await waitFor(() => {
            return renderWithContext(
                <BrowserRouter>
                    <StartTrialFormModal {...props}/>
                </BrowserRouter>,
                state,
            );
        });
        expect(wrapper!).toMatchSnapshot();
    });

    test('should pre-fill email, fire trackEvent', () => {
        waitFor(() => {
            renderWithContext(
                <BrowserRouter>
                    <StartTrialFormModal {...props}/>
                </BrowserRouter>,
                state,
            );
        });
        expect(screen.getByDisplayValue('test@mattermost.com')).toBeInTheDocument();
        expect(trackEvent).toHaveBeenCalled();
    });

    test('Start trial button should be disabled on load', () => {
        waitFor(() => {
            renderWithContext(
                <BrowserRouter>
                    <StartTrialFormModal {...props}/>
                </BrowserRouter>,
                state,
            );
        });
        expect(screen.getByRole('button', {name: 'Start trial'})).toBeDisabled();
    });
});
