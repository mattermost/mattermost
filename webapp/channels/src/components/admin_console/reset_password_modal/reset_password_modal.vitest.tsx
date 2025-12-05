// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserNotifyProps} from '@mattermost/types/users';

import {renderWithContext, screen, fireEvent, waitFor} from 'tests/vitest_react_testing_utils';
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
    const user = TestHelper.getUserMock({
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

    test('should match snapshot', () => {
        const {baseElement} = renderWithContext(
            <ResetPasswordModal {...baseProps}/>,
        );

        // Modal renders to portal, so use baseElement to capture full DOM
        expect(baseElement).toMatchSnapshot();
    });

    test('should match snapshot when there is no user', () => {
        const props = {...baseProps, user: undefined};
        const {baseElement} = renderWithContext(
            <ResetPasswordModal {...props}/>,
        );

        // No modal rendered when no user
        expect(baseElement).toMatchSnapshot();
    });

    test('should call updateUserPassword', async () => {
        const updateUserPassword = vi.fn(() => Promise.resolve({data: ''}));
        const props = {...baseProps, actions: {updateUserPassword}};
        renderWithContext(<ResetPasswordModal {...props}/>);

        const currentPasswordInput = document.querySelectorAll('input[type=\'password\']')[0] as HTMLInputElement;
        const newPasswordInput = document.querySelectorAll('input[type=\'password\']')[1] as HTMLInputElement;

        fireEvent.change(currentPasswordInput, {target: {value: 'oldPassword123!'}});
        fireEvent.change(newPasswordInput, {target: {value: 'newPassword123!'}});

        const submitButton = screen.getByRole('button', {name: /reset/i});
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(updateUserPassword).toHaveBeenCalledTimes(1);
        });
    });

    test('should not call updateUserPassword when the old password is not provided', async () => {
        const updateUserPassword = vi.fn(() => Promise.resolve({data: ''}));
        const props = {...baseProps, actions: {updateUserPassword}};
        renderWithContext(<ResetPasswordModal {...props}/>);

        const newPasswordInput = document.querySelectorAll('input[type=\'password\']')[1] as HTMLInputElement;
        fireEvent.change(newPasswordInput, {target: {value: 'newPassword123!'}});

        const submitButton = screen.getByRole('button', {name: /reset/i});
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(screen.getByText('Please enter your current password.')).toBeInTheDocument();
        });

        expect(updateUserPassword).not.toHaveBeenCalled();
    });

    test('should call updateUserPassword', async () => {
        const updateUserPassword = vi.fn(() => Promise.resolve({data: ''}));
        const props = {...baseProps, currentUserId: '2', actions: {updateUserPassword}};
        renderWithContext(<ResetPasswordModal {...props}/>);

        const passwordInput = document.querySelector('input[type=\'password\']') as HTMLInputElement;
        fireEvent.change(passwordInput, {target: {value: 'Password123!'}});

        const submitButton = screen.getByRole('button', {name: /reset/i});
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(updateUserPassword).toHaveBeenCalledTimes(1);
        });
    });
});
