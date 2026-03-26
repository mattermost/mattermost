// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserNotifyProps, UserProfile} from '@mattermost/types/users';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ResetPasswordModal from './reset_password_modal';

describe('components/admin_console/reset_password_modal/reset_password_modal.tsx', () => {
    const notifyProps: UserNotifyProps = {
        channel: 'true',
        comments: 'never',
        desktop: 'default',
        desktop_sound: 'true',
        calls_desktop_sound: 'true',
        email: 'true',
        first_name: 'true',
        mark_unread: 'all',
        mention_keys: '',
        highlight_keys: '',
        push: 'default',
        push_status: 'ooo',
    };

    const user: UserProfile = TestHelper.getUserMock({
        id: 'user_id_1',
        auth_service: '',
        email: 'testuser@example.com',
        notify_props: notifyProps,
        first_name: 'Test',
        last_name: 'User',
        username: 'testuser',
    });

    const baseProps = {
        actions: {
            updateUserPassword: jest.fn(() => Promise.resolve({data: ''})),
            sendPasswordResetEmail: jest.fn(() => Promise.resolve({data: ''})),
        },
        currentUserId: user.id,
        user,
        onExited: jest.fn(),
        canSendPasswordResetEmail: false,
        passwordConfig: {
            minimumLength: 10,
            requireLowercase: true,
            requireNumber: true,
            requireSymbol: true,
            requireUppercase: true,
        },
    };

    test('should render modal with user name in title', () => {
        renderWithContext(<ResetPasswordModal {...baseProps}/>);

        expect(screen.getByText(/Reset password for Test User/i)).toBeInTheDocument();
    });

    test('should render null when there is no user', () => {
        const props = {...baseProps, user: undefined};
        const {container} = renderWithContext(<ResetPasswordModal {...props}/>);

        expect(container).toBeEmptyDOMElement();
    });

    test('should show switch account title when user has auth_service', () => {
        const authUser = TestHelper.getUserMock({
            ...user,
            auth_service: 'ldap',
        });
        const props = {...baseProps, user: authUser};
        renderWithContext(<ResetPasswordModal {...props}/>);

        expect(screen.getByText(/Switch account to Email\/Password/i)).toBeInTheDocument();
    });

    test('should show current password field when resetting own password', () => {
        renderWithContext(<ResetPasswordModal {...baseProps}/>);

        expect(screen.getByPlaceholderText(/Current password/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/New password/i)).toBeInTheDocument();
    });

    test('should not show current password field when resetting another user password', () => {
        const props = {...baseProps, currentUserId: 'different_user_id'};
        renderWithContext(<ResetPasswordModal {...props}/>);

        expect(screen.queryByPlaceholderText(/Current password/i)).not.toBeInTheDocument();
        expect(screen.getByPlaceholderText(/New password/i)).toBeInTheDocument();
    });

    test('should call updateUserPassword with both passwords when resetting own password', async () => {
        const updateUserPassword = jest.fn(() => Promise.resolve({data: ''}));
        const props = {...baseProps, actions: {...baseProps.actions, updateUserPassword}};
        renderWithContext(<ResetPasswordModal {...props}/>);

        const currentPasswordInput = screen.getByPlaceholderText(/Current password/i);
        const newPasswordInput = screen.getByPlaceholderText(/New password/i);

        await userEvent.type(currentPasswordInput, 'oldPassword123!');
        await userEvent.type(newPasswordInput, 'newPassword123!');
        await userEvent.click(screen.getByRole('button', {name: /Reset/i}));

        await waitFor(() => {
            expect(updateUserPassword).toHaveBeenCalledTimes(1);
            expect(updateUserPassword).toHaveBeenCalledWith(
                user.id,
                'oldPassword123!',
                'newPassword123!',
            );
        });
    });

    test('should not call updateUserPassword when the current password is not provided', async () => {
        const updateUserPassword = jest.fn(() => Promise.resolve({data: ''}));
        const props = {...baseProps, actions: {...baseProps.actions, updateUserPassword}};
        renderWithContext(<ResetPasswordModal {...props}/>);

        const newPasswordInput = screen.getByPlaceholderText(/New password/i);
        await userEvent.type(newPasswordInput, 'newPassword123!');
        await userEvent.click(screen.getByRole('button', {name: /Reset/i}));

        expect(updateUserPassword).not.toHaveBeenCalled();
        await waitFor(() => {
            expect(screen.getByText(/Please enter your current password/i)).toBeInTheDocument();
        });
    });

    test('should call updateUserPassword without current password when resetting another user', async () => {
        const updateUserPassword = jest.fn(() => Promise.resolve({data: ''}));
        const props = {...baseProps, currentUserId: 'different_user_id', actions: {...baseProps.actions, updateUserPassword}};
        renderWithContext(<ResetPasswordModal {...props}/>);

        const newPasswordInput = screen.getByPlaceholderText(/New password/i);
        await userEvent.type(newPasswordInput, 'Password123!');
        await userEvent.click(screen.getByRole('button', {name: /Reset/i}));

        await waitFor(() => {
            expect(updateUserPassword).toHaveBeenCalledTimes(1);
            expect(updateUserPassword).toHaveBeenCalledWith(
                user.id,
                '',
                'Password123!',
            );
        });
    });

    test('should show error when password does not meet requirements', async () => {
        const updateUserPassword = jest.fn(() => Promise.resolve({data: ''}));
        const props = {...baseProps, currentUserId: 'different_user_id', actions: {...baseProps.actions, updateUserPassword}};
        renderWithContext(<ResetPasswordModal {...props}/>);

        const newPasswordInput = screen.getByPlaceholderText(/New password/i);
        await userEvent.type(newPasswordInput, 'weak');
        await userEvent.click(screen.getByRole('button', {name: /Reset/i}));

        expect(updateUserPassword).not.toHaveBeenCalled();

        await waitFor(() => {
            expect(screen.getByText(/Must be 10-72 characters long/i)).toBeInTheDocument();
        });
    });

    describe('password reset email mode', () => {
        const otherUserProps = {
            ...baseProps,
            currentUserId: 'different_user_id',
            canSendPasswordResetEmail: true,
        };

        test('should show email-first content when resetting another user with email enabled', () => {
            renderWithContext(<ResetPasswordModal {...otherUserProps}/>);

            expect(screen.getByText(/send a password reset link to/i)).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /Set a new password manually/i})).toBeInTheDocument();
            expect(screen.queryByRole('radio')).not.toBeInTheDocument();
        });

        test('should not show email-first content when resetting own password', () => {
            const props = {...baseProps, canSendPasswordResetEmail: true};
            renderWithContext(<ResetPasswordModal {...props}/>);

            expect(screen.queryByText(/send a password reset link to/i)).not.toBeInTheDocument();
        });

        test('should not show email-first content for auth_service users', () => {
            const authUser = TestHelper.getUserMock({...user, auth_service: 'ldap'});
            const props = {...otherUserProps, user: authUser};
            renderWithContext(<ResetPasswordModal {...props}/>);

            expect(screen.queryByText(/send a password reset link to/i)).not.toBeInTheDocument();
        });

        test('should not show email-first content when email notifications are disabled', () => {
            const props = {...otherUserProps, canSendPasswordResetEmail: false};
            renderWithContext(<ResetPasswordModal {...props}/>);

            expect(screen.queryByText(/send a password reset link to/i)).not.toBeInTheDocument();
        });

        test('should default to email mode and show description', () => {
            renderWithContext(<ResetPasswordModal {...otherUserProps}/>);

            expect(screen.getByText(/send a password reset link to/i)).toBeInTheDocument();
            expect(screen.queryByPlaceholderText(/New password/i)).not.toBeInTheDocument();
        });

        test('should show Send email button in email mode', () => {
            renderWithContext(<ResetPasswordModal {...otherUserProps}/>);

            expect(screen.getByRole('button', {name: /Send email/i})).toBeInTheDocument();
        });

        test('should switch to manual mode when selecting the manual fallback action', async () => {
            renderWithContext(<ResetPasswordModal {...otherUserProps}/>);

            await userEvent.click(screen.getByRole('button', {name: /Set a new password manually/i}));

            expect(screen.getByPlaceholderText(/New password/i)).toBeInTheDocument();
            expect(screen.queryByText(/send a password reset link to/i)).not.toBeInTheDocument();
            expect(screen.getByRole('button', {name: /Send password reset email instead/i})).toBeInTheDocument();
        });

        test('should switch back to email mode after entering manual mode', async () => {
            renderWithContext(<ResetPasswordModal {...otherUserProps}/>);

            await userEvent.click(screen.getByRole('button', {name: /Set a new password manually/i}));
            await userEvent.click(screen.getByRole('button', {name: /Send password reset email instead/i}));

            expect(screen.getByText(/send a password reset link to/i)).toBeInTheDocument();
            expect(screen.queryByPlaceholderText(/New password/i)).not.toBeInTheDocument();
        });

        test('should call sendPasswordResetEmail in email mode', async () => {
            const sendPasswordResetEmail = jest.fn(() => Promise.resolve({data: ''}));
            const props = {...otherUserProps, actions: {...otherUserProps.actions, sendPasswordResetEmail}};
            renderWithContext(<ResetPasswordModal {...props}/>);

            await userEvent.click(screen.getByRole('button', {name: /Send email/i}));

            await waitFor(() => {
                expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
                expect(sendPasswordResetEmail).toHaveBeenCalledWith('testuser@example.com');
            });
        });

        test('should show error when sendPasswordResetEmail fails', async () => {
            const sendPasswordResetEmail = jest.fn(() => Promise.resolve({error: {message: 'SMTP not configured'}}));
            const props = {...otherUserProps, actions: {...otherUserProps.actions, sendPasswordResetEmail}};
            renderWithContext(<ResetPasswordModal {...props}/>);

            await userEvent.click(screen.getByRole('button', {name: /Send email/i}));

            await waitFor(() => {
                expect(screen.getByText(/SMTP not configured/i)).toBeInTheDocument();
            });
        });
    });
});
