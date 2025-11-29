// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, fireEvent, waitFor} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ResetEmailModal from './reset_email_modal';

describe('components/admin_console/reset_email_modal/reset_email_modal.tsx', () => {
    const user = TestHelper.getUserMock({
        email: 'arvin.darmawan@gmail.com',
    });

    const baseProps = {
        actions: {patchUser: vi.fn(() => Promise.resolve({}))},
        user,
        currentUserId: 'random_user_id',
        onHide: vi.fn(),
        onSuccess: vi.fn(),
        onExited: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('should match snapshot when not the current user', () => {
        const {baseElement} = renderWithContext(<ResetEmailModal {...baseProps}/>);

        // Modal renders to portal, so use baseElement to capture full DOM
        expect(baseElement).toMatchSnapshot();
    });

    test('should match snapshot when there is no user', () => {
        const props = {...baseProps, user: undefined};
        const {baseElement} = renderWithContext(<ResetEmailModal {...props}/>);

        // No modal rendered when no user
        expect(baseElement).toMatchSnapshot();
    });

    test('should match snapshot when the current user', () => {
        const props = {...baseProps, currentUserId: user.id};
        const {baseElement} = renderWithContext(<ResetEmailModal {...props}/>);

        // Modal renders to portal, so use baseElement to capture full DOM
        expect(baseElement).toMatchSnapshot();
    });

    test('should not update email since the email is empty', async () => {
        renderWithContext(<ResetEmailModal {...baseProps}/>);

        const submitButton = screen.getByRole('button', {name: 'Reset'});
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
        });

        expect(baseProps.actions.patchUser).not.toHaveBeenCalled();
    });

    test('should not update email since the email is invalid', async () => {
        renderWithContext(<ResetEmailModal {...baseProps}/>);

        const emailInput = document.querySelector('input[type=\'email\']') as HTMLInputElement;
        fireEvent.change(emailInput, {target: {value: 'invalid-email'}});

        const submitButton = screen.getByRole('button', {name: 'Reset'});
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
        });

        expect(baseProps.actions.patchUser).not.toHaveBeenCalled();
    });

    test('should require password when updating email of the current user', async () => {
        const props = {...baseProps, currentUserId: user.id};
        renderWithContext(<ResetEmailModal {...props}/>);

        const emailInput = document.querySelector('input[type=\'email\']') as HTMLInputElement;
        fireEvent.change(emailInput, {target: {value: 'currentUser@test.com'}});

        const submitButton = screen.getByRole('button', {name: 'Reset'});
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(screen.getByText('Please enter your current password.')).toBeInTheDocument();
        });

        expect(baseProps.actions.patchUser).not.toHaveBeenCalled();
    });

    test('should update email since the email is valid of the another user', async () => {
        renderWithContext(<ResetEmailModal {...baseProps}/>);

        const emailInput = document.querySelector('input[type=\'email\']') as HTMLInputElement;
        fireEvent.change(emailInput, {target: {value: 'user@test.com'}});

        const submitButton = screen.getByRole('button', {name: 'Reset'});
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(baseProps.actions.patchUser).toHaveBeenCalledTimes(1);
        });
    });

    test('should update email since the email is valid of the current user', async () => {
        const props = {...baseProps, currentUserId: user.id};
        renderWithContext(<ResetEmailModal {...props}/>);

        const emailInput = document.querySelector('input[type=\'email\']') as HTMLInputElement;
        fireEvent.change(emailInput, {target: {value: 'currentUser@test.com'}});

        const passwordInput = document.querySelector('input[type=\'password\']') as HTMLInputElement;
        fireEvent.change(passwordInput, {target: {value: 'password'}});

        const submitButton = screen.getByRole('button', {name: 'Reset'});
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(baseProps.actions.patchUser).toHaveBeenCalledTimes(1);
        });
    });
});
