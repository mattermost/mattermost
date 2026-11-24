// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {isDesktopApp} from '@mattermost/shared/utils/user_agent';

import {Client4} from 'mattermost-redux/client';

import LocalStorageStore from 'stores/local_storage_store';

import {fireEvent, renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import PasskeyEnrollmentPrompt from './passkey_enrollment_prompt';

jest.mock('@mattermost/shared/utils/user_agent', () => ({
    isDesktopApp: jest.fn(() => false),
}));

const isDesktopAppMock = jest.mocked(isDesktopApp);

const stateWith = (enabled: 'true' | 'false') => ({
    entities: {general: {config: {PasskeyEnrollmentEnabled: enabled}}},
});

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

const domError = (name: string) => new DOMException('x', name);

const expireCookie = (name: string) => {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
};

const RECENT_LOGIN_TEXT = 'For your security, sign out and sign back in, then add your passkey within 10 minutes.';

describe('PasskeyEnrollmentPrompt', () => {
    let beginRegistration: jest.SpyInstance;
    let finishRegistration: jest.SpyInstance;
    let create: jest.Mock;

    const renderPrompt = (enabled: 'true' | 'false' = 'true') => renderWithContext(<PasskeyEnrollmentPrompt/>, stateWith(enabled));

    beforeEach(() => {
        localStorage.clear();
        expireCookie('MMLOGINMETHOD');
        document.cookie = 'MMCSRF=tok1';
        isDesktopAppMock.mockReturnValue(false);

        beginRegistration = jest.spyOn(Client4, 'beginPasskeyRegistration').mockResolvedValue(beginResult);
        finishRegistration = jest.spyOn(Client4, 'finishPasskeyRegistration').mockResolvedValue({} as never);
        create = jest.fn().mockResolvedValue(rawCredential);
        Object.defineProperty(navigator, 'credentials', {value: {create}, configurable: true});

        // jsdom has no WebAuthn; the prompt stays hidden without it.
        Object.defineProperty(window, 'PublicKeyCredential', {value: Object.assign(function PublicKeyCredential() {}, {signalUnknownCredential: jest.fn().mockResolvedValue(undefined)}), configurable: true});
    });

    afterEach(() => {
        jest.restoreAllMocks();
        Reflect.deleteProperty(window, 'PublicKeyCredential');
        expireCookie('MMCSRF');
        expireCookie('MMLOGINMETHOD');
    });

    test('is shown when every condition holds', async () => {
        renderPrompt();

        expect(await screen.findByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Add a passkey')).toBeInTheDocument();
        expect(screen.getByText('Sign in with your fingerprint, face or screen lock. A passkey also lets you sign in if your usual sign-in method is unavailable.')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Add passkey'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Not now'})).toBeInTheDocument();
    });

    test.each([
        ['enrollment is off', () => 'false' as const],
        ['inside the desktop app', () => {
            isDesktopAppMock.mockReturnValue(true);
        }],
        ['the browser has no WebAuthn', () => {
            Reflect.deleteProperty(window, 'PublicKeyCredential');
        }],
        ['the session was started by a passkey', () => {
            document.cookie = 'MMLOGINMETHOD=passkey';
        }],
        ['this browser already has a passkey', () => {
            LocalStorageStore.setPasskeyEnrolled();
        }],
        ['the prompt was skipped for this login', () => {
            LocalStorageStore.setPasskeyPromptSkipped('tok1');
        }],
        ['there is no CSRF cookie', () => {
            expireCookie('MMCSRF');
        }],
    ])('renders nothing when %s', async (_name, arrange) => {
        const enabled = arrange() ?? 'true';
        const {container} = renderPrompt(enabled);

        // Give a wrongly-opened dialog the time it needs to appear.
        await new Promise((r) => setTimeout(r, 50));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(container).toBeEmptyDOMElement();
    });

    test('is shown again after a skip recorded for an older login', async () => {
        LocalStorageStore.setPasskeyPromptSkipped('older');
        renderPrompt();

        expect(await screen.findByRole('dialog')).toBeInTheDocument();
    });

    test('Not now closes the prompt and skips it for this login', async () => {
        renderPrompt();
        await screen.findByRole('dialog');

        await userEvent.click(screen.getByRole('button', {name: 'Not now'}));

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(LocalStorageStore.isPasskeyPromptDue('tok1')).toBe(false);
        expect(LocalStorageStore.isPasskeyPromptDue('tok2')).toBe(true);
    });

    test('the close button skips the prompt for this login', async () => {
        renderPrompt();
        await screen.findByRole('dialog');

        await userEvent.click(screen.getByRole('button', {name: 'Close'}));

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(LocalStorageStore.isPasskeyPromptDue('tok1')).toBe(false);
    });

    test('Escape skips the prompt for this login', async () => {
        renderPrompt();
        await screen.findByRole('dialog');

        // user-event leaves keyCode at 0 and the modal only recognises 27.
        fireEvent.keyDown(screen.getByRole('dialog'), {key: 'Escape', keyCode: 27});

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(LocalStorageStore.isPasskeyPromptDue('tok1')).toBe(false);
    });

    test('Add passkey registers a passkey with an empty name and records the browser as enrolled', async () => {
        renderPrompt();
        await screen.findByRole('dialog');

        await userEvent.click(screen.getByRole('button', {name: 'Add passkey'}));

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(beginRegistration).toHaveBeenCalledWith('me');
        expect(finishRegistration).toHaveBeenCalledWith('me', 'cer1', '', expect.objectContaining({id: 'cred1'}));
        expect(LocalStorageStore.isPasskeyPromptDue('tok2')).toBe(false);
    });

    test('ignores repeated clicks while the ceremony runs', async () => {
        let resolveCreate: (v: unknown) => void = () => {};
        create.mockReturnValue(new Promise((r) => {
            resolveCreate = r;
        }));
        renderPrompt();
        await screen.findByRole('dialog');

        const add = screen.getByRole('button', {name: 'Add passkey'});
        await userEvent.click(add);
        await waitFor(() => expect(add).toBeDisabled());
        await userEvent.click(add);
        resolveCreate(rawCredential);

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(beginRegistration).toHaveBeenCalledTimes(1);
        expect(create).toHaveBeenCalledTimes(1);
    });

    test.each(['NotAllowedError', 'AbortError'])('stays open without an error when the browser prompt is dismissed (%s)', async (name) => {
        create.mockRejectedValue(domError(name));
        renderPrompt();
        await screen.findByRole('dialog');

        await userEvent.click(screen.getByRole('button', {name: 'Add passkey'}));

        await waitFor(() => expect(screen.getByRole('button', {name: 'Add passkey'})).toBeEnabled());
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(finishRegistration).not.toHaveBeenCalled();
        expect(document.querySelector('.genericModalError')).not.toBeInTheDocument();
        expect(LocalStorageStore.isPasskeyPromptDue('tok1')).toBe(true);
    });

    test('InvalidStateError means the device already has a passkey, so it records that and closes without an error', async () => {
        create.mockRejectedValue(domError('InvalidStateError'));
        renderPrompt();
        await screen.findByRole('dialog');

        await userEvent.click(screen.getByRole('button', {name: 'Add passkey'}));

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(finishRegistration).not.toHaveBeenCalled();
        expect(LocalStorageStore.isPasskeyPromptDue('tok2')).toBe(false);
    });

    test('tells the user to sign in again when begin is refused as recent-login-required', async () => {
        beginRegistration.mockRejectedValue({server_error_id: 'app.passkey.recent_login_required.app_error', status_code: 403, message: 'server text'});
        renderPrompt();
        await screen.findByRole('dialog');

        await userEvent.click(screen.getByRole('button', {name: 'Add passkey'}));

        expect(await screen.findByText(RECENT_LOGIN_TEXT)).toBeInTheDocument();
        expect(screen.queryByText('server text')).not.toBeInTheDocument();
        expect(create).not.toHaveBeenCalled();
    });

    test('keeps the prompt skippable after an error', async () => {
        beginRegistration.mockRejectedValue({server_error_id: 'app.passkey.recent_login_required.app_error', status_code: 403, message: 'server text'});
        renderPrompt();
        await screen.findByRole('dialog');
        await userEvent.click(screen.getByRole('button', {name: 'Add passkey'}));
        await screen.findByText(RECENT_LOGIN_TEXT);

        await userEvent.click(screen.getByRole('button', {name: 'Not now'}));

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(LocalStorageStore.isPasskeyPromptDue('tok1')).toBe(false);
    });

    test('shows the server message for any other refusal', async () => {
        beginRegistration.mockRejectedValue({server_error_id: 'app.passkey.limit_reached.app_error', status_code: 400, message: 'limit hit'});
        renderPrompt();
        await screen.findByRole('dialog');

        await userEvent.click(screen.getByRole('button', {name: 'Add passkey'}));

        expect(await screen.findByText('limit hit')).toBeInTheDocument();
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(LocalStorageStore.isPasskeyPromptDue('tok1')).toBe(true);
    });

    test('shows the server message when finish is refused', async () => {
        finishRegistration.mockRejectedValue({server_error_id: 'app.passkey.limit_reached.app_error', status_code: 400, message: 'limit hit'});
        renderPrompt();
        await screen.findByRole('dialog');

        await userEvent.click(screen.getByRole('button', {name: 'Add passkey'}));

        expect(await screen.findByText('limit hit')).toBeInTheDocument();
        expect(LocalStorageStore.isPasskeyPromptDue('tok1')).toBe(true);
    });

    test('does not reopen once closed when the page state changes', async () => {
        const {rerender} = renderPrompt();
        await screen.findByRole('dialog');
        await userEvent.click(screen.getByRole('button', {name: 'Not now'}));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

        document.cookie = 'MMCSRF=tok9';
        rerender(<PasskeyEnrollmentPrompt/>);

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
