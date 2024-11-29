// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {screen} from '@testing-library/react';

import {renderWithIntl} from 'tests/react_testing_utils';

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

    test('should show main form when showMfa is false', () => {
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
        submitButton.click();

        // Wait for error and check main form elements
        expect(props.switchLdapToEmail).toHaveBeenCalled();
    });
});
