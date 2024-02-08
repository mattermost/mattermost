// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {RouteComponentProps} from 'react-router-dom';

import type {UserProfile} from '@mattermost/types/users';

import SystemUserDetail, {getUserAuthenticationTextField} from 'components/admin_console/system_user_detail/system_user_detail';
import type {
    Props,
    Params,
} from 'components/admin_console/system_user_detail/system_user_detail';

import {shallowWithIntl, type MockIntl} from 'tests/helpers/intl-test-helper';

describe('SystemUserDetail', () => {
    const defaultProps: Props = {
        mfaEnabled: false,
        patchUser: jest.fn(),
        updateUserMfa: jest.fn(),
        getUser: jest.fn(),
        updateUserActive: jest.fn(),
        setNavigationBlocked: jest.fn(),
        addUserToTeam: jest.fn(),
        openModal: jest.fn(),
        intl: {
            formatMessage: jest.fn(),
        } as MockIntl,
        ...({
            match: {
                params: {
                    user_id: 'user_id',
                },
            },
        } as RouteComponentProps<Params>),
    };

    test('should match default snapshot', () => {
        const props = defaultProps;
        const wrapper = shallowWithIntl(<SystemUserDetail {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot if MFA is enabled', () => {
        const props = {
            ...defaultProps,
            mfaEnabled: true,
        };
        const wrapper = shallowWithIntl(<SystemUserDetail {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });
});

describe('getUserAuthenticationTextField', () => {
    const intl = {formatMessage: ({defaultMessage}) => defaultMessage} as MockIntl;

    it('should return empty string if user is not provided', () => {
        const result = getUserAuthenticationTextField(intl, false, undefined);
        expect(result).toEqual('');
    });

    it('should return email if user has no auth service and MFA is not enabled', () => {
        const result = getUserAuthenticationTextField(intl, false, {auth_service: '', mfa_active: false} as UserProfile);
        expect(result).toEqual('Email');
    });

    it('should return auth service in uppercase if it is LDAP or SAML', () => {
        const result = getUserAuthenticationTextField(intl, false, {auth_service: 'ldap', mfa_active: false} as UserProfile);
        expect(result).toEqual('LDAP');
    });

    it('should return auth service in title case if it is not LDAP or SAML', () => {
        const result = getUserAuthenticationTextField(intl, true, {auth_service: 'oauth', mfa_active: false} as UserProfile);
        expect(result).toEqual('Oauth');
    });

    it('should include MFA if user has MFA enabled', () => {
        const result = getUserAuthenticationTextField(intl, true, {auth_service: 'oauth', mfa_active: true} as UserProfile);
        expect(result).toEqual('Oauth, MFA');
    });
});
