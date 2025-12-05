// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {MemoryRouter} from 'react-router-dom';

import {renderWithContext, screen, fireEvent, waitFor} from 'tests/vitest_react_testing_utils';

import PasswordResetSendLink from './password_reset_send_link';

describe('components/PasswordResetSendLink', () => {
    const baseProps = {
        actions: {
            sendPasswordResetEmail: vi.fn().mockResolvedValue({data: true}),
        },
    };

    it('should calls sendPasswordResetEmail() action on submit', async () => {
        const props = {...baseProps};

        renderWithContext(
            <MemoryRouter>
                <PasswordResetSendLink {...props}/>
            </MemoryRouter>,
        );

        // Find and fill the email input (using the actual placeholder text)
        const emailInput = screen.getByPlaceholderText('Enter the email address you used to sign up') as HTMLInputElement;
        fireEvent.change(emailInput, {target: {value: 'test@example.com'}});

        // Submit the form
        const form = document.querySelector('form');
        fireEvent.submit(form!);

        await waitFor(() => {
            expect(props.actions.sendPasswordResetEmail).toHaveBeenCalledWith('test@example.com');
        });
    });
});
