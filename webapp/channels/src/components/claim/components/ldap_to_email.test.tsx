// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {act, screen, waitFor} from '@testing-library/react';

import {renderWithIntl, userEvent} from 'tests/react_testing_utils';

import LDAPToEmail from './ldap_to_email';

describe('components/claim/components/ldap_to_email.jsx', () => {
    const requiredProps = {
        email: 'test@example.com',
        passwordConfig: {
            minimumLength: 5,
            requireLowercase: true,
            requireUppercase: true,
            requireNumber: true,
            requireSymbol: true,
        },
        switchLdapToEmail: jest.fn(() => Promise.resolve({data: {follow_link: '/login'}})),
    };

    test('should render MFA form initially', () => {
        renderWithIntl(<LDAPToEmail {...requiredProps}/>);

        // Check for MFA form elements
        expect(screen.getByText('Switch AD/LDAP Account to Email/Password')).toBeInTheDocument();
        expect(screen.getByLabelText('Enter MFA Token')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Submit'})).toBeInTheDocument();
    });

    test('should show main form when showMfa is false', async () => {
        const props = {
            ...requiredProps,
            switchLdapToEmail: jest.fn(() => Promise.resolve({
                error: {
                    server_error_id: 'model.user.is_valid.pwd',
                    message: 'Invalid password',
                },
            })),
        };

        renderWithIntl(<LDAPToEmail {...props}/>);

        // Submit MFA form to trigger error and show main form
        const submitButton = screen.getByRole('button', {name: 'Submit'});
        const tokenInput = screen.getByLabelText('Enter MFA Token');
        
        await act(async () => {
            await userEvent.type(tokenInput, '123456');
            await userEvent.click(submitButton);
        });

        // Wait for error and check main form elements
        await waitFor(() => {
            expect(props.switchLdapToEmail).toHaveBeenCalledWith(
                '', // ldapPassword
                'test@example.com', // loginId
                '', // password  
                '123456' // token
            );
        });

        // Verify main form appears
        await waitFor(() => {
            expect(screen.getByText('AD/LDAP Password:')).toBeInTheDocument();
            expect(screen.getByPlaceholderText('AD/LDAP Password')).toBeInTheDocument();
            expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
            expect(screen.getByPlaceholderText('Confirm Password')).toBeInTheDocument();
        });
    });
});
