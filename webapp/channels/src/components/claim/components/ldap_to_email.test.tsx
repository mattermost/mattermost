// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {ClaimErrors} from 'utils/constants';

import LDAPToEmail from './ldap_to_email';

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
        switchLdapToEmail: jest.fn(() => Promise.resolve({data: {follow_link: '/login'}})),
    };

    beforeEach(() => {
        requiredProps.switchLdapToEmail.mockClear();
    });

    test('submit via MFA should call switchLdapToEmail with empty passwords', async () => {
        const token = 'abcd1234';

        renderWithContext(<LDAPToEmail {...requiredProps}/>);

        // The component initially renders LoginMfa (showMfa starts as true).
        // In this flow, password and ldapPassword state are still empty.
        const tokenInput = screen.getByLabelText('MFA Token');
        await userEvent.type(tokenInput, token);

        await userEvent.click(screen.getByRole('button', {name: 'Submit'}));

        expect(requiredProps.switchLdapToEmail).toHaveBeenCalledTimes(1);
        expect(requiredProps.switchLdapToEmail).
            toHaveBeenCalledWith('', requiredProps.email, '', token);
    });

    test('full flow: password form then MFA should call switchLdapToEmail with passwords and token', async () => {
        const ldapPasswordValue = 'ldapPsw';
        const passwordValue = 'Abc1!xyz';
        const token = 'abcd1234';

        // First call: MFA submission returns a generic error to show the password form
        // Second call: password form submission returns MFA required
        // Third call: MFA submission with token succeeds
        const switchLdapToEmail = jest.fn().
            mockResolvedValueOnce({error: {server_error_id: 'some.generic.error', message: 'Error'}}).
            mockResolvedValueOnce({error: {server_error_id: ClaimErrors.MFA_VALIDATE_TOKEN_AUTHENTICATE, message: 'MFA required'}}).
            mockResolvedValueOnce({data: {follow_link: '/login'}});

        const props = {
            ...requiredProps,
            email: 'test@example.com',
            switchLdapToEmail,
        };

        renderWithContext(<LDAPToEmail {...props}/>);

        // Step 1: Submit the initial MFA form to trigger an error that shows the password form
        const mfaInput = screen.getByLabelText('MFA Token');
        await userEvent.type(mfaInput, 'dummy');
        await userEvent.click(screen.getByRole('button', {name: 'Submit'}));

        // Wait for the password form to appear (showMfa set to false after error)
        await waitFor(() => {
            expect(screen.getByPlaceholderText('AD/LDAP Password')).toBeInTheDocument();
        });

        // Step 2: Fill in the password form and submit
        await userEvent.type(screen.getByPlaceholderText('AD/LDAP Password'), ldapPasswordValue);
        await userEvent.type(screen.getByPlaceholderText('Password'), passwordValue);
        await userEvent.type(screen.getByPlaceholderText('Confirm Password'), passwordValue);
        await userEvent.click(screen.getByRole('button', {name: 'Switch account to email/password'}));

        // Verify the second call includes the passwords
        expect(switchLdapToEmail).toHaveBeenNthCalledWith(2, ldapPasswordValue, 'test@example.com', passwordValue, '');

        // Wait for MFA form to reappear (server returned MFA required)
        await waitFor(() => {
            expect(screen.getByLabelText('MFA Token')).toBeInTheDocument();
        });

        // Step 3: Submit the MFA form with the real token
        await userEvent.type(screen.getByLabelText('MFA Token'), token);
        await userEvent.click(screen.getByRole('button', {name: 'Submit'}));

        // Verify the third call includes stored passwords + token
        expect(switchLdapToEmail).toHaveBeenNthCalledWith(3, ldapPasswordValue, 'test@example.com', passwordValue, token);
    });
});
