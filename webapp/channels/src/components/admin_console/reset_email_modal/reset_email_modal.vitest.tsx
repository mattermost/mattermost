// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, fireEvent, waitFor} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ResetEmailModal from './reset_email_modal';

describe('components/admin_console/reset_email_modal/reset_email_modal', () => {
    const user = TestHelper.getUserMock({
        id: 'user_id',
        email: 'arvin.darmawan@gmail.com',
    });

    const baseProps = {
        actions: {patchUser: vi.fn().mockResolvedValue({})},
        user,
        currentUserId: 'random_user_id',
        onHide: vi.fn(),
        onSuccess: vi.fn(),
        onExited: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the modal title', () => {
        renderWithContext(<ResetEmailModal {...baseProps}/>);

        expect(screen.getByText('Update Email')).toBeInTheDocument();
    });

    it('renders nothing when there is no user', () => {
        const props = {...baseProps, user: undefined};
        const {container} = renderWithContext(<ResetEmailModal {...props}/>);

        expect(container.querySelector('[data-testid="resetEmailModal"]')).not.toBeInTheDocument();
    });

    it('renders email input field', () => {
        renderWithContext(<ResetEmailModal {...baseProps}/>);

        expect(screen.getByText('New Email')).toBeInTheDocument();
        expect(document.querySelector('input[type="email"]')).toBeInTheDocument();
    });

    it('shows password field when current user', () => {
        const props = {...baseProps, currentUserId: user.id};
        renderWithContext(<ResetEmailModal {...props}/>);

        expect(screen.getByText('Current Password')).toBeInTheDocument();
        expect(document.querySelector('input[type="password"]')).toBeInTheDocument();
    });

    it('does not show password field for other users', () => {
        renderWithContext(<ResetEmailModal {...baseProps}/>);

        expect(screen.queryByText('Current Password')).not.toBeInTheDocument();
        expect(document.querySelector('input[type="password"]')).not.toBeInTheDocument();
    });

    it('shows error for empty email', async () => {
        renderWithContext(<ResetEmailModal {...baseProps}/>);

        const submitButton = screen.getByRole('button', {name: 'Reset'});
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument();
        });

        expect(baseProps.actions.patchUser).not.toHaveBeenCalled();
    });

    it('shows error for invalid email', async () => {
        renderWithContext(<ResetEmailModal {...baseProps}/>);

        const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement;
        fireEvent.change(emailInput, {target: {value: 'invalid-email'}});

        const submitButton = screen.getByRole('button', {name: 'Reset'});
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument();
        });

        expect(baseProps.actions.patchUser).not.toHaveBeenCalled();
    });

    it('requires password when updating current user email', async () => {
        const props = {...baseProps, currentUserId: user.id};
        renderWithContext(<ResetEmailModal {...props}/>);

        const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement;
        fireEvent.change(emailInput, {target: {value: 'currentUser@test.com'}});

        const submitButton = screen.getByRole('button', {name: 'Reset'});
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(screen.getByText('Please enter your current password.')).toBeInTheDocument();
        });

        expect(baseProps.actions.patchUser).not.toHaveBeenCalled();
    });

    it('calls patchUser with valid email for another user', async () => {
        renderWithContext(<ResetEmailModal {...baseProps}/>);

        const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement;
        fireEvent.change(emailInput, {target: {value: 'user@test.com'}});

        const submitButton = screen.getByRole('button', {name: 'Reset'});
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(baseProps.actions.patchUser).toHaveBeenCalledTimes(1);
        });
    });

    it('calls patchUser with valid email and password for current user', async () => {
        const props = {...baseProps, currentUserId: user.id};
        renderWithContext(<ResetEmailModal {...props}/>);

        const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement;
        fireEvent.change(emailInput, {target: {value: 'currentUser@test.com'}});

        const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;
        fireEvent.change(passwordInput, {target: {value: 'password'}});

        const submitButton = screen.getByRole('button', {name: 'Reset'});
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(baseProps.actions.patchUser).toHaveBeenCalledTimes(1);
        });
    });

    it('closes modal on cancel', () => {
        renderWithContext(<ResetEmailModal {...baseProps}/>);

        const cancelButton = screen.getByRole('button', {name: 'Cancel'});
        fireEvent.click(cancelButton);

        // Modal should start closing (show state set to false)
        expect(baseProps.onExited).not.toHaveBeenCalled(); // onExited is called after animation
    });
});
