// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import PasswordSettings from 'components/admin_console/password_settings';

import Constants from 'utils/constants';

import {renderWithContext, screen} from 'tests/react_testing_utils';

describe('components/PasswordSettings', () => {
    const config = {
        PasswordSettings: {
            MinimumLength: 8,
            Lowercase: true,
            Number: true,
            Uppercase: true,
            Symbol: true,
            EnableForgotLink: true,
        },
        ServiceSettings: {
            MaximumLoginAttempts: 10,
        },
        ExperimentalSettings: {
            RestrictSystemAdmin: false,
        },
    };

    const baseProps = {
        config,
        isDisabled: false,
    };

    test('renders numeric password settings as native type=number Compass inputs', () => {
        const {container} = renderWithContext(
            <PasswordSettings
                {...baseProps}
            />,
        );

        const minimumLength = screen.getByTestId('passwordMinimumLengthnumber');
        expect(minimumLength).toHaveAttribute('type', 'number');
        expect(minimumLength).toHaveAttribute('id', 'passwordMinimumLength');
        expect(minimumLength).toHaveAttribute('min', String(Constants.MIN_PASSWORD_LENGTH));
        expect(minimumLength).toHaveAttribute('max', String(Constants.MAX_PASSWORD_LENGTH));
        expect(minimumLength).not.toHaveClass('form-control');

        const maximumLoginAttempts = screen.getByTestId('maximumLoginAttemptsnumber');
        expect(maximumLoginAttempts).toHaveAttribute('type', 'number');
        expect(maximumLoginAttempts).toHaveAttribute('id', 'maximumLoginAttempts');
        expect(maximumLoginAttempts).toHaveAttribute('min', '1');
        expect(maximumLoginAttempts).not.toHaveClass('form-control');

        for (const input of [minimumLength, maximumLoginAttempts]) {
            const fieldRoot = input.closest('.Input_container');
            expect(fieldRoot).toBeInTheDocument();
            expect(fieldRoot!.querySelector('legend')).not.toBeInTheDocument();
        }

        expect(container.querySelectorAll('.Input_container').length).toBeGreaterThanOrEqual(2);
    });
});
