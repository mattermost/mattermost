// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {MobileQRLoginToken} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';

import {act, fireEvent, renderWithContext, screen} from 'tests/react_testing_utils';

import MobileQRLoginModal from './mobile_qr_login_modal';

describe('MobileQRLoginModal', () => {
    const NOW = 1_700_000_000_000;

    const makeToken = (qrCode: string, ttlSeconds: number): MobileQRLoginToken => ({
        link: `mattermost://example.com/login/mobile_qr?t=${qrCode}`,
        qr_code: qrCode,
        expires_at: Date.now() + (ttlSeconds * 1000),
    });

    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(NOW);
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    const flush = () => act(async () => {
        await jest.advanceTimersByTimeAsync(0);
    });

    test('shows a loading state, then the QR code, instructions and countdown', async () => {
        let resolve: (token: MobileQRLoginToken) => void = () => {};
        jest.spyOn(Client4, 'createMobileQRLoginToken').mockReturnValue(new Promise((r) => {
            resolve = r;
        }));

        renderWithContext(<MobileQRLoginModal/>);

        expect(screen.getByText('Generating code…')).toBeInTheDocument();
        expect(screen.queryByRole('img')).not.toBeInTheDocument();

        await act(async () => {
            resolve(makeToken('QRDATA', 90));
        });

        const image = screen.getByRole('img', {name: 'QR code to sign in to the Mattermost mobile app'});
        expect(image).toHaveAttribute('src', 'data:image/png;base64,QRDATA');
        expect(screen.getByText(/The code works once and expires in 90 seconds/)).toBeInTheDocument();
        expect(screen.getByText('Expires in 1:30')).toBeInTheDocument();
        expect(Client4.createMobileQRLoginToken).toHaveBeenCalledTimes(1);
    });

    test('counts down each second without using a live region', async () => {
        jest.spyOn(Client4, 'createMobileQRLoginToken').mockResolvedValue(makeToken('QRDATA', 90));

        renderWithContext(<MobileQRLoginModal/>);
        await flush();

        const countdown = screen.getByText('Expires in 1:30');
        expect(countdown.closest('[aria-live]')).toBeNull();
        expect(countdown.closest('[role="status"]')).toBeNull();

        await act(async () => {
            jest.advanceTimersByTime(5000);
        });

        expect(screen.getByText('Expires in 1:25')).toBeInTheDocument();
    });

    test('hides the QR code when expired and generates a new one on request', async () => {
        const createToken = jest.spyOn(Client4, 'createMobileQRLoginToken').
            mockImplementationOnce(async () => makeToken('FIRST', 60)).
            mockImplementationOnce(async () => makeToken('SECOND', 60));

        renderWithContext(<MobileQRLoginModal/>);
        await flush();

        expect(screen.getByRole('img')).toHaveAttribute('src', 'data:image/png;base64,FIRST');

        await act(async () => {
            jest.advanceTimersByTime(60_000);
        });

        expect(screen.queryByRole('img')).not.toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('This code has expired.');
        expect(screen.queryByText(/Expires in/)).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', {name: 'Generate new code'}));
        await flush();

        expect(createToken).toHaveBeenCalledTimes(2);
        expect(screen.getByRole('img')).toHaveAttribute('src', 'data:image/png;base64,SECOND');
        expect(screen.queryByText('This code has expired.')).not.toBeInTheDocument();
    });

    test('shows a session error without a retry button on 403', async () => {
        jest.spyOn(Client4, 'createMobileQRLoginToken').mockRejectedValue({
            status_code: 403,
            server_error_id: 'api.user.mobile_qr_login.session_not_allowed.app_error',
            message: 'forbidden',
        });

        renderWithContext(<MobileQRLoginModal/>);
        await flush();

        expect(screen.getByRole('alert')).toHaveTextContent("You can't create a sign-in code from this session.");
        expect(screen.queryByRole('button', {name: 'Try again'})).not.toBeInTheDocument();
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    test('shows a generic error with a retry button for other failures', async () => {
        const createToken = jest.spyOn(Client4, 'createMobileQRLoginToken').
            mockRejectedValueOnce({status_code: 500, message: 'boom'}).
            mockResolvedValueOnce(makeToken('RETRY', 90));

        renderWithContext(<MobileQRLoginModal/>);
        await flush();

        expect(screen.getByRole('alert')).toHaveTextContent("We couldn't generate a sign-in code. Try again.");

        fireEvent.click(screen.getByRole('button', {name: 'Try again'}));
        await flush();

        expect(createToken).toHaveBeenCalledTimes(2);
        expect(screen.getByRole('img')).toHaveAttribute('src', 'data:image/png;base64,RETRY');
    });

    test('clears its timer on unmount', async () => {
        jest.spyOn(Client4, 'createMobileQRLoginToken').mockResolvedValue(makeToken('QRDATA', 90));

        const setIntervalSpy = jest.spyOn(global, 'setInterval');
        const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

        const {unmount} = renderWithContext(<MobileQRLoginModal/>);
        await flush();

        expect(setIntervalSpy).toHaveBeenCalled();
        const intervalId = setIntervalSpy.mock.results[setIntervalSpy.mock.results.length - 1].value;
        expect(clearIntervalSpy).not.toHaveBeenCalledWith(intervalId);

        unmount();

        expect(clearIntervalSpy).toHaveBeenCalledWith(intervalId);
    });
});
