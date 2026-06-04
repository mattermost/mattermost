// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createMemoryHistory} from 'history';
import React from 'react';

import {sendVerificationEmail} from 'mattermost-redux/actions/users';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import ShouldVerifyEmail from './should_verify_email';

jest.mock('mattermost-redux/actions/users', () => ({
    sendVerificationEmail: jest.fn(),
}));

const mockedSendVerificationEmail = jest.mocked(sendVerificationEmail);
const historyPush = jest.fn();
const OK_RESPONSE = {status: 'OK'} as const;

type GlobalWithHistoryMock = typeof globalThis & {
    historyMock: {
        push: jest.Mock;
    };
};

const getHistoryMock = () => (globalThis as GlobalWithHistoryMock).historyMock;

describe('components/ShouldVerifyEmail', () => {
    beforeEach(() => {
        mockedSendVerificationEmail.mockReset();
        mockedSendVerificationEmail.mockReturnValue(async () => ({data: OK_RESPONSE}));
        historyPush.mockReset();
        getHistoryMock().push = historyPush;
    });

    const renderComponent = (url = '/should_verify_email?email=test%40example.com') => {
        const history = createMemoryHistory({initialEntries: [url]});

        return renderWithContext(<ShouldVerifyEmail/>, {}, {history});
    };

    test('shows the verification prompt and returns to login', async () => {
        renderComponent();

        expect(screen.getByText('You’re almost done!')).toBeVisible();
        expect(screen.getByText('Please verify your email address. Check your inbox for an email.')).toBeVisible();

        await userEvent.click(screen.getByRole('button', {name: 'Return to log in'}));

        expect(historyPush).toHaveBeenCalledWith('/');
    });

    test('resends the verification email and disables the button while sending', async () => {
        let resolveResend: (result: {data: typeof OK_RESPONSE}) => void;
        const resendPromise = new Promise<{data: typeof OK_RESPONSE}>((resolve) => {
            resolveResend = resolve;
        });
        mockedSendVerificationEmail.mockReturnValueOnce(async () => resendPromise);

        renderComponent();

        const resendButton = screen.getByRole('button', {name: 'Resend Email'});
        expect(resendButton).not.toBeDisabled();

        await userEvent.click(resendButton);

        expect(mockedSendVerificationEmail).toHaveBeenCalledWith('test@example.com');
        expect(screen.getByRole('button', {name: /Sending email/})).toBeDisabled();

        resolveResend!({data: OK_RESPONSE});

        await waitFor(() => {
            expect(screen.getByText('Verification email sent')).toBeVisible();
        });
        expect(screen.getByRole('button', {name: 'Resend Email'})).not.toBeDisabled();
    });

    test('shows an error when resending the verification email fails', async () => {
        mockedSendVerificationEmail.mockReturnValueOnce(async () => ({error: {message: 'Unable to send'}}));

        renderComponent();

        await userEvent.click(screen.getByRole('button', {name: 'Resend Email'}));

        expect(mockedSendVerificationEmail).toHaveBeenCalledWith('test@example.com');
        expect(await screen.findByText('Failed to send verification email')).toBeVisible();
        expect(screen.getByRole('button', {name: 'Resend Email'})).not.toBeDisabled();
    });

    test('clears the previous resend status while retrying', async () => {
        let resolveRetry: (result: {data: typeof OK_RESPONSE}) => void;
        const retryPromise = new Promise<{data: typeof OK_RESPONSE}>((resolve) => {
            resolveRetry = resolve;
        });
        mockedSendVerificationEmail.
            mockReturnValueOnce(async () => ({data: OK_RESPONSE})).
            mockReturnValueOnce(async () => retryPromise);

        renderComponent();

        await userEvent.click(screen.getByRole('button', {name: 'Resend Email'}));

        expect(await screen.findByText('Verification email sent')).toBeVisible();

        await userEvent.click(screen.getByRole('button', {name: 'Resend Email'}));

        expect(screen.queryByText('Verification email sent')).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: /Sending email/})).toBeDisabled();

        resolveRetry!({data: OK_RESPONSE});

        expect(await screen.findByText('Verification email sent')).toBeVisible();
    });

    test('disables the resend button when no email is provided', async () => {
        renderComponent('/should_verify_email');

        const resendButton = screen.getByRole('button', {name: 'Resend Email'});
        expect(resendButton).toBeDisabled();

        await userEvent.click(resendButton);

        expect(mockedSendVerificationEmail).not.toHaveBeenCalled();
    });
});
