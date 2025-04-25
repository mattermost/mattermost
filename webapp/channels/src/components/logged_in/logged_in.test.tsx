// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import type {UserProfile} from '@mattermost/types/users';

import * as GlobalActions from 'actions/global_actions';
import BrowserStore from 'stores/browser_store';

import LoggedIn from 'components/logged_in/logged_in';
import type {Props} from 'components/logged_in/logged_in';

import {fireEvent, renderWithContext, screen} from 'tests/react_testing_utils';

jest.mock('actions/websocket_actions.jsx', () => ({
    initialize: jest.fn(),
    close: jest.fn(),
}));

jest.mock('utils/timezone', () => ({
    getBrowserTimezone: jest.fn().mockReturnValue('America/New_York'),
}));

BrowserStore.signalLogin = jest.fn();

describe('components/logged_in/LoggedIn', () => {
    const originalFetch = global.fetch;
    const originalSetInterval = window.setInterval;
    const originalClearInterval = window.clearInterval;

    beforeAll(() => {
        global.fetch = jest.fn();
        window.setInterval = jest.fn().mockReturnValue(123);
        window.clearInterval = jest.fn();
    });

    afterAll(() => {
        global.fetch = originalFetch;
        window.setInterval = originalSetInterval;
        window.clearInterval = originalClearInterval;
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

    it('should render loading state without user', () => {
        const props = {
            ...baseProps,
            currentUser: undefined,
        };

        const wrapper = shallow(<LoggedIn {...props}>{children}</LoggedIn>);

        expect(wrapper).toMatchInlineSnapshot('<LoadingScreen />');
    });

    it('should redirect to mfa when required and not on /mfa/setup', () => {
        const props = {
            ...baseProps,
            mfaRequired: true,
        };

        const wrapper = shallow(<LoggedIn {...props}>{children}</LoggedIn>);

        expect(wrapper).toMatchInlineSnapshot(`
            <Redirect
              to="/mfa/setup"
            />
        `);
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

        const wrapper = shallow(<LoggedIn {...props}>{children}</LoggedIn>);

        expect(wrapper).toMatchInlineSnapshot(`
            <span>
              Test
            </span>
        `);
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

        const wrapper = shallow(<LoggedIn {...props}>{children}</LoggedIn>);

        expect(wrapper).toMatchInlineSnapshot(`
            <span>
              Test
            </span>
        `);
    });

    it('should redirect to terms of service when mfa not required and terms of service required but not on /terms_of_service', () => {
        const props = {
            ...baseProps,
            mfaRequired: false,
            showTermsOfService: true,
        };

        const wrapper = shallow(<LoggedIn {...props}>{children}</LoggedIn>);

        expect(wrapper).toMatchInlineSnapshot(`
            <Redirect
              to="/terms_of_service?redirect_to=%2F"
            />
        `);
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

        const wrapper = shallow(<LoggedIn {...props}>{children}</LoggedIn>);

        expect(wrapper).toMatchInlineSnapshot(`
            <span>
              Test
            </span>
        `);
    });

    it('should render children when neither mfa nor terms of service required', () => {
        const props = {
            ...baseProps,
            mfaRequired: false,
            showTermsOfService: false,
        };

        const wrapper = shallow(<LoggedIn {...props}>{children}</LoggedIn>);

        expect(wrapper).toMatchInlineSnapshot(`
            <span>
              Test
            </span>
        `);
    });

    it('should signal to other tabs when login is successful', () => {
        const props = {
            ...baseProps,
            mfaRequired: false,
            showTermsOfService: true,
        };

        shallow(<LoggedIn {...props}>{children}</LoggedIn>);

        expect(BrowserStore.signalLogin).toBeCalledTimes(1);
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

        shallow(<LoggedIn {...props}>{children}</LoggedIn>);
        expect(obj.emitBrowserFocus).toBeCalledTimes(1);
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

    it('should setup timezone update interval on mount', () => {
        const autoUpdateTimezone = jest.fn();
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                autoUpdateTimezone,
            },
        };

        shallow(<LoggedIn {...props}>{children}</LoggedIn>);

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

        const wrapper = shallow(<LoggedIn {...props}>{children}</LoggedIn>);
        wrapper.unmount();

        expect(window.clearInterval).toHaveBeenCalledWith(123);
    });

    it('should update timezone on window focus', () => {
        const autoUpdateTimezone = jest.fn();
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                autoUpdateTimezone,
            },
        };

        shallow(<LoggedIn {...props}>{children}</LoggedIn>);
        
        // Clear initial call count
        autoUpdateTimezone.mockClear();

        // Simulate focus event
        fireEvent(window, new Event('focus'));
        
        expect(GlobalActions.emitBrowserFocus).toHaveBeenCalledWith(true);
        expect(autoUpdateTimezone).toHaveBeenCalledWith('America/New_York');
    });
});
