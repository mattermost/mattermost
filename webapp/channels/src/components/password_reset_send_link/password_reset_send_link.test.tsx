// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {MemoryRouter} from 'react-router-dom';

import {renderWithContext, screen, waitFor, userEvent} from 'tests/react_testing_utils';

import PasswordResetSendLink from './password_reset_send_link';

describe('components/PasswordResetSendLink', () => {
    const baseProps = {
        actions: {
            sendPasswordResetEmail: jest.fn().mockResolvedValue({data: true}),
        },
    };

    it('should calls sendPasswordResetEmail() action on submit', async () => {
        const props = {...baseProps};

        renderWithContext(
            <MemoryRouter>
                <PasswordResetSendLink {...props}/>
            </MemoryRouter>,
        );

        const emailInput = screen.getByPlaceholderText(/email/i) || screen.getByRole('textbox');
        await userEvent.type(emailInput, 'test@example.com');

        const form = emailInput.closest('form')!;
        form.requestSubmit();

        await waitFor(() => {
            expect(props.actions.sendPasswordResetEmail).toHaveBeenCalledWith('test@example.com');
        });
    });
});
