// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserProfile} from '@mattermost/types/users';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ResetEmailModal from './reset_email_modal';

describe('components/admin_console/reset_email_modal/reset_email_modal.tsx', () => {
    const user: UserProfile = TestHelper.getUserMock({
        id: 'user_id_1',
        email: 'arvin.darmawan@gmail.com',
        first_name: 'Arvin',
        last_name: 'Darmawan',
    });

    const baseProps = {
        actions: {patchUser: jest.fn(() => Promise.resolve({}))},
        user,
        currentUserId: 'random_user_id',
        onSuccess: jest.fn(),
        onExited: jest.fn(),
    };

    test('should render modal with user name in title', () => {
        renderWithContext(<ResetEmailModal {...baseProps}/>);

        expect(screen.getByText(/Update email for Arvin Darmawan/i)).toBeInTheDocument();
        expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    test('should render null when there is no user', () => {
        const props = {...baseProps, user: undefined};
        const {container} = renderWithContext(<ResetEmailModal {...props}/>);

        expect(container).toBeEmptyDOMElement();
    });

    test('should show password field when updating own email', () => {
        const props = {...baseProps, currentUserId: user.id};
        renderWithContext(<ResetEmailModal {...props}/>);

        // Should have both email and password inputs
        const inputs = screen.getAllByRole('textbox');
        expect(inputs.length).toBeGreaterThanOrEqual(1);

        // Password input won't have role="textbox", check by placeholder
        expect(screen.getByPlaceholderText(/Current password/i)).toBeInTheDocument();
    });

    test('should not update email since the email is empty', async () => {
        renderWithContext(<ResetEmailModal {...baseProps}/>);

        // Click submit without entering email
        await userEvent.click(screen.getByRole('button', {name: /Update/i}));

        expect(baseProps.actions.patchUser).not.toHaveBeenCalled();
        await waitFor(() => {
            expect(screen.getByText(/Please enter a valid email address/i)).toBeInTheDocument();
        });
    });

    test('should not update email since the email is invalid', async () => {
        renderWithContext(<ResetEmailModal {...baseProps}/>);

        const emailInput = screen.getByPlaceholderText(/Enter new email address/i);
        await userEvent.type(emailInput, 'invalid-email');
        await userEvent.click(screen.getByRole('button', {name: /Update/i}));

        expect(baseProps.actions.patchUser).not.toHaveBeenCalled();
        await waitFor(() => {
            expect(screen.getByText(/Please enter a valid email address/i)).toBeInTheDocument();
        });
    });

    test('should require password when updating email of the current user', async () => {
        const props = {...baseProps, currentUserId: user.id};
        renderWithContext(<ResetEmailModal {...props}/>);

        const emailInput = screen.getByPlaceholderText(/Enter new email address/i);
        await userEvent.type(emailInput, 'currentUser@test.com');
        await userEvent.click(screen.getByRole('button', {name: /Update/i}));

        expect(baseProps.actions.patchUser).not.toHaveBeenCalled();
        await waitFor(() => {
            expect(screen.getByText(/Please enter your current password/i)).toBeInTheDocument();
        });
    });

    test('should update email since the email is valid for another user', async () => {
        const patchUser = jest.fn(() => Promise.resolve({}));
        const props = {...baseProps, actions: {patchUser}};
        renderWithContext(<ResetEmailModal {...props}/>);

        const emailInput = screen.getByPlaceholderText(/Enter new email address/i);
        await userEvent.type(emailInput, 'user@test.com');
        await userEvent.click(screen.getByRole('button', {name: /Update/i}));

        await waitFor(() => {
            expect(patchUser).toHaveBeenCalledTimes(1);
            expect(patchUser).toHaveBeenCalledWith(expect.objectContaining({
                email: 'user@test.com',
            }));
        });
    });

    test('should update email since the email is valid for the current user', async () => {
        const patchUser = jest.fn(() => Promise.resolve({}));
        const props = {...baseProps, currentUserId: user.id, actions: {patchUser}};
        renderWithContext(<ResetEmailModal {...props}/>);

        const emailInput = screen.getByPlaceholderText(/Enter new email address/i);
        await userEvent.type(emailInput, 'currentUser@test.com');

        const passwordInput = screen.getByPlaceholderText(/Current password/i);
        await userEvent.type(passwordInput, 'password123');

        await userEvent.click(screen.getByRole('button', {name: /Update/i}));

        await waitFor(() => {
            expect(patchUser).toHaveBeenCalledTimes(1);
            expect(patchUser).toHaveBeenCalledWith(expect.objectContaining({
                email: 'currentuser@test.com', // lowercase
                password: 'password123',
            }));
        });
    });
});
