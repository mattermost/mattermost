// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, fireEvent} from 'tests/vitest_react_testing_utils';

import PasswordResetForm from './password_reset_form';

describe('components/PasswordResetForm', () => {
    const baseProps = {
        location: {
            search: '',
        },
        siteName: 'Mattermost',
        actions: {
            resetUserPassword: vi.fn().mockResolvedValue({data: true}),
        },
    };

    it('should match snapshot', () => {
        const {container} = renderWithContext(<PasswordResetForm {...baseProps}/>);
        expect(container).toMatchSnapshot();
    });

    it('should call the resetUserPassword() action on submit', () => {
        const props = {
            ...baseProps,
            location: {
                search: '?token=TOKEN',
            },
        };

        renderWithContext(<PasswordResetForm {...props}/>);

        // Find the password input and set value
        const passwordInput = screen.getByPlaceholderText('Password') as HTMLInputElement;
        fireEvent.change(passwordInput, {target: {value: 'PASSWORD'}});

        // Submit the form
        const form = document.querySelector('form');
        fireEvent.submit(form!);

        expect(props.actions.resetUserPassword).toHaveBeenCalledWith('TOKEN', 'PASSWORD');
    });
});
