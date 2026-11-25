// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {isDesktopApp} from '@mattermost/shared/utils/user_agent';

import {Client4} from 'mattermost-redux/client';

import LocalStorageStore from 'stores/local_storage_store';

import {act, fireEvent, renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import PasskeyEnrollmentPrompt from './passkey_enrollment_prompt';

jest.mock('@mattermost/shared/utils/user_agent', () => ({
    isDesktopApp: jest.fn(() => false),
}));

const isDesktopAppMock = jest.mocked(isDesktopApp);

const stateWith = (enabled: 'true' | 'false') => ({
    entities: {general: {config: {PasskeyEnrollmentEnabled: enabled}}, users: {currentUserId: 'user1'}},
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

const MINUTE = 60 * 1000;

const session = (props: Record<string, string>, ageMs = 0) => ({props, create_at: Date.now() - ageMs});

const RECENT_LOGIN_TEXT = 'For your security, sign out and sign back in, then add your passkey within 10 minutes.';

describe('PasskeyEnrollmentPrompt', () => {
    let beginRegistration: jest.SpyInstance;
    let finishRegistration: jest.SpyInstance;
    let create: jest.Mock;
    let getSessions: jest.SpyInstance;

    const renderPrompt = (enabled: 'true' | 'false' = 'true') => renderWithContext(<PasskeyEnrollmentPrompt/>, stateWith(enabled));

    beforeEach(() => {
        localStorage.clear();
        expireCookie('MMLOGINMETHOD');
        document.cookie = 'MMCSRF=tok1';
        isDesktopAppMock.mockReturnValue(false);

        getSessions = jest.spyOn(Client4, 'getSessions').mockResolvedValue([session({csrf: 'tok1', login_method: 'standard'})] as never);
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

    test('is shown to a user who has not enrolled when another user enrolled in this browser', async () => {
        LocalStorageStore.setPasskeyEnrolled('someone-else');
        renderPrompt();

        expect(await screen.findByRole('dialog')).toBeInTheDocument();
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
        ['this user already has a passkey in this browser', () => {
            LocalStorageStore.setPasskeyEnrolled('user1');
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
        expect(getSessions).not.toHaveBeenCalled();
    });

    test('stays closed and due while account settings is open', async () => {
        renderWithContext(<PasskeyEnrollmentPrompt/>, {
            ...stateWith('true'),
            views: {modals: {modalState: {user_settings: {open: true}}}},
        });

        await waitFor(() => expect(getSessions).toHaveBeenCalled());
        await new Promise((r) => setTimeout(r, 50));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(LocalStorageStore.isPasskeyPromptDue('user1', 'tok1')).toBe(true);
    });

    describe('the current session', () => {
        // The sessions promise is settled inside act, so the closed cases are checked after the
        // component has seen the answer rather than before it arrives.
        const renderWithSessions = async (answer: () => unknown) => {
            let settle: () => void = () => {};
            getSessions.mockReturnValue(new Promise((resolve, reject) => {
                settle = () => {
                    try {
                        resolve(answer());
                    } catch (e) {
                        reject(e);
                    }
                };
            }));
            const view = renderPrompt();
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            await act(async () => {
                settle();
            });
            return view;
        };

        test('opens the prompt for a recent standard session, matched by its csrf prop', async () => {
            await renderWithSessions(() => [
                session({csrf: 'other', login_method: 'passkey'}),
                session({csrf: 'tok1', login_method: 'standard'}, 9 * MINUTE),
            ]);

            expect(await screen.findByRole('dialog')).toBeInTheDocument();
            expect(getSessions).toHaveBeenCalledWith('me');
        });

        // The list is read from a replica, so the session behind this request may not be in it yet.
        test.each([
            ['recent only for other sessions', () => [session({csrf: 'tok2', login_method: 'standard'})]],
            ['an empty list', () => []],
        ])('opens the prompt when the list lacks this session: %s', async (_name, answer) => {
            await renderWithSessions(answer);

            expect(await screen.findByRole('dialog')).toBeInTheDocument();
        });

        test.each([
            ['older than 10 minutes', () => [session({csrf: 'tok1', login_method: 'standard'}, 11 * MINUTE)]],
            ['a passkey session', () => [session({csrf: 'tok1', login_method: 'passkey'})]],
            ['a session with no login method', () => [session({csrf: 'tok1'})]],
        ])('renders nothing and skips this login when the session is %s', async (_name, answer) => {
            const {container} = await renderWithSessions(answer);

            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            expect(container).toBeEmptyDOMElement();
            expect(LocalStorageStore.isPasskeyPromptDue('user1', 'tok1')).toBe(false);
            expect(LocalStorageStore.isPasskeyPromptDue('user1', 'tok2')).toBe(true);
        });

        test('does not look the sessions up again on a later mount after an old-session answer', async () => {
            const old = () => [session({csrf: 'tok1', login_method: 'standard'}, 11 * MINUTE)];
            const first = await renderWithSessions(old);
            first.unmount();

            const {container} = renderPrompt();
            await new Promise((r) => setTimeout(r, 50));

            expect(getSessions).toHaveBeenCalledTimes(1);
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            expect(container).toBeEmptyDOMElement();
        });

        test('renders nothing and records no skip when the lookup fails', async () => {
            const {container} = await renderWithSessions(() => {
                throw new Error('network');
            });

            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            expect(container).toBeEmptyDOMElement();
            expect(LocalStorageStore.isPasskeyPromptDue('user1', 'tok1')).toBe(true);
        });
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
        expect(LocalStorageStore.isPasskeyPromptDue('user1', 'tok1')).toBe(false);
        expect(LocalStorageStore.isPasskeyPromptDue('user1', 'tok2')).toBe(true);
    });

    test('has no close button', async () => {
        renderPrompt();
        await screen.findByRole('dialog');

        expect(screen.queryByRole('button', {name: 'Close'})).not.toBeInTheDocument();
    });

    test('a click on the backdrop leaves the prompt open and due', async () => {
        renderPrompt();
        await screen.findByRole('dialog');

        // react-bootstrap closes on a click whose target is the .modal container around the dialog.
        const container = document.querySelector('.modal') as HTMLElement;
        await userEvent.click(container);

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(LocalStorageStore.isPasskeyPromptDue('user1', 'tok1')).toBe(true);
    });

    test('the footer buttons are Use existing passkey, Not now, Add passkey in that order', async () => {
        renderPrompt();
        await screen.findByRole('dialog');

        const buttons = screen.getAllByRole('button').map((b) => b.textContent);
        expect(buttons).toEqual(['Use existing passkey', 'Not now', 'Add passkey']);
    });

    test('Escape skips the prompt for this login', async () => {
        renderPrompt();
        await screen.findByRole('dialog');

        // user-event leaves keyCode at 0 and the modal only recognises 27.
        fireEvent.keyDown(screen.getByRole('dialog'), {key: 'Escape', keyCode: 27});

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(LocalStorageStore.isPasskeyPromptDue('user1', 'tok1')).toBe(false);
    });

    test('Add passkey registers a passkey with an empty name and records the browser as enrolled', async () => {
        renderPrompt();
        await screen.findByRole('dialog');

        await userEvent.click(screen.getByRole('button', {name: 'Add passkey'}));

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(beginRegistration).toHaveBeenCalledWith('me');
        expect(finishRegistration).toHaveBeenCalledWith('me', 'cer1', '', expect.objectContaining({id: 'cred1'}));
        expect(LocalStorageStore.isPasskeyPromptDue('user1', 'tok2')).toBe(false);
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
        expect(LocalStorageStore.isPasskeyPromptDue('user1', 'tok1')).toBe(true);
    });

    test('InvalidStateError means the device already has a passkey, so it records that and closes without an error', async () => {
        create.mockRejectedValue(domError('InvalidStateError'));
        renderPrompt();
        await screen.findByRole('dialog');

        await userEvent.click(screen.getByRole('button', {name: 'Add passkey'}));

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(finishRegistration).not.toHaveBeenCalled();
        expect(LocalStorageStore.isPasskeyPromptDue('user1', 'tok2')).toBe(false);
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
        expect(LocalStorageStore.isPasskeyPromptDue('user1', 'tok1')).toBe(false);
    });

    test('shows the server message for any other refusal', async () => {
        beginRegistration.mockRejectedValue({server_error_id: 'app.passkey.limit_reached.app_error', status_code: 400, message: 'limit hit'});
        renderPrompt();
        await screen.findByRole('dialog');

        await userEvent.click(screen.getByRole('button', {name: 'Add passkey'}));

        expect(await screen.findByText('limit hit')).toBeInTheDocument();
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(LocalStorageStore.isPasskeyPromptDue('user1', 'tok1')).toBe(true);
    });

    test('shows the server message when finish is refused', async () => {
        finishRegistration.mockRejectedValue({server_error_id: 'app.passkey.limit_reached.app_error', status_code: 400, message: 'limit hit'});
        renderPrompt();
        await screen.findByRole('dialog');

        await userEvent.click(screen.getByRole('button', {name: 'Add passkey'}));

        expect(await screen.findByText('limit hit')).toBeInTheDocument();
        expect(LocalStorageStore.isPasskeyPromptDue('user1', 'tok1')).toBe(true);
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

    describe('Use existing passkey', () => {
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
        const NONE_REGISTERED_TEXT = 'You don\'t have a passkey for this account yet. Add one instead.';
        const INVALID_CREDENTIAL_TEXT = 'That passkey doesn\'t belong to your account on this server. Choose another, or add a new one.';

        let createTicket: jest.SpyInstance;
        let beginVerification: jest.SpyInstance;
        let finishVerification: jest.SpyInstance;
        let get: jest.Mock;

        const openPrompt = async () => {
            renderPrompt();
            await screen.findByRole('dialog');
        };
        const clickExisting = () => userEvent.click(screen.getByRole('button', {name: 'Use existing passkey'}));

        beforeEach(() => {
            createTicket = jest.spyOn(Client4, 'createPasskeyEnrollmentTicket').mockResolvedValue({ticket: 'tk1', expire_at: 1});
            beginVerification = jest.spyOn(Client4, 'beginPasskeyEnrollmentVerification').mockResolvedValue(verifyBegin);
            finishVerification = jest.spyOn(Client4, 'finishPasskeyEnrollmentVerification').mockResolvedValue({user_id: 'user1'});
            get = jest.fn().mockResolvedValue(assertionCredential);
            Object.defineProperty(navigator, 'credentials', {value: {create, get}, configurable: true});
        });

        test('verifies an existing passkey with a ticket from this session and records the browser as enrolled', async () => {
            await openPrompt();

            await clickExisting();

            await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
            expect(createTicket).toHaveBeenCalledWith('me');
            expect(beginVerification).toHaveBeenCalledWith('tk1');
            expect(finishVerification).toHaveBeenCalledWith('ver1', expect.objectContaining({id: 'cred2'}));
            expect(beginRegistration).not.toHaveBeenCalled();
            expect(LocalStorageStore.isPasskeyPromptDue('user1', 'tok2')).toBe(false);
        });

        test('stays open without an error when the browser prompt is dismissed, and a new click asks for a new ticket', async () => {
            get.mockRejectedValueOnce(domError('NotAllowedError'));
            createTicket.mockResolvedValueOnce({ticket: 'tk1', expire_at: 1}).mockResolvedValueOnce({ticket: 'tk2', expire_at: 1});
            await openPrompt();

            await clickExisting();

            await waitFor(() => expect(screen.getByRole('button', {name: 'Use existing passkey'})).toBeEnabled());
            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(finishVerification).not.toHaveBeenCalled();
            expect(document.querySelector('.genericModalError')).not.toBeInTheDocument();
            expect(LocalStorageStore.isPasskeyPromptDue('user1', 'tok1')).toBe(true);

            await clickExisting();

            await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
            expect(beginVerification).toHaveBeenNthCalledWith(1, 'tk1');
            expect(beginVerification).toHaveBeenNthCalledWith(2, 'tk2');
        });

        test('says to add a passkey when the account has none', async () => {
            beginVerification.mockRejectedValue({server_error_id: 'app.passkey.none_registered.app_error', status_code: 400, message: 'server text'});
            await openPrompt();

            await clickExisting();

            expect(await screen.findByText(NONE_REGISTERED_TEXT)).toBeInTheDocument();
            expect(screen.queryByText('server text')).not.toBeInTheDocument();
            expect(get).not.toHaveBeenCalled();
            expect(LocalStorageStore.isPasskeyPromptDue('user1', 'tok1')).toBe(true);
        });

        test('says the passkey is not this account\'s when finish refuses it', async () => {
            finishVerification.mockRejectedValue({server_error_id: 'app.passkey.invalid_credential.app_error', status_code: 401, message: 'server text'});
            await openPrompt();

            await clickExisting();

            expect(await screen.findByText(INVALID_CREDENTIAL_TEXT)).toBeInTheDocument();
            expect(screen.queryByText('server text')).not.toBeInTheDocument();
            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(LocalStorageStore.isPasskeyPromptDue('user1', 'tok1')).toBe(true);
        });

        test('shows the server message when the ticket is refused', async () => {
            createTicket.mockRejectedValue({server_error_id: 'app.passkey.not_enabled.app_error', status_code: 501, message: 'passkeys are off'});
            await openPrompt();

            await clickExisting();

            expect(await screen.findByText('passkeys are off')).toBeInTheDocument();
            expect(beginVerification).not.toHaveBeenCalled();
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        test('disables both actions while the check runs, but Not now still closes', async () => {
            get.mockReturnValue(new Promise(() => {}));
            await openPrompt();

            await clickExisting();

            await waitFor(() => expect(screen.getByRole('button', {name: 'Add passkey'})).toBeDisabled());
            expect(screen.getByRole('button', {name: 'Use existing passkey'})).toBeDisabled();

            await userEvent.click(screen.getByRole('button', {name: 'Not now'}));
            await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
            expect(LocalStorageStore.isPasskeyPromptDue('user1', 'tok1')).toBe(false);
        });

        test('disables the check while a passkey is being added', async () => {
            create.mockReturnValue(new Promise(() => {}));
            await openPrompt();

            await userEvent.click(screen.getByRole('button', {name: 'Add passkey'}));

            await waitFor(() => expect(screen.getByRole('button', {name: 'Use existing passkey'})).toBeDisabled());
        });
    });
});
