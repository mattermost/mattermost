// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {MemoryRouter, Route} from 'react-router-dom';

import type {UserProfile} from '@mattermost/types/users';

import * as GlobalActions from 'actions/global_actions';
import BrowserStore from 'stores/browser_store';

import LoggedIn from 'components/logged_in/logged_in';
import type {Props} from 'components/logged_in/logged_in';

import {act, fireEvent, renderWithContext, screen, waitFor} from 'tests/react_testing_utils';

jest.mock('actions/websocket_actions.jsx', () => ({
    initialize: jest.fn(),
    close: jest.fn(),
}));

jest.mock('utils/timezone', () => ({
    getBrowserTimezone: jest.fn().mockReturnValue('America/New_York'),
}));

// Mock the Redirect component since we want to verify it's rendered with specific props
jest.mock('react-router-dom', () => {
    const actual = jest.requireActual('react-router-dom');
    return {
        ...actual,
        Redirect: jest.fn(({to}) => (
            <div
                data-testid='redirect'
                data-to={to}
            />
        )),
    };
});

// Mock the LoadingScreen component
jest.mock('components/loading_screen', () => {
    return () => <div data-testid='loading-screen'/>;
});

BrowserStore.signalLogin = jest.fn();

describe('components/logged_in/LoggedIn', () => {
    const originalFetch = global.fetch;
    const originalSetInterval = window.setInterval;
    const originalClearInterval = window.clearInterval;
    const originalHasFocus = document.hasFocus;

    beforeAll(() => {
        global.fetch = jest.fn();
        window.setInterval = jest.fn().mockReturnValue(123);
        window.clearInterval = jest.fn();
    });

    afterAll(() => {
        global.fetch = originalFetch;
        window.setInterval = originalSetInterval;
        window.clearInterval = originalClearInterval;
        document.hasFocus = originalHasFocus;
    });

    const children = <span>{'Test'}</span>;
    const baseProps: Props = {
        currentUser: {} as UserProfile,
        mfaRequired: false,
        actions: {
            autoUpdateTimezone: jest.fn(),
            getChannelURLAction: jest.fn(),
            updateApproximateViewTime: jest.fn(),
        },
        isCurrentChannelManuallyUnread: false,
        showTermsOfService: false,
        location: {
            pathname: '/',
            search: '',
        },
    };

    afterEach(() => {
        jest.clearAllMocks();
    });

    const renderComponent = (props: Props) => {
        return renderWithContext(
            <MemoryRouter initialEntries={[props.location?.pathname || '/']}>
                <Route path='*'>
                    <LoggedIn {...props}>{children}</LoggedIn>
                </Route>
            </MemoryRouter>,
        );
    };

    it('should render loading state without user', () => {
        const props = {
            ...baseProps,
            currentUser: undefined,
        };

        renderComponent(props);
        expect(screen.getByTestId('loading-screen')).toBeInTheDocument();
    });

    it('should redirect to mfa when required and not on /mfa/setup', () => {
        const props = {
            ...baseProps,
            mfaRequired: true,
        };

        renderComponent(props);
        expect(screen.getByTestId('redirect')).toHaveAttribute('data-to', '/mfa/setup');
    });

    it('should render children when mfa required and already on /mfa/setup', () => {
        const props = {
            ...baseProps,
            mfaRequired: true,
            location: {
                pathname: '/mfa/setup',
                search: '',
            },
        };

        renderComponent(props);
        expect(screen.getByText('Test')).toBeInTheDocument();
    });

    it('should render children when mfa is not required and on /mfa/confirm', () => {
        const props = {
            ...baseProps,
            mfaRequired: false,
            location: {
                pathname: '/mfa/confirm',
                search: '',
            },
        };

        renderComponent(props);
        expect(screen.getByText('Test')).toBeInTheDocument();
    });

    it('should redirect to terms of service when mfa not required and terms of service required but not on /terms_of_service', () => {
        const props = {
            ...baseProps,
            mfaRequired: false,
            showTermsOfService: true,
        };

        renderComponent(props);
        expect(screen.getByTestId('redirect')).toHaveAttribute('data-to', '/terms_of_service?redirect_to=%2F');
    });

    it('should render children when mfa is not required and terms of service required and on /terms_of_service', () => {
        const props = {
            ...baseProps,
            mfaRequired: false,
            showTermsOfService: true,
            location: {
                pathname: '/terms_of_service',
                search: '',
            },
        };

        renderComponent(props);
        expect(screen.getByText('Test')).toBeInTheDocument();
    });

    it('should render children when neither mfa nor terms of service required', () => {
        const props = {
            ...baseProps,
            mfaRequired: false,
            showTermsOfService: false,
        };

        renderComponent(props);
        expect(screen.getByText('Test')).toBeInTheDocument();
    });

    it('should signal to other tabs when login is successful', () => {
        const props = {
            ...baseProps,
            mfaRequired: false,
            showTermsOfService: true,
        };

        renderComponent(props);
        expect(BrowserStore.signalLogin).toHaveBeenCalledTimes(1);
    });

    it('should set state to unfocused if it starts in the background', () => {
        document.hasFocus = jest.fn(() => false);
        jest.spyOn(GlobalActions, 'emitBrowserFocus');

        const props = {
            ...baseProps,
            mfaRequired: false,
            showTermsOfService: false,
        };

        renderComponent(props);
        expect(GlobalActions.emitBrowserFocus).toHaveBeenCalledWith(false);
    });

    it('should not make viewChannel call on unload', () => {
        const props = {
            ...baseProps,
            mfaRequired: false,
            showTermsOfService: false,
        };

        renderComponent(props);
        expect(screen.getByText('Test')).toBeInTheDocument();

        fireEvent(window, new Event('beforeunload'));
        expect(fetch).not.toHaveBeenCalledWith('/api/v4/channels/members/me/view');
    });

    it('should setup timezone update interval on mount', () => {
        const autoUpdateTimezone = jest.fn();
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                autoUpdateTimezone,
            },
        };

        renderComponent(props);

        // Called once on mount
        expect(autoUpdateTimezone).toHaveBeenCalledTimes(1);
        expect(autoUpdateTimezone).toHaveBeenCalledWith('America/New_York');

        // Setup interval to check every 30 minutes
        expect(window.setInterval).toHaveBeenCalledWith(expect.any(Function), 1800000);
    });

    it('should clear timezone update interval on unmount', () => {
        const props = {
            ...baseProps,
        };

        const {unmount} = renderComponent(props);

        act(() => {
            unmount();
        });

        expect(window.clearInterval).toHaveBeenCalledWith(123);
    });

    it('should update timezone on window focus', async () => {
        const autoUpdateTimezone = jest.fn();
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                autoUpdateTimezone,
            },
        };

        renderComponent(props);

        // Clear initial call count
        autoUpdateTimezone.mockClear();

        // Simulate focus event
        act(() => {
            fireEvent(window, new Event('focus'));
        });

        await waitFor(() => {
            expect(GlobalActions.emitBrowserFocus).toHaveBeenCalledWith(true);
            expect(autoUpdateTimezone).toHaveBeenCalledWith('America/New_York');
        });
    });
});
