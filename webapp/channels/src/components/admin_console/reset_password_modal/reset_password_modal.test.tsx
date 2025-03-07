// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type {UserNotifyProps, UserProfile} from '@mattermost/types/users';

import {renderWithContext} from 'tests/react_testing_utils';
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
        auth_service: 'test',
        notify_props: notifyProps,
    });

    const baseProps = {
        actions: {updateUserPassword: jest.fn(() => Promise.resolve({data: ''}))},
        currentUserId: user.id,
        user,
        onHide: jest.fn(),
        onExited: jest.fn(),
        passwordConfig: {
            minimumLength: 10,
            requireLowercase: true,
            requireNumber: true,
            requireSymbol: true,
            requireUppercase: true,
        },
    };

    test('should render correctly', () => {
        renderWithContext(<ResetPasswordModal {...baseProps}/>);
        
        expect(screen.getByText('Switch Account to Email/Password')).toBeInTheDocument();
        expect(screen.getByText('Current Password')).toBeInTheDocument();
        expect(screen.getByText('New Password')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Reset'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
    });

    test('should render empty div when there is no user', () => {
        const props = {...baseProps, user: undefined};
        const {container} = renderWithContext(<ResetPasswordModal {...props}/>);
        
        expect(container.firstChild).toBeEmptyDOMElement();
    });

    test('should call updateUserPassword on form submission', async () => {
        const updateUserPassword = jest.fn(() => Promise.resolve({data: ''}));
        const oldPassword = 'oldPassword123!';
        const newPassword = 'newPassword123!';
        const props = {...baseProps, actions: {updateUserPassword}};
        
        renderWithContext(<ResetPasswordModal {...props}/>);

        const currentPasswordInput = screen.getByText('Current Password').closest('.input-group')?.querySelector('input');
        const newPasswordInput = screen.getByText('New Password').closest('.input-group')?.querySelector('input');
        
        expect(currentPasswordInput).toBeInTheDocument();
        expect(newPasswordInput).toBeInTheDocument();
        
        await userEvent.type(currentPasswordInput!, oldPassword);
        await userEvent.type(newPasswordInput!, newPassword);
        await userEvent.click(screen.getByRole('button', {name: 'Reset'}));

        expect(updateUserPassword).toHaveBeenCalledTimes(1);
        expect(updateUserPassword).toHaveBeenCalledWith(user.id, oldPassword, newPassword);
    });

    test('should show error when current password is not provided', async () => {
        const updateUserPassword = jest.fn(() => Promise.resolve({data: ''}));
        const newPassword = 'newPassword123!';
        const props = {...baseProps, actions: {updateUserPassword}};
        
        renderWithContext(<ResetPasswordModal {...props}/>);

        const newPasswordInput = screen.getByText('New Password').closest('.input-group')?.querySelector('input');
        expect(newPasswordInput).toBeInTheDocument();
        
        await userEvent.type(newPasswordInput!, newPassword);
        await userEvent.click(screen.getByRole('button', {name: 'Reset'}));

        expect(updateUserPassword).not.toHaveBeenCalled();
        await waitFor(() => {
            expect(screen.getByText('Please enter your current password.')).toBeInTheDocument();
        });
    });

    test('should call updateUserPassword when resetting other user password', async () => {
        const updateUserPassword = jest.fn(() => Promise.resolve({data: ''}));
        const password = 'Password123!';

        const props = {...baseProps, currentUserId: '2', actions: {updateUserPassword}};
        renderWithContext(<ResetPasswordModal {...props}/>);

        // When currentUserId !== user.id, there should be only one password field
        const passwordInput = screen.getByText('New Password').closest('.input-group')?.querySelector('input');
        expect(passwordInput).toBeInTheDocument();
        
        await userEvent.type(passwordInput!, password);
        await userEvent.click(screen.getByRole('button', {name: 'Reset'}));

        expect(updateUserPassword).toHaveBeenCalledTimes(1);
        expect(updateUserPassword).toHaveBeenCalledWith(user.id, '', password);
    });
});
