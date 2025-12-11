// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserProfile} from '@mattermost/types/users';

import * as GlobalActions from 'actions/global_actions';
import BrowserStore from 'stores/browser_store';

import LoggedIn from 'components/logged_in/logged_in';
import type {Props} from 'components/logged_in/logged_in';

import {fireEvent, renderWithContext, screen} from 'tests/vitest_react_testing_utils';

vi.mock('actions/websocket_actions.jsx', () => ({
    initialize: vi.fn(),
    close: vi.fn(),
}));

BrowserStore.signalLogin = vi.fn();

describe('components/logged_in/LoggedIn', () => {
    const originalFetch = global.fetch;
    beforeAll(() => {
        global.fetch = vi.fn();
    });
    afterAll(() => {
        global.fetch = originalFetch;
    });

    const children = <span>{'Test'}</span>;
    const baseProps: Props = {
        currentUser: {} as UserProfile,
        mfaRequired: false,
        customProfileAttributesEnabled: false,
        actions: {
            autoUpdateTimezone: vi.fn(),
            getChannelURLAction: vi.fn(),
            updateApproximateViewTime: vi.fn(),
            getCustomProfileAttributeFields: vi.fn(),
        },
        isCurrentChannelManuallyUnread: false,
        showTermsOfService: false,
        location: {
            pathname: '/',
            search: '',
        },
    };

    it('should render loading state without user', () => {
        const props = {
            ...baseProps,
            currentUser: undefined,
        };

        renderWithContext(<LoggedIn {...props}>{children}</LoggedIn>);

        // Should render loading screen - look for the loading text
        expect(screen.getByText('Loading')).toBeInTheDocument();
    });

    it('should redirect to mfa when required and not on /mfa/setup', () => {
        const props = {
            ...baseProps,
            mfaRequired: true,
        };

        renderWithContext(<LoggedIn {...props}>{children}</LoggedIn>);

        // Should redirect to /mfa/setup - children should not be rendered
        expect(screen.queryByText('Test')).not.toBeInTheDocument();
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

        renderWithContext(<LoggedIn {...props}>{children}</LoggedIn>);

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

        renderWithContext(<LoggedIn {...props}>{children}</LoggedIn>);

        expect(screen.getByText('Test')).toBeInTheDocument();
    });

    it('should redirect to terms of service when mfa not required and terms of service required but not on /terms_of_service', () => {
        const props = {
            ...baseProps,
            mfaRequired: false,
            showTermsOfService: true,
        };

        renderWithContext(<LoggedIn {...props}>{children}</LoggedIn>);

        // Should redirect to terms of service - children should not be rendered
        expect(screen.queryByText('Test')).not.toBeInTheDocument();
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

        renderWithContext(<LoggedIn {...props}>{children}</LoggedIn>);

        expect(screen.getByText('Test')).toBeInTheDocument();
    });

    it('should render children when neither mfa nor terms of service required', () => {
        const props = {
            ...baseProps,
            mfaRequired: false,
            showTermsOfService: false,
        };

        renderWithContext(<LoggedIn {...props}>{children}</LoggedIn>);

        expect(screen.getByText('Test')).toBeInTheDocument();
    });

    it('should signal to other tabs when login is successful', () => {
        vi.mocked(BrowserStore.signalLogin).mockClear();

        const props = {
            ...baseProps,
            mfaRequired: false,
            showTermsOfService: false,
        };

        renderWithContext(<LoggedIn {...props}>{children}</LoggedIn>);

        expect(BrowserStore.signalLogin).toHaveBeenCalled();
    });

    it('should set state to unfocused if it starts in the background', () => {
        const originalHasFocus = document.hasFocus;
        document.hasFocus = vi.fn(() => false);

        const emitBrowserFocusSpy = vi.spyOn(GlobalActions, 'emitBrowserFocus');

        const props = {
            ...baseProps,
            mfaRequired: false,
            showTermsOfService: false,
        };

        renderWithContext(<LoggedIn {...props}>{children}</LoggedIn>);
        expect(emitBrowserFocusSpy).toHaveBeenCalled();

        document.hasFocus = originalHasFocus;
        emitBrowserFocusSpy.mockRestore();
    });

    it('should not make viewChannel call on unload', () => {
        const props = {
            ...baseProps,
            mfaRequired: false,
            showTermsOfService: false,
        };

        renderWithContext(<LoggedIn {...props}>{children}</LoggedIn>);
        expect(screen.getByText('Test')).toBeInTheDocument();

        fireEvent(window, new Event('beforeunload'));
        expect(fetch).not.toHaveBeenCalledWith('/api/v4/channels/members/me/view');
    });

    describe('custom profile attributes', () => {
        it('should call getCustomProfileAttributeFields when feature is enabled on mount', () => {
            const props = {
                ...baseProps,
                customProfileAttributesEnabled: true,
            };

            renderWithContext(<LoggedIn {...props}>{children}</LoggedIn>);

            expect(props.actions.getCustomProfileAttributeFields).toHaveBeenCalledTimes(1);
        });

        it('should not call getCustomProfileAttributeFields when feature is disabled', () => {
            const getCustomProfileAttributeFields = vi.fn();
            const props = {
                ...baseProps,
                customProfileAttributesEnabled: false,
                actions: {
                    ...baseProps.actions,
                    getCustomProfileAttributeFields,
                },
            };

            renderWithContext(<LoggedIn {...props}>{children}</LoggedIn>);

            expect(getCustomProfileAttributeFields).not.toHaveBeenCalled();
        });
    });
});
