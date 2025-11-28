// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserNotifyProps} from '@mattermost/types/users';

import {renderWithContext, screen, fireEvent, waitFor} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ResetPasswordModal from './reset_password_modal';

describe('components/admin_console/reset_password_modal/reset_password_modal', () => {
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

    const user = TestHelper.getUserMock({
        id: 'user_id',
        auth_service: 'test',
        notify_props: notifyProps,
    });

    const baseProps = {
        actions: {updateUserPassword: vi.fn(() => Promise.resolve({data: ''}))},
        currentUserId: user.id,
        user,
        onHide: vi.fn(),
        onExited: vi.fn(),
        passwordConfig: {
            minimumLength: 10,
            requireLowercase: true,
            requireNumber: true,
            requireSymbol: true,
            requireUppercase: true,
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the modal', () => {
        renderWithContext(<ResetPasswordModal {...baseProps}/>);

        // Modal renders with password fields
        expect(screen.getByText('New Password')).toBeInTheDocument();
    });

    it('renders nothing when there is no user', () => {
        const props = {...baseProps, user: undefined};
        const {container} = renderWithContext(<ResetPasswordModal {...props}/>);

        expect(container.querySelector('[data-testid="resetPasswordModal"]')).not.toBeInTheDocument();
    });

    it('renders current password field when current user', () => {
        renderWithContext(<ResetPasswordModal {...baseProps}/>);

        expect(screen.getByText('Current Password')).toBeInTheDocument();
        expect(document.querySelectorAll('input[type="password"]')).toHaveLength(2);
    });

    it('does not render current password field for other users', () => {
        const props = {...baseProps, currentUserId: 'other_user_id'};
        renderWithContext(<ResetPasswordModal {...props}/>);

        expect(screen.queryByText('Current Password')).not.toBeInTheDocument();
        expect(document.querySelectorAll('input[type="password"]')).toHaveLength(1);
    });

    it('renders new password field', () => {
        renderWithContext(<ResetPasswordModal {...baseProps}/>);

        expect(screen.getByText('New Password')).toBeInTheDocument();
    });

    it('shows error when current password is not provided for current user', async () => {
        renderWithContext(<ResetPasswordModal {...baseProps}/>);

        const newPasswordInput = document.querySelectorAll('input[type="password"]')[1] as HTMLInputElement;
        fireEvent.change(newPasswordInput, {target: {value: 'NewPassword123!'}});

        const submitButton = screen.getByRole('button', {name: /reset/i});
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(screen.getByText('Please enter your current password.')).toBeInTheDocument();
        });

        expect(baseProps.actions.updateUserPassword).not.toHaveBeenCalled();
    });

    it('calls updateUserPassword with valid passwords for current user', async () => {
        renderWithContext(<ResetPasswordModal {...baseProps}/>);

        const currentPasswordInput = document.querySelectorAll('input[type="password"]')[0] as HTMLInputElement;
        const newPasswordInput = document.querySelectorAll('input[type="password"]')[1] as HTMLInputElement;

        fireEvent.change(currentPasswordInput, {target: {value: 'OldPassword123!'}});
        fireEvent.change(newPasswordInput, {target: {value: 'NewPassword123!'}});

        const submitButton = screen.getByRole('button', {name: /reset/i});
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(baseProps.actions.updateUserPassword).toHaveBeenCalledTimes(1);
        });
    });

    it('calls updateUserPassword for other users without current password', async () => {
        const updateUserPassword = vi.fn(() => Promise.resolve({data: ''}));
        const props = {
            ...baseProps,
            currentUserId: 'other_user_id',
            actions: {updateUserPassword},
        };
        renderWithContext(<ResetPasswordModal {...props}/>);

        const newPasswordInput = document.querySelector('input[type="password"]') as HTMLInputElement;
        fireEvent.change(newPasswordInput, {target: {value: 'NewPassword123!'}});

        const submitButton = screen.getByRole('button', {name: /reset/i});
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(updateUserPassword).toHaveBeenCalledTimes(1);
        });
    });

    it('renders cancel button', () => {
        renderWithContext(<ResetPasswordModal {...baseProps}/>);

        expect(screen.getByRole('button', {name: /cancel/i})).toBeInTheDocument();
    });

    it('closes modal on cancel click', () => {
        renderWithContext(<ResetPasswordModal {...baseProps}/>);

        const cancelButton = screen.getByRole('button', {name: /cancel/i});
        fireEvent.click(cancelButton);

        // Modal should start closing
        expect(baseProps.onExited).not.toHaveBeenCalled(); // onExited is called after animation
    });
});
