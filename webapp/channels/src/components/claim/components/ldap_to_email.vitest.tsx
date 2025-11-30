// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

import LDAPToEmail from './ldap_to_email';

// Mock LoginMfa to capture the onSubmit callback
let capturedOnSubmit: ((options: {loginId: string; password: string; token?: string; ldapPasswordParam?: string}) => void) | null = null;

vi.mock('components/login/login_mfa', () => ({
    default: ({onSubmit}: {onSubmit: (options: {loginId: string; password: string; token?: string; ldapPasswordParam?: string}) => void}) => {
        capturedOnSubmit = onSubmit;
        return <div data-testid='login-mfa'>{'LoginMfa Mock'}</div>;
    },
}));

describe('components/claim/components/ldap_to_email.jsx', () => {
    const requiredProps = {
        email: '',
        passwordConfig: {
            minimumLength: 5,
            requireLowercase: true,
            requireUppercase: true,
            requireNumber: true,
            requireSymbol: true,
        },
        switchLdapToEmail: vi.fn(() => Promise.resolve({data: {follow_link: '/login'}})),
    };

    beforeEach(() => {
        capturedOnSubmit = null;
        requiredProps.switchLdapToEmail.mockClear();
    });

    test('submit() should have called switchLdapToEmail', async () => {
        const loginId = '';
        const password = 'psw';
        const token = 'abcd1234';
        const ldapPasswordParam = 'ldapPsw';

        renderWithContext(<LDAPToEmail {...requiredProps}/>);

        // The component renders LoginMfa initially (showMfa=true)
        // Our mock captures the onSubmit callback
        expect(capturedOnSubmit).not.toBeNull();

        // Simulate the LoginMfa submit event
        capturedOnSubmit!({loginId, password, token, ldapPasswordParam});

        expect(requiredProps.switchLdapToEmail).toHaveBeenCalledTimes(1);
        expect(requiredProps.switchLdapToEmail).
            toHaveBeenCalledWith(ldapPasswordParam, requiredProps.email, password, token);
    });
});
