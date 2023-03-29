// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import LoggedIn, {Props} from 'components/logged_in/logged_in';
import BrowserStore from 'stores/browser_store';
import * as GlobalActions from 'actions/global_actions';
import {UserProfile} from '@mattermost/types/users';

jest.mock('actions/websocket_actions.jsx', () => ({
    initialize: jest.fn(),
}));

BrowserStore.signalLogin = jest.fn();

describe('components/logged_in/LoggedIn', () => {
    const children = <span>{'Test'}</span>;
    const baseProps: Props = {
        currentUser: {} as UserProfile,
        mfaRequired: false,
        enableTimezone: false,
        actions: {
            autoUpdateTimezone: jest.fn(),
            getChannelURLAction: jest.fn(),
            viewChannel: jest.fn(),
        },
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
});
