// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createMemoryHistory} from 'history';
import React from 'react';

import {isDesktopApp} from '@mattermost/shared/utils/user_agent';

import {Client4} from 'mattermost-redux/client';

import LocalStorageStore from 'stores/local_storage_store';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import PasskeyEnrollmentPage from './passkey_enrollment_page';

jest.mock('@mattermost/shared/utils/user_agent', () => ({
    isDesktopApp: jest.fn(() => false),
}));

const isDesktopAppMock = jest.mocked(isDesktopApp);

const beginResult = {
    ceremony_id: 'cer1',
    options: {
        publicKey: {
            challenge: 'AQID',
            rp: {name: 'Mattermost', id: 'example.com'},
            user: {id: 'BAUG', name: 'me', displayName: 'me'},
            pubKeyCredParams: [{type: 'public-key', alg: -7}],
        },
    },
} as never;

const rawCredential = {
    id: 'cred1',
    rawId: new Uint8Array([1, 2]).buffer,
    type: 'public-key',
    authenticatorAttachment: 'platform',
    getClientExtensionResults: () => ({}),
    response: {
        clientDataJSON: new Uint8Array([3]).buffer,
        attestationObject: new Uint8Array([4]).buffer,
        getTransports: () => ['internal'],
    },
};

const verifyBegin = {
    ceremony_id: 'ver1',
    options: {publicKey: {challenge: 'AQID', rpId: 'example.com', userVerification: 'required' as const}},
};

const assertionCredential = {
    id: 'cred2',
    rawId: new Uint8Array([1, 2]).buffer,
    type: 'public-key',
    authenticatorAttachment: 'platform',
    getClientExtensionResults: () => ({}),
    response: {
        clientDataJSON: new Uint8Array([3]).buffer,
        authenticatorData: new Uint8Array([4]).buffer,
        signature: new Uint8Array([5]).buffer,
        userHandle: new Uint8Array([6]).buffer,
    },
};

const serverError = (id: string, status: number, message = 'server text') => ({server_error_id: id, status_code: status, message});

const EXPIRED = 'This link has expired or was already used. Return to the app, sign in again and retry.';
const UNAVAILABLE = 'Passkeys aren\'t available on this server.';
const TOO_LONG = 'That took too long. Try again.';
const ON_DEVICE = 'This device already has a passkey for your account. Choose "I already have a passkey".';
const NONE_REGISTERED = 'You don\'t have a passkey for this account yet. Add one instead.';
const INVALID_CREDENTIAL = 'That passkey doesn\'t belong to your account on this server. Choose another, or add a new one.';
const CONFIRMED = 'Passkey confirmed. You can close this page and return to the app.';
const DONE = 'Passkey added. You can close this page and return to the app.';
const INCOMPLETE = 'This link is incomplete. Return to the app and try again.';
const NO_WEBAUTHN = 'This browser can\'t create passkeys. Open this page in a different browser.';
const OPEN_IN_BROWSER = 'Open this page in your web browser.';

describe('PasskeyEnrollmentPage', () => {
    let beginRegistration: jest.SpyInstance;
    let finishRegistration: jest.SpyInstance;
    let create: jest.Mock;
    let get: jest.Mock;
    let beginVerification: jest.SpyInstance;
    let finishVerification: jest.SpyInstance;

    const renderPage = (url = '/login/passkey/enroll?ticket=t1', state = {}) => {
        const history = createMemoryHistory({initialEntries: [url]});
        renderWithContext(<PasskeyEnrollmentPage/>, state, {history});
        return history;
    };
    const isEnrolled = () => !LocalStorageStore.isPasskeyPromptDue('any-login');
    const addButton = () => screen.queryByRole('button', {name: 'Add passkey'});
    const existingButton = () => screen.queryByRole('button', {name: 'I already have a passkey'});
    const clickExisting = async () => userEvent.click(await screen.findByRole('button', {name: 'I already have a passkey'}));

    beforeEach(() => {
        localStorage.clear();
        isDesktopAppMock.mockReturnValue(false);

        beginRegistration = jest.spyOn(Client4, 'beginPasskeyEnrollmentRegistration').mockResolvedValue(beginResult);
        finishRegistration = jest.spyOn(Client4, 'finishPasskeyEnrollmentRegistration').mockResolvedValue({} as never);
        beginVerification = jest.spyOn(Client4, 'beginPasskeyEnrollmentVerification').mockResolvedValue(verifyBegin);
        finishVerification = jest.spyOn(Client4, 'finishPasskeyEnrollmentVerification').mockResolvedValue({status: 'OK'});
        create = jest.fn().mockResolvedValue(rawCredential);
        get = jest.fn().mockResolvedValue(assertionCredential);
        Object.defineProperty(navigator, 'credentials', {value: {create, get}, configurable: true});
        Object.defineProperty(window, 'PublicKeyCredential', {value: Object.assign(function PublicKeyCredential() {}, {signalUnknownCredential: jest.fn().mockResolvedValue(undefined)}), configurable: true});
    });

    afterEach(() => {
        jest.restoreAllMocks();
        Reflect.deleteProperty(window, 'PublicKeyCredential');
    });

    test('shows the title and the add button, and runs nothing until the button is tapped', async () => {
        renderPage();

        expect(await screen.findByRole('heading', {name: 'Add a passkey'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Add passkey'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'I already have a passkey'})).toBeInTheDocument();
        expect(beginRegistration).not.toHaveBeenCalled();
        expect(beginVerification).not.toHaveBeenCalled();
    });

    test('adding a passkey redeems the ticket, records the enrollment and shows the done text with no buttons', async () => {
        renderPage();
        await userEvent.click(await screen.findByRole('button', {name: 'Add passkey'}));

        expect(await screen.findByText(DONE)).toBeInTheDocument();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
        expect(isEnrolled()).toBe(true);
        expect(beginVerification).not.toHaveBeenCalled();
        expect(beginRegistration).toHaveBeenCalledWith('t1');
        expect(finishRegistration).toHaveBeenCalledWith('cer1', '', expect.objectContaining({id: 'cred1'}));
    });

    test('a signed-out visitor stays on the page', async () => {
        const history = renderPage('/login/passkey/enroll?ticket=t1', {entities: {users: {currentUserId: ''}}});

        expect(await screen.findByRole('button', {name: 'Add passkey'})).toBeInTheDocument();
        expect(history.location.pathname).toBe('/login/passkey/enroll');
    });

    test('a missing ticket shows the incomplete-link text and no button', async () => {
        renderPage('/login/passkey/enroll');

        expect(await screen.findByText(INCOMPLETE)).toBeInTheDocument();
        expect(addButton()).not.toBeInTheDocument();
        expect(existingButton()).not.toBeInTheDocument();
    });

    test('an empty ticket shows the incomplete-link text and no button', async () => {
        renderPage('/login/passkey/enroll?ticket=');

        expect(await screen.findByText(INCOMPLETE)).toBeInTheDocument();
        expect(addButton()).not.toBeInTheDocument();
        expect(existingButton()).not.toBeInTheDocument();
    });

    test('a browser without WebAuthn gets the cannot-create text and no button', async () => {
        Reflect.deleteProperty(window, 'PublicKeyCredential');
        renderPage();

        expect(await screen.findByText(NO_WEBAUTHN)).toBeInTheDocument();
        expect(addButton()).not.toBeInTheDocument();
        expect(existingButton()).not.toBeInTheDocument();
    });

    test('the desktop app is told to open the page in a browser and gets no button', async () => {
        isDesktopAppMock.mockReturnValue(true);
        renderPage();

        expect(await screen.findByText(OPEN_IN_BROWSER)).toBeInTheDocument();
        expect(addButton()).not.toBeInTheDocument();
        expect(existingButton()).not.toBeInTheDocument();
    });

    test.each([
        ['ticket_invalid', 400, 'app.passkey.ticket_invalid.app_error', EXPIRED],
        ['recent_login_required', 403, 'app.passkey.recent_login_required.app_error', EXPIRED],
        ['a disabled feature', 501, 'app.passkey.not_enabled.app_error', UNAVAILABLE],
    ])('begin refused with %s ends the page with an alert and no button', async (_name, status, id, text) => {
        beginRegistration.mockRejectedValue(serverError(id, status));
        renderPage();
        await userEvent.click(await screen.findByRole('button', {name: 'Add passkey'}));

        expect(await screen.findByRole('alert')).toHaveTextContent(text);
        expect(addButton()).not.toBeInTheDocument();
        expect(existingButton()).not.toBeInTheDocument();
        expect(isEnrolled()).toBe(false);
    });

    test('an expired ceremony says so and keeps the button', async () => {
        finishRegistration.mockRejectedValue(serverError('app.passkey.ceremony_invalid.app_error', 400));
        renderPage();
        await userEvent.click(await screen.findByRole('button', {name: 'Add passkey'}));

        expect(await screen.findByRole('alert')).toHaveTextContent(TOO_LONG);
        expect(addButton()).toBeInTheDocument();
    });

    test('a device that already holds the passkey says so and keeps the button', async () => {
        create.mockRejectedValue(new DOMException('x', 'InvalidStateError'));
        renderPage();
        await userEvent.click(await screen.findByRole('button', {name: 'Add passkey'}));

        expect(await screen.findByRole('alert')).toHaveTextContent(ON_DEVICE);
        expect(addButton()).toBeInTheDocument();
    });

    test('any other error shows the server message and keeps the button', async () => {
        finishRegistration.mockRejectedValue(serverError('app.passkey.limit_reached.app_error', 400, 'limit hit'));
        renderPage();
        await userEvent.click(await screen.findByRole('button', {name: 'Add passkey'}));

        expect(await screen.findByRole('alert')).toHaveTextContent('limit hit');
        expect(addButton()).toBeInTheDocument();
    });

    test('dismissing the browser prompt shows no error, keeps the button and allows another try', async () => {
        create.mockRejectedValueOnce(new DOMException('x', 'NotAllowedError'));
        renderPage();
        await userEvent.click(await screen.findByRole('button', {name: 'Add passkey'}));

        await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(addButton()).toBeEnabled());
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(isEnrolled()).toBe(false);

        await userEvent.click(screen.getByRole('button', {name: 'Add passkey'}));
        expect(await screen.findByText(DONE)).toBeInTheDocument();
        expect(beginRegistration).toHaveBeenLastCalledWith('t1');
    });

    describe('I already have a passkey', () => {
        test('verifies the ticket user\'s passkey, records the enrollment and shows the confirmed text with no buttons', async () => {
            renderPage();
            await clickExisting();

            expect(await screen.findByText(CONFIRMED)).toBeInTheDocument();
            expect(screen.queryByRole('button')).not.toBeInTheDocument();
            expect(isEnrolled()).toBe(true);
            expect(beginVerification).toHaveBeenCalledWith('t1');
            expect(finishVerification).toHaveBeenCalledWith('ver1', expect.objectContaining({id: 'cred2'}));
            expect(beginRegistration).not.toHaveBeenCalled();
        });

        test('dismissing the browser prompt shows no error and keeps both buttons', async () => {
            get.mockRejectedValueOnce(new DOMException('x', 'NotAllowedError'));
            renderPage();
            await clickExisting();

            await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
            await waitFor(() => expect(existingButton()).toBeEnabled());
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
            expect(addButton()).toBeEnabled();
            expect(isEnrolled()).toBe(false);
        });

        test.each([
            ['begin refuses an account with no passkey', 'begin', 'app.passkey.none_registered.app_error', 400, NONE_REGISTERED],
            ['finish refuses a passkey of another account', 'finish', 'app.passkey.invalid_credential.app_error', 401, INVALID_CREDENTIAL],
            ['the ceremony expired', 'finish', 'app.passkey.ceremony_invalid.app_error', 400, TOO_LONG],
            ['any other error', 'finish', 'app.passkey.rate_limited.app_error', 429, 'server text'],
        ])('%s: shows the message and keeps both buttons', async (_name, stage, id, status, text) => {
            (stage === 'begin' ? beginVerification : finishVerification).mockRejectedValue(serverError(id, status));
            renderPage();
            await clickExisting();

            expect(await screen.findByRole('alert')).toHaveTextContent(text);
            expect(addButton()).toBeEnabled();
            expect(existingButton()).toBeEnabled();
            expect(isEnrolled()).toBe(false);
        });

        test('an invalid ticket ends the page with the expired text and no buttons', async () => {
            beginVerification.mockRejectedValue(serverError('app.passkey.ticket_invalid.app_error', 400));
            renderPage();
            await clickExisting();

            expect(await screen.findByRole('alert')).toHaveTextContent(EXPIRED);
            expect(addButton()).not.toBeInTheDocument();
            expect(existingButton()).not.toBeInTheDocument();
        });

        test('a disabled feature ends the page with the unavailable text and no buttons', async () => {
            beginVerification.mockRejectedValue(serverError('app.passkey.not_enabled.app_error', 501));
            renderPage();
            await clickExisting();

            expect(await screen.findByRole('alert')).toHaveTextContent(UNAVAILABLE);
            expect(addButton()).not.toBeInTheDocument();
            expect(existingButton()).not.toBeInTheDocument();
        });

        test('a cancelled add leaves the ticket usable for a successful verification', async () => {
            create.mockRejectedValueOnce(new DOMException('x', 'NotAllowedError'));
            renderPage();
            await userEvent.click(await screen.findByRole('button', {name: 'Add passkey'}));
            await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
            await waitFor(() => expect(existingButton()).toBeEnabled());

            await clickExisting();

            expect(await screen.findByText(CONFIRMED)).toBeInTheDocument();
            expect(beginVerification).toHaveBeenCalledWith('t1');
        });

        test('a device that already holds the passkey is pointed at this button, which then works', async () => {
            create.mockRejectedValue(new DOMException('x', 'InvalidStateError'));
            renderPage();
            await userEvent.click(await screen.findByRole('button', {name: 'Add passkey'}));
            expect(await screen.findByRole('alert')).toHaveTextContent(ON_DEVICE);

            await clickExisting();

            expect(await screen.findByText(CONFIRMED)).toBeInTheDocument();
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });

        test('both buttons are disabled while a verification runs, and while an add runs', async () => {
            let release: (v: unknown) => void = () => {};
            get.mockReturnValueOnce(new Promise((resolve) => {
                release = resolve;
            }));
            renderPage();
            await clickExisting();

            await waitFor(() => expect(addButton()).toBeDisabled());
            expect(existingButton()).toBeDisabled();
            release(assertionCredential);
            expect(await screen.findByText(CONFIRMED)).toBeInTheDocument();
        });

        test('the add button disables the verify button while it runs', async () => {
            let release: (v: unknown) => void = () => {};
            create.mockReturnValueOnce(new Promise((resolve) => {
                release = resolve;
            }));
            renderPage();
            await userEvent.click(await screen.findByRole('button', {name: 'Add passkey'}));

            await waitFor(() => expect(existingButton()).toBeDisabled());
            expect(addButton()).toBeDisabled();
            release(rawCredential);
            expect(await screen.findByText(DONE)).toBeInTheDocument();
        });
    });
});
