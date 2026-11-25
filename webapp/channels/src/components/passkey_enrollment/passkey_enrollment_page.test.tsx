// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createMemoryHistory} from 'history';
import React from 'react';

import {isDesktopApp} from '@mattermost/shared/utils/user_agent';

import {Client4} from 'mattermost-redux/client';

import LocalStorageStore from 'stores/local_storage_store';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import PasskeyEnrollmentPage from './passkey_enrollment_page';

// The global setup mocks useHistory; these tests assert on the real history.
jest.mock('react-router-dom', () => jest.requireActual('react-router-dom'));

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
            user: {id: 'BAUG', name: 'alice', displayName: 'alice'},
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
const ON_DEVICE = 'This device already has a passkey for your account. Choose "Use existing passkey".';
const NONE_REGISTERED = 'You don\'t have a passkey for this account yet. Add one instead.';
const INVALID_CREDENTIAL = 'That passkey doesn\'t belong to your account on this server. Choose another, or add a new one.';
const RETURN_TO_APP = 'You can close this page and return to the app.';
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

    const renderPage = (url = '/login/passkey/enroll#ticket=t1', state = {}) => {
        const history = createMemoryHistory({initialEntries: [url]});
        renderWithContext(<PasskeyEnrollmentPage/>, state, {history});
        return history;
    };
    const isEnrolled = () => !LocalStorageStore.isPasskeyPromptDue('u1', 'any-login');
    const addButton = () => screen.queryByRole('button', {name: 'Add passkey'});
    const existingButton = () => screen.queryByRole('button', {name: 'Use existing passkey'});

    // compass Button renders its spinner in an aria-hidden slot; it sets no aria-busy outside asChild.
    const hasSpinner = (button: HTMLElement | null) => Boolean(button?.querySelector('[aria-hidden="true"]'));
    const cantAddHeading = () => screen.findByRole('heading', {name: 'Can\'t add a passkey here'});
    const clickExisting = async () => userEvent.click(await screen.findByRole('button', {name: 'Use existing passkey'}));

    beforeEach(() => {
        localStorage.clear();
        isDesktopAppMock.mockReturnValue(false);

        beginRegistration = jest.spyOn(Client4, 'beginPasskeyEnrollmentRegistration').mockResolvedValue(beginResult);
        finishRegistration = jest.spyOn(Client4, 'finishPasskeyEnrollmentRegistration').mockResolvedValue({user_id: 'u1'} as never);
        beginVerification = jest.spyOn(Client4, 'beginPasskeyEnrollmentVerification').mockResolvedValue(verifyBegin);
        finishVerification = jest.spyOn(Client4, 'finishPasskeyEnrollmentVerification').mockResolvedValue({user_id: 'u1'});
        create = jest.fn().mockResolvedValue(rawCredential);
        get = jest.fn().mockResolvedValue(assertionCredential);
        Object.defineProperty(navigator, 'credentials', {value: {create, get}, configurable: true});
        Object.defineProperty(window, 'PublicKeyCredential', {value: Object.assign(function PublicKeyCredential() {}, {signalUnknownCredential: jest.fn().mockResolvedValue(undefined)}), configurable: true});
    });

    afterEach(() => {
        jest.restoreAllMocks();
        Reflect.deleteProperty(window, 'PublicKeyCredential');
    });

    test('names the account from the server\'s answer before either button appears, and add begins a fresh ceremony', async () => {
        let release: (v: unknown) => void = () => {};
        beginRegistration.mockReturnValueOnce(new Promise((resolve) => {
            release = resolve;
        }));
        renderPage();

        expect(await screen.findByRole('heading', {name: 'Add a passkey'})).toBeInTheDocument();
        expect(addButton()).not.toBeInTheDocument();
        expect(existingButton()).not.toBeInTheDocument();
        expect(screen.getByRole('status')).not.toHaveTextContent('alice');

        release(beginResult);
        expect(await screen.findByText('alice')).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('This adds a passkey to the account alice. If that isn\'t your account, close this page.');
        expect(addButton()).toBeInTheDocument();
        expect(existingButton()).toBeInTheDocument();
        expect(beginRegistration).toHaveBeenCalledTimes(1);
        expect(beginVerification).not.toHaveBeenCalled();

        await userEvent.click(addButton()!);
        expect(await screen.findByText(RETURN_TO_APP)).toBeInTheDocument();
        expect(beginRegistration).toHaveBeenCalledTimes(2);
    });

    test('a non-final error at load shows the banner with both buttons and no account line', async () => {
        beginRegistration.mockRejectedValueOnce(serverError('app.passkey.limit_reached.app_error', 400, 'limit hit'));
        renderPage();

        expect(await screen.findByRole('alert')).toHaveTextContent('limit hit');
        expect(addButton()).toBeEnabled();
        expect(existingButton()).toBeEnabled();
        expect(screen.getByRole('status')).not.toHaveTextContent('This adds a passkey');
    });

    test('adding a passkey redeems the ticket, records the enrollment and shows the done text with no buttons', async () => {
        renderPage();
        await userEvent.click(await screen.findByRole('button', {name: 'Add passkey'}));

        expect(await screen.findByText(RETURN_TO_APP)).toBeInTheDocument();
        expect(screen.getByRole('heading', {name: 'Passkey added'})).toBeInTheDocument();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
        expect(isEnrolled()).toBe(true);
        expect(LocalStorageStore.isPasskeyPromptDue('u2', 'any-login')).toBe(true);
        expect(beginVerification).not.toHaveBeenCalled();
        expect(beginRegistration).toHaveBeenCalledWith('t1');
        expect(finishRegistration).toHaveBeenCalledWith('cer1', '', expect.objectContaining({id: 'cred1'}));
    });

    test('the error and both buttons share one container, and the error is a danger banner', async () => {
        finishRegistration.mockRejectedValue(serverError('app.passkey.ceremony_invalid.app_error', 400));
        renderPage();
        await userEvent.click(await screen.findByRole('button', {name: 'Add passkey'}));

        const alert = await screen.findByRole('alert');
        const actions = alert.closest('.PasskeyEnrollmentPage__actions');
        expect(actions).not.toBeNull();
        expect(actions).toContainElement(screen.getByRole('button', {name: 'Add passkey'}));
        expect(actions).toContainElement(screen.getByRole('button', {name: 'Use existing passkey'}));
        expect(alert.querySelector('.AlertBanner.danger')).not.toBeNull();
    });

    test('removes the ticket from the address bar but keeps using it', async () => {
        const history = renderPage('/login/passkey/enroll?x=1#ticket=abc');

        expect(history.location.hash).toBe('');
        expect(history.location.pathname).toBe('/login/passkey/enroll');
        expect(history.location.search).toBe('?x=1');
        await userEvent.click(await screen.findByRole('button', {name: 'Add passkey'}));
        expect(await screen.findByText(RETURN_TO_APP)).toBeInTheDocument();
        expect(beginRegistration).toHaveBeenCalledWith('abc');
    });

    test('an empty ticket is still removed from the address bar', async () => {
        const history = renderPage('/login/passkey/enroll#ticket=');

        expect(await screen.findByText(INCOMPLETE)).toBeInTheDocument();
        expect(history.location.hash).toBe('');
    });

    test('the status element is there before any action and announces an added passkey', async () => {
        renderPage();
        const status = await screen.findByRole('status');
        expect(status).toHaveTextContent('Sign in with your fingerprint');
        await userEvent.click(screen.getByRole('button', {name: 'Add passkey'}));

        await screen.findByText(RETURN_TO_APP);
        expect(screen.getByRole('status')).toBe(status);
        expect(status).toHaveTextContent(`Passkey added. ${RETURN_TO_APP}`);
    });

    test('the status element announces a confirmed passkey', async () => {
        renderPage();
        const status = await screen.findByRole('status');
        await clickExisting();

        await screen.findByText(RETURN_TO_APP);
        expect(screen.getByRole('status')).toBe(status);
        expect(status).toHaveTextContent(`Passkey confirmed. ${RETURN_TO_APP}`);
    });

    test('a signed-out visitor stays on the page', async () => {
        const history = renderPage('/login/passkey/enroll#ticket=t1', {entities: {users: {currentUserId: ''}}});

        expect(await screen.findByRole('button', {name: 'Add passkey'})).toBeInTheDocument();
        expect(history.location.pathname).toBe('/login/passkey/enroll');
    });

    test('a missing ticket shows the incomplete-link text and no button', async () => {
        renderPage('/login/passkey/enroll');

        expect(await screen.findByText(INCOMPLETE)).toBeInTheDocument();
        expect(await cantAddHeading()).toBeInTheDocument();
        expect(addButton()).not.toBeInTheDocument();
        expect(existingButton()).not.toBeInTheDocument();
        expect(beginRegistration).not.toHaveBeenCalled();
    });

    test('a ticket in the query string is not read: shows the incomplete-link text and no button', async () => {
        renderPage('/login/passkey/enroll?ticket=t1');

        expect(await screen.findByText(INCOMPLETE)).toBeInTheDocument();
        expect(await cantAddHeading()).toBeInTheDocument();
        expect(addButton()).not.toBeInTheDocument();
        expect(existingButton()).not.toBeInTheDocument();
        expect(beginRegistration).not.toHaveBeenCalled();
    });

    test('an empty ticket shows the incomplete-link text and no button', async () => {
        renderPage('/login/passkey/enroll#ticket=');

        expect(await screen.findByText(INCOMPLETE)).toBeInTheDocument();
        expect(await cantAddHeading()).toBeInTheDocument();
        expect(addButton()).not.toBeInTheDocument();
        expect(existingButton()).not.toBeInTheDocument();
        expect(beginRegistration).not.toHaveBeenCalled();
    });

    test('a browser without WebAuthn gets the cannot-create text and no button', async () => {
        Reflect.deleteProperty(window, 'PublicKeyCredential');
        renderPage();

        expect(await screen.findByText(NO_WEBAUTHN)).toBeInTheDocument();
        expect(await cantAddHeading()).toBeInTheDocument();
        expect(addButton()).not.toBeInTheDocument();
        expect(existingButton()).not.toBeInTheDocument();
        expect(beginRegistration).not.toHaveBeenCalled();
    });

    test('the desktop app is told to open the page in a browser and gets no button', async () => {
        isDesktopAppMock.mockReturnValue(true);
        renderPage();

        expect(await screen.findByText(OPEN_IN_BROWSER)).toBeInTheDocument();
        expect(await cantAddHeading()).toBeInTheDocument();
        expect(addButton()).not.toBeInTheDocument();
        expect(existingButton()).not.toBeInTheDocument();
        expect(beginRegistration).not.toHaveBeenCalled();
    });

    test.each([
        ['ticket_invalid', 400, 'app.passkey.ticket_invalid.app_error', EXPIRED],
        ['recent_login_required', 403, 'app.passkey.recent_login_required.app_error', EXPIRED],
        ['a disabled feature', 501, 'app.passkey.not_enabled.app_error', UNAVAILABLE],
    ])('begin refused at load with %s ends the page with an alert and no button, without a click', async (_name, status, id, text) => {
        beginRegistration.mockRejectedValue(serverError(id, status));
        renderPage();

        expect(await screen.findByRole('alert')).toHaveTextContent(text);
        expect(document.querySelector('.AlertBanner')).toBeNull();
        expect(await cantAddHeading()).toBeInTheDocument();
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

    test.each([
        'app.passkey.invalid_credential.app_error',
        'app.passkey.none_registered.app_error',
    ])('an add refused with %s shows the server message, not the verify wording', async (id) => {
        finishRegistration.mockRejectedValue(serverError(id, 400, 'bad attestation'));
        renderPage();
        await userEvent.click(await screen.findByRole('button', {name: 'Add passkey'}));

        expect(await screen.findByRole('alert')).toHaveTextContent('bad attestation');
        expect(addButton()).toBeEnabled();
        expect(existingButton()).toBeEnabled();
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
        expect(await screen.findByText(RETURN_TO_APP)).toBeInTheDocument();
        expect(beginRegistration).toHaveBeenLastCalledWith('t1');
    });

    describe('Use existing passkey', () => {
        test('verifies the ticket user\'s passkey, records the enrollment and shows the confirmed text with no buttons', async () => {
            renderPage();
            await clickExisting();

            expect(await screen.findByText(RETURN_TO_APP)).toBeInTheDocument();
            expect(screen.getByRole('heading', {name: 'Passkey confirmed'})).toBeInTheDocument();
            expect(screen.queryByRole('button')).not.toBeInTheDocument();
            expect(isEnrolled()).toBe(true);
            expect(LocalStorageStore.isPasskeyPromptDue('u2', 'any-login')).toBe(true);
            expect(beginVerification).toHaveBeenCalledWith('t1');
            expect(finishVerification).toHaveBeenCalledWith('ver1', expect.objectContaining({id: 'cred2'}));
            expect(beginRegistration).toHaveBeenCalledTimes(1);
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
            expect(await cantAddHeading()).toBeInTheDocument();
            expect(addButton()).not.toBeInTheDocument();
            expect(existingButton()).not.toBeInTheDocument();
        });

        test('a disabled feature ends the page with the unavailable text and no buttons', async () => {
            beginVerification.mockRejectedValue(serverError('app.passkey.not_enabled.app_error', 501));
            renderPage();
            await clickExisting();

            expect(await screen.findByRole('alert')).toHaveTextContent(UNAVAILABLE);
            expect(await cantAddHeading()).toBeInTheDocument();
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

            expect(await screen.findByText(RETURN_TO_APP)).toBeInTheDocument();
            expect(beginVerification).toHaveBeenCalledWith('t1');
        });

        test('a device that already holds the passkey is pointed at this button, which then works', async () => {
            create.mockRejectedValue(new DOMException('x', 'InvalidStateError'));
            renderPage();
            await userEvent.click(await screen.findByRole('button', {name: 'Add passkey'}));
            expect(await screen.findByRole('alert')).toHaveTextContent(ON_DEVICE);

            await clickExisting();

            expect(await screen.findByText(RETURN_TO_APP)).toBeInTheDocument();
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
            expect(hasSpinner(existingButton())).toBe(true);
            expect(hasSpinner(addButton())).toBe(false);
            release(assertionCredential);
            expect(await screen.findByText(RETURN_TO_APP)).toBeInTheDocument();
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
            expect(hasSpinner(addButton())).toBe(true);
            expect(hasSpinner(existingButton())).toBe(false);
            release(rawCredential);
            expect(await screen.findByText(RETURN_TO_APP)).toBeInTheDocument();
        });
    });
});
