// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Redirect} from 'react-router-dom';

import type {UserProfile} from '@mattermost/types/users';

import * as GlobalActions from 'actions/global_actions';
import BrowserStore from 'stores/browser_store';

import LoggedIn from 'components/logged_in/logged_in';
import type {Props} from 'components/logged_in/logged_in';

import {fireEvent, renderWithContext, screen} from 'tests/react_testing_utils';

jest.mock('react-router-dom', () => {
    const actual = jest.requireActual('react-router-dom');
    return {
        ...actual,
        Redirect: jest.fn(() => null),
    };
});

jest.mock('actions/websocket_actions', () => ({
    initialize: jest.fn(),
    close: jest.fn(),
}));

BrowserStore.signalLogin = jest.fn();

describe('components/logged_in/LoggedIn', () => {
    const originalFetch = global.fetch;
    beforeAll(() => {
        global.fetch = jest.fn();
    });
    afterAll(() => {
        global.fetch = originalFetch;
    });
    afterEach(() => {
        (Redirect as unknown as jest.Mock).mockClear();
    });

    const children = <span>{'Test'}</span>;
    const baseProps: Props = {
        currentUser: {} as UserProfile,
        mfaRequired: false,
        customProfileAttributesEnabled: false,
        actions: {
            autoUpdateTimezone: jest.fn(),
            getChannelURLAction: jest.fn(),
            updateApproximateViewTime: jest.fn(),
            getCustomProfileAttributeFields: jest.fn(),
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

        const {container} = renderWithContext(<LoggedIn {...props}>{children}</LoggedIn>);

        expect(container.querySelector('.loading-screen')).toBeInTheDocument();
    });

    it('should redirect to mfa when required and not on /mfa/setup', () => {
        const props = {
            ...baseProps,
            mfaRequired: true,
        };

        renderWithContext(<LoggedIn {...props}>{children}</LoggedIn>);

        expect(Redirect).toHaveBeenCalledWith(
            expect.objectContaining({to: '/mfa/setup'}),
            {},
        );
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

        expect(Redirect).toHaveBeenCalledWith(
            expect.objectContaining({to: '/terms_of_service?redirect_to=%2F'}),
            {},
        );
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
        const props = {
            ...baseProps,
            mfaRequired: false,
            showTermsOfService: true,
        };

        renderWithContext(<LoggedIn {...props}>{children}</LoggedIn>);

        expect(BrowserStore.signalLogin).toHaveBeenCalledTimes(1);
    });

    it('should set state to unfocused if it starts in the background', () => {
        document.hasFocus = jest.fn(() => false);

        const obj = Object.assign(GlobalActions);
        obj.emitBrowserFocus = jest.fn();

        const props = {
            ...baseProps,
            mfaRequired: false,
            showTermsOfService: true,
        };

        renderWithContext(<LoggedIn {...props}>{children}</LoggedIn>);
        expect(obj.emitBrowserFocus).toHaveBeenCalledTimes(1);
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
            const props = {
                ...baseProps,
                customProfileAttributesEnabled: false,
            };

            renderWithContext(<LoggedIn {...props}>{children}</LoggedIn>);

            expect(props.actions.getCustomProfileAttributeFields).not.toHaveBeenCalled();
        });
    });
});
