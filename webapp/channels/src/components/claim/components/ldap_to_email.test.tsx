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

    test('should render form fields correctly', () => {
        renderWithIntl(<LDAPToEmail {...requiredProps}/>);

        // Check for form elements
        expect(screen.getByText('Switch AD/LDAP Account to Email/Password')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('AD/LDAP Password')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Confirm Password')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Switch account to email/password'})).toBeInTheDocument();
    });

    test('should show validation errors for empty fields', async () => {
        renderWithIntl(<LDAPToEmail {...requiredProps}/>);

        const submitButton = screen.getByRole('button', {name: 'Switch account to email/password'});
        submitButton.click();

        expect(await screen.findByText('Please enter your AD/LDAP password.')).toBeInTheDocument();
    });
});
