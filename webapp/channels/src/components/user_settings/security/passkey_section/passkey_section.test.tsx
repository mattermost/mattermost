// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createMemoryHistory} from 'history';
import React from 'react';

import {isDesktopApp} from '@mattermost/shared/utils/user_agent';
import type {Passkey} from '@mattermost/types/passkeys';

import {Client4} from 'mattermost-redux/client';

import * as GlobalActions from 'actions/global_actions';
import LocalStorageStore from 'stores/local_storage_store';

import {renderWithContext, screen, userEvent, waitFor, within} from 'tests/react_testing_utils';
import {isEmbedded} from 'utils/embed';
import * as Passkeys from 'utils/passkeys';

import PasskeySection from './index';

jest.mock('@mattermost/shared/utils/user_agent', () => ({
    isDesktopApp: jest.fn(() => false),
}));

jest.mock('utils/embed', () => ({
    isEmbedded: jest.fn(() => false),
}));

const isDesktopAppMock = jest.mocked(isDesktopApp);
const isEmbeddedMock = jest.mocked(isEmbedded);

const passkeys: Passkey[] = [
    {id: 'pk1', user_id: 'me', name: 'Laptop', create_at: Date.UTC(2025, 0, 15, 12), last_used_at: 0, credential_id: 'Y3JlZC1wazE', user_handle: 'aGFuZGxl'},
    {id: 'pk2', user_id: 'me', name: 'Phone', create_at: Date.UTC(2025, 1, 20, 12), last_used_at: Date.UTC(2025, 2, 5, 12), credential_id: 'Y3JlZC1wazI', user_handle: 'aGFuZGxl'},
];

const enabledState = {
    entities: {
        general: {
            config: {FeatureFlagPasskeys: 'true', PasskeyEnrollmentEnabled: 'true' as const},
            license: {IsLicensed: 'true', SkuShortName: 'professional'},
        },
    },
};

const manyPasskeys: Passkey[] = Array.from({length: 10}, (_, i) => ({
    id: `pk${i}`, user_id: 'me', name: `Key ${i}`, create_at: Date.UTC(2025, 0, 1), last_used_at: 0, credential_id: `Y3JlZC1way${i}`, user_handle: 'aGFuZGxl',
}));

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

describe('PasskeySection', () => {
    const baseProps = {
        active: false,
        areAllSectionsInactive: true,
        updateSection: jest.fn(),
    };

    let getPasskeys: jest.SpyInstance;
    let deletePasskey: jest.SpyInstance;
    let canAddPasskey: jest.SpyInstance;

    beforeEach(() => {
        getPasskeys = jest.spyOn(Client4, 'getPasskeys').mockResolvedValue(passkeys);
        canAddPasskey = jest.spyOn(Passkeys, 'currentSessionCanAddPasskey').mockResolvedValue(true);
        deletePasskey = jest.spyOn(Client4, 'deletePasskey').mockResolvedValue({status: 'OK'} as never);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('renders nothing and fetches nothing when the flag is off', () => {
        const state = {entities: {general: {config: {FeatureFlagPasskeys: 'false'}, license: {IsLicensed: 'true', SkuShortName: 'professional'}}}};
        const {container} = renderWithContext(<PasskeySection {...baseProps}/>, state);

        expect(container).toBeEmptyDOMElement();
        expect(getPasskeys).not.toHaveBeenCalled();
    });

    test.each([
        ['unlicensed', {IsLicensed: 'false'}],
        ['below Professional', {IsLicensed: 'true', SkuShortName: 'starter'}],
    ])('renders nothing when the server is %s', (_name, license) => {
        const state = {entities: {general: {config: {FeatureFlagPasskeys: 'true'}, license}}};
        const {container} = renderWithContext(<PasskeySection {...baseProps}/>, state);

        expect(container).toBeEmptyDOMElement();
        expect(getPasskeys).not.toHaveBeenCalled();
    });

    test('shows the passkey count when collapsed', async () => {
        renderWithContext(<PasskeySection {...baseProps}/>, enabledState);

        expect(await screen.findByText('2 passkeys')).toBeInTheDocument();
        expect(getPasskeys).toHaveBeenCalledWith('me');
    });

    test('shows names, created dates and last use when expanded', async () => {
        renderWithContext(
            <PasskeySection
                {...baseProps}
                active={true}
            />,
            enabledState,
        );

        expect(await screen.findByText('Laptop')).toBeInTheDocument();
        expect(screen.getByText('Phone')).toBeInTheDocument();
        expect(screen.getByText(/Created Jan 15, 2025/)).toBeInTheDocument();
        expect(screen.getByText(/Never used/)).toBeInTheDocument();
        expect(screen.getByText(/Last used Mar 5, 2025/)).toBeInTheDocument();
    });

    test('keeps whitespace between the created date and last use when the separator is hidden from assistive tech', async () => {
        renderWithContext(
            <PasskeySection
                {...baseProps}
                active={true}
            />,
            enabledState,
        );

        const line = (await screen.findByText(/Created Jan 15, 2025/)).closest('.light')!.cloneNode(true) as HTMLElement;
        line.querySelectorAll('[aria-hidden="true"]').forEach((el) => el.remove());

        expect(line.textContent).toMatch(/Jan 15, 2025\s+Never used/);
    });

    describe('layout', () => {
        const renderExpanded = (list: Passkey[]) => {
            getPasskeys.mockResolvedValue(list);
            renderWithContext(
                <PasskeySection
                    {...baseProps}
                    active={true}
                />,
                enabledState,
            );
        };

        beforeEach(() => {
            isDesktopAppMock.mockReturnValue(false);
            Object.defineProperty(window, 'PublicKeyCredential', {value: function PublicKeyCredential() {}, configurable: true});
        });

        afterEach(() => {
            Reflect.deleteProperty(window, 'PublicKeyCredential');
        });

        test('explains passkeys above the list when expanded', async () => {
            renderExpanded(passkeys);
            await screen.findByText('Laptop');

            expect(screen.getByText(/Passkeys let you sign in with your fingerprint, face, screen lock or a security key instead of your password\./)).toBeInTheDocument();
        });

        test('puts the passkey rows in the list box, before the add button', async () => {
            renderExpanded(passkeys);
            const laptop = await screen.findByText('Laptop');

            const box = laptop.closest('.alert-transparent');
            expect(box).not.toBeNull();
            expect(box).toContainElement(screen.getByText('Phone'));
            expect(box?.querySelectorAll('li')).toHaveLength(2);

            const add = screen.getByRole('button', {name: 'Add passkey'});
            expect(box).not.toContainElement(add);
            expect(box!.compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        });

        test('puts the empty-state text in the list box', async () => {
            renderExpanded([]);

            const none = await screen.findByText('You have no passkeys.');

            expect(none.closest('.alert-transparent')).not.toBeNull();
        });

        test('keeps the delete button clear of the name and the list flush with its box', async () => {
            renderExpanded(passkeys);
            const laptop = await screen.findByText('Laptop');

            const nameBlock = laptop.parentElement!;
            expect(nameBlock).toHaveClass('flex-1');
            expect(nameBlock).not.toContainElement(screen.getByRole('button', {name: 'Delete passkey Laptop'}));
            expect(laptop.closest('ul')).toHaveClass('m-0');
        });

        test('keeps the add form clear of the description when the list could not be loaded', async () => {
            getPasskeys.mockRejectedValue({message: 'could not list passkeys'});
            renderWithContext(
                <PasskeySection
                    {...baseProps}
                    active={true}
                />,
                enabledState,
            );
            await screen.findByText('could not list passkeys');

            expect(document.querySelector('.alert-transparent')).toBeNull();
            expect(screen.getByLabelText(/name/i).parentElement!.parentElement!.parentElement).toHaveClass('mt-5');
        });
    });

    test('deleting a passkey asks for confirmation, deletes it and refetches', async () => {
        renderWithContext(
            <PasskeySection
                {...baseProps}
                active={true}
            />,
            enabledState,
        );
        await screen.findByText('Laptop');

        getPasskeys.mockResolvedValue([passkeys[1]]);
        await userEvent.click(screen.getByRole('button', {name: 'Delete passkey Laptop'}));
        expect(screen.getByText('Delete passkey?')).toBeInTheDocument();
        expect(deletePasskey).not.toHaveBeenCalled();

        await userEvent.click(screen.getByRole('button', {name: 'Delete'}));

        await waitFor(() => {
            expect(screen.queryByText('Laptop')).not.toBeInTheDocument();
        });
        expect(deletePasskey).toHaveBeenCalledWith('me', 'pk1');
        expect(screen.getByText('Phone')).toBeInTheDocument();
    });

    describe('when deleting a passkey ends the current session', () => {
        const deleteLaptop = async (reloadError: object) => {
            renderWithContext(
                <PasskeySection
                    {...baseProps}
                    active={true}
                />,
                enabledState,
            );
            await screen.findByText('Laptop');
            getPasskeys.mockRejectedValue(reloadError);
            await userEvent.click(screen.getByRole('button', {name: 'Delete passkey Laptop'}));
            await userEvent.click(screen.getByRole('button', {name: 'Delete'}));
        };

        test('the dialog warns that sessions started with the passkey are signed out', async () => {
            renderWithContext(
                <PasskeySection
                    {...baseProps}
                    active={true}
                />,
                enabledState,
            );
            await screen.findByText('Laptop');
            await userEvent.click(screen.getByRole('button', {name: 'Delete passkey Laptop'}));

            const dialog = await screen.findByRole('dialog');
            expect(within(dialog).getByText(/Any session started with it will be signed out, including this one if you signed in with it\./)).toBeInTheDocument();
        });

        test('signs out to the login page without an error when the reload is unauthorized', async () => {
            const logout = jest.spyOn(GlobalActions, 'emitUserLoggedOutEvent').mockImplementation(() => {});
            await deleteLaptop({status_code: 401, message: 'session expired'});

            await waitFor(() => {
                expect(logout).toHaveBeenCalledWith('/login');
            });
            expect(screen.queryByText('session expired')).not.toBeInTheDocument();
        });

        test('shows the error and stays signed in when the reload fails otherwise', async () => {
            const logout = jest.spyOn(GlobalActions, 'emitUserLoggedOutEvent').mockImplementation(() => {});
            await deleteLaptop({status_code: 500, message: 'could not list passkeys'});

            expect(await screen.findByText('could not list passkeys')).toBeInTheDocument();
            expect(logout).not.toHaveBeenCalled();
        });
    });

    test.each([
        ['Cancel', async (dialog: HTMLElement) => userEvent.click(within(dialog).getByRole('button', {name: 'Cancel'}))],
        ['the X', async (dialog: HTMLElement) => userEvent.click(within(dialog).getByRole('button', {name: 'Close'}))],
        ['Escape', async (dialog: HTMLElement) => userEvent.type(dialog, '{Escape}')],
    ])('%s closes the delete dialog without deleting the passkey', async (_name, dismiss) => {
        renderWithContext(
            <PasskeySection
                {...baseProps}
                active={true}
            />,
            enabledState,
        );
        await screen.findByText('Laptop');

        await userEvent.click(screen.getByRole('button', {name: 'Delete passkey Laptop'}));
        const dialog = await screen.findByRole('dialog');
        expect(within(dialog).getByText('Delete passkey?')).toBeInTheDocument();
        expect(within(dialog).getByRole('button', {name: 'Delete'}).closest('.modal-footer')).not.toBeNull();

        await dismiss(dialog);

        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
        expect(deletePasskey).not.toHaveBeenCalled();
        expect(screen.getByText('Laptop')).toBeInTheDocument();
    });

    test('shows the server error when deleting fails and does not refetch', async () => {
        deletePasskey.mockRejectedValue({message: 'could not delete passkey'});
        renderWithContext(
            <PasskeySection
                {...baseProps}
                active={true}
            />,
            enabledState,
        );
        await screen.findByText('Laptop');
        getPasskeys.mockClear();

        await userEvent.click(screen.getByRole('button', {name: 'Delete passkey Laptop'}));
        await userEvent.click(screen.getByRole('button', {name: 'Delete'}));

        expect(await screen.findByText('could not delete passkey')).toBeInTheDocument();
        expect(getPasskeys).not.toHaveBeenCalled();
        expect(screen.getByText('Laptop')).toBeInTheDocument();
    });

    test('shows the server error when listing fails', async () => {
        getPasskeys.mockRejectedValue({message: 'could not list passkeys'});
        renderWithContext(
            <PasskeySection
                {...baseProps}
                active={true}
            />,
            enabledState,
        );

        expect(await screen.findByText('could not list passkeys')).toBeInTheDocument();
    });

    test('shows the list error again, not the empty state, when reopened after a failed fetch', async () => {
        getPasskeys.mockRejectedValue({message: 'could not list passkeys'});
        const {rerender} = renderWithContext(
            <PasskeySection
                {...baseProps}
                active={true}
            />,
            enabledState,
        );
        expect(await screen.findByText('could not list passkeys')).toBeInTheDocument();

        rerender(
            <PasskeySection
                {...baseProps}
                active={false}
            />,
        );
        rerender(
            <PasskeySection
                {...baseProps}
                active={true}
            />,
        );

        expect(await screen.findByText('could not list passkeys')).toBeInTheDocument();
        expect(screen.queryByText('You have no passkeys.')).not.toBeInTheDocument();
    });

    test('shows the empty state, not the old list error, when reopened after a recovered fetch', async () => {
        getPasskeys.mockRejectedValueOnce({message: 'could not list passkeys'}).mockResolvedValue([]);
        const {rerender} = renderWithContext(
            <PasskeySection
                {...baseProps}
                active={true}
            />,
            enabledState,
        );
        expect(await screen.findByText('could not list passkeys')).toBeInTheDocument();

        rerender(
            <PasskeySection
                {...baseProps}
                active={false}
            />,
        );
        rerender(
            <PasskeySection
                {...baseProps}
                active={true}
            />,
        );

        expect(await screen.findByText('You have no passkeys.')).toBeInTheDocument();
        expect(screen.queryByText('could not list passkeys')).not.toBeInTheDocument();

        rerender(
            <PasskeySection
                {...baseProps}
                active={false}
            />,
        );

        expect(screen.getByText('No passkeys')).toBeInTheDocument();
    });

    test('does not say "No passkeys" when collapsed after a failed fetch', async () => {
        getPasskeys.mockRejectedValue({message: 'could not list passkeys'});
        renderWithContext(
            <PasskeySection
                {...baseProps}
                active={false}
            />,
            enabledState,
        );
        await waitFor(() => expect(screen.queryByText('No passkeys')).not.toBeInTheDocument());

        expect(screen.getByText('Passkeys')).toBeInTheDocument();
        expect(screen.queryByText('No passkeys')).not.toBeInTheDocument();
    });

    test('shows the empty state', async () => {
        getPasskeys.mockResolvedValue([]);
        renderWithContext(
            <PasskeySection
                {...baseProps}
                active={true}
            />,
            enabledState,
        );

        expect(await screen.findByText('You have no passkeys.')).toBeInTheDocument();
    });

    describe('telling the browser which passkeys exist', () => {
        let signalAllAcceptedCredentials: jest.Mock;
        let signalUnknownCredential: jest.Mock;

        const renderCollapsed = () => renderWithContext(<PasskeySection {...baseProps}/>, enabledState);

        beforeEach(() => {
            signalAllAcceptedCredentials = jest.fn().mockResolvedValue(undefined);
            signalUnknownCredential = jest.fn().mockResolvedValue(undefined);
            Object.defineProperty(window, 'PublicKeyCredential', {value: Object.assign(function PublicKeyCredential() {}, {signalAllAcceptedCredentials, signalUnknownCredential}), configurable: true});
        });

        afterEach(() => {
            Reflect.deleteProperty(window, 'PublicKeyCredential');
        });

        test('lists the accepted credential ids after a successful fetch', async () => {
            renderCollapsed();

            await waitFor(() => expect(signalAllAcceptedCredentials).toHaveBeenCalledTimes(1));
            expect(signalAllAcceptedCredentials).toHaveBeenCalledWith({
                rpId: window.location.hostname,
                userId: 'aGFuZGxl',
                allAcceptedCredentialIds: ['Y3JlZC1wazE', 'Y3JlZC1wazI'],
            });
        });

        test('signals nothing when the fetch fails', async () => {
            getPasskeys.mockRejectedValue({message: 'no list'});
            renderWithContext(<PasskeySection {...baseProps}/>, enabledState);

            await waitFor(() => expect(getPasskeys).toHaveBeenCalled());
            await screen.findByText('Passkeys');
            expect(signalAllAcceptedCredentials).not.toHaveBeenCalled();
            expect(signalUnknownCredential).not.toHaveBeenCalled();
        });

        test('signals nothing when there are no passkeys', async () => {
            getPasskeys.mockResolvedValue([]);
            renderCollapsed();

            expect(await screen.findByText('No passkeys')).toBeInTheDocument();
            expect(signalAllAcceptedCredentials).not.toHaveBeenCalled();
        });

        test('tells the browser a deleted passkey is gone, then lists the rest', async () => {
            renderWithContext(
                <PasskeySection
                    {...baseProps}
                    active={true}
                />,
                enabledState,
            );
            await screen.findByText('Laptop');
            signalAllAcceptedCredentials.mockClear();

            getPasskeys.mockResolvedValue([passkeys[1]]);
            await userEvent.click(screen.getByRole('button', {name: 'Delete passkey Laptop'}));
            await userEvent.click(screen.getByRole('button', {name: 'Delete'}));

            await waitFor(() => expect(signalAllAcceptedCredentials).toHaveBeenCalledTimes(1));
            expect(signalUnknownCredential).toHaveBeenCalledWith({rpId: window.location.hostname, credentialId: 'Y3JlZC1wazE'});
            expect(signalAllAcceptedCredentials).toHaveBeenCalledWith({
                rpId: window.location.hostname,
                userId: 'aGFuZGxl',
                allAcceptedCredentialIds: ['Y3JlZC1wazI'],
            });
        });

        test('does not tell the browser a passkey is gone when the delete fails', async () => {
            deletePasskey.mockRejectedValue({message: 'could not delete passkey'});
            renderWithContext(
                <PasskeySection
                    {...baseProps}
                    active={true}
                />,
                enabledState,
            );
            await screen.findByText('Laptop');

            await userEvent.click(screen.getByRole('button', {name: 'Delete passkey Laptop'}));
            await userEvent.click(screen.getByRole('button', {name: 'Delete'}));

            expect(await screen.findByText('could not delete passkey')).toBeInTheDocument();
            expect(signalUnknownCredential).not.toHaveBeenCalled();
        });

        test('treats a delete whose session sign-out failed as deleted and still shows the error', async () => {
            deletePasskey.mockRejectedValue({server_error_id: 'app.passkey.revoke_sessions.app_error', status_code: 500, message: 'sessions remain'});
            renderWithContext(
                <PasskeySection
                    {...baseProps}
                    active={true}
                />,
                enabledState,
            );
            await screen.findByText('Laptop');

            getPasskeys.mockResolvedValue([passkeys[1]]);
            await userEvent.click(screen.getByRole('button', {name: 'Delete passkey Laptop'}));
            await userEvent.click(screen.getByRole('button', {name: 'Delete'}));

            expect(await screen.findByText('sessions remain')).toBeInTheDocument();
            expect(screen.queryByText('Laptop')).not.toBeInTheDocument();
            expect(signalUnknownCredential).toHaveBeenCalledWith({rpId: window.location.hostname, credentialId: 'Y3JlZC1wazE'});
        });
    });

    describe('the delete dialog text', () => {
        const forgetSentence = "If it's saved on this device, we'll ask your browser to remove it too.";

        const openDialog = async () => {
            renderWithContext(
                <PasskeySection
                    {...baseProps}
                    active={true}
                />,
                enabledState,
            );
            await screen.findByText('Laptop');
            await userEvent.click(screen.getByRole('button', {name: 'Delete passkey Laptop'}));
            return screen.findByRole('dialog');
        };

        afterEach(() => {
            Reflect.deleteProperty(window, 'PublicKeyCredential');
            isDesktopAppMock.mockReturnValue(false);
            isEmbeddedMock.mockReturnValue(false);
        });

        test('says the browser will be asked to remove the passkey when it can be', async () => {
            Object.defineProperty(window, 'PublicKeyCredential', {value: Object.assign(function PublicKeyCredential() {}, {signalUnknownCredential: jest.fn()}), configurable: true});

            const dialog = await openDialog();

            expect(within(dialog).getByText(forgetSentence)).toBeInTheDocument();
        });

        test('does not promise browser removal inside the desktop app', async () => {
            Object.defineProperty(window, 'PublicKeyCredential', {value: Object.assign(function PublicKeyCredential() {}, {signalUnknownCredential: jest.fn()}), configurable: true});
            isDesktopAppMock.mockReturnValue(true);

            const dialog = await openDialog();

            expect(within(dialog).getByText(/You will no longer be able to sign in with "Laptop"/)).toBeInTheDocument();
            expect(within(dialog).queryByText(forgetSentence)).not.toBeInTheDocument();
        });

        test('does not promise browser removal when embedded', async () => {
            Object.defineProperty(window, 'PublicKeyCredential', {value: Object.assign(function PublicKeyCredential() {}, {signalUnknownCredential: jest.fn()}), configurable: true});
            isEmbeddedMock.mockReturnValue(true);

            const dialog = await openDialog();

            expect(within(dialog).getByText(/You will no longer be able to sign in with "Laptop"/)).toBeInTheDocument();
            expect(within(dialog).queryByText(forgetSentence)).not.toBeInTheDocument();
        });

        test('sends one delete request when Delete is double-clicked while the dialog closes', async () => {
            deletePasskey.mockResolvedValueOnce({status: 'OK'} as never).mockRejectedValue({message: 'Passkey not found.'});
            const dialog = await openDialog();
            getPasskeys.mockResolvedValue([passkeys[1]]);

            await userEvent.dblClick(within(dialog).getByRole('button', {name: 'Delete'}));

            await waitFor(() => {
                expect(screen.queryByText('Laptop')).not.toBeInTheDocument();
            });
            expect(deletePasskey).toHaveBeenCalledTimes(1);
            expect(screen.queryByText('Passkey not found.')).not.toBeInTheDocument();
        });

        test('promises nothing when the browser has no Signal API', async () => {
            const dialog = await openDialog();

            expect(within(dialog).getByText(/You will no longer be able to sign in with "Laptop"/)).toBeInTheDocument();
            expect(within(dialog).queryByText(forgetSentence)).not.toBeInTheDocument();
        });

        test('keeps the passkey name in the text while the dialog fades out', async () => {
            const dialog = await openDialog();

            await userEvent.click(within(dialog).getByRole('button', {name: 'Delete'}));

            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(within(screen.getByRole('dialog')).getByText(/sign in with "Laptop"/)).toBeInTheDocument();
        });
    });

    describe('adding a passkey', () => {
        let beginRegistration: jest.SpyInstance;
        let finishRegistration: jest.SpyInstance;
        let create: jest.Mock;
        let signalUnknownCredential: jest.Mock;

        const renderExpanded = async (options?: Parameters<typeof renderWithContext>[2]) => {
            renderWithContext(
                <PasskeySection
                    {...baseProps}
                    active={true}
                />,
                enabledState,
                options,
            );
            await screen.findByText(/Laptop|Key 0/);
        };

        const clickAdd = () => userEvent.click(screen.getByRole('button', {name: 'Add passkey'}));

        beforeEach(() => {
            isDesktopAppMock.mockReturnValue(false);
            isEmbeddedMock.mockReturnValue(false);
            beginRegistration = jest.spyOn(Client4, 'beginPasskeyRegistration').mockResolvedValue(beginResult);
            finishRegistration = jest.spyOn(Client4, 'finishPasskeyRegistration').mockResolvedValue(passkeys[0]);
            create = jest.fn().mockResolvedValue(rawCredential);
            Object.defineProperty(navigator, 'credentials', {value: {create}, configurable: true});

            // jsdom has no WebAuthn; the add control is hidden without it.
            signalUnknownCredential = jest.fn().mockResolvedValue(undefined);
            Object.defineProperty(window, 'PublicKeyCredential', {value: Object.assign(function PublicKeyCredential() {}, {signalUnknownCredential}), configurable: true});
        });

        afterEach(() => {
            Reflect.deleteProperty(window, 'PublicKeyCredential');
        });

        describe('when the session is too old to add a passkey', () => {
            test('offers the add control for a recent session', async () => {
                jest.spyOn(Client4, 'getCSRFFromCookie').mockReturnValue('csrf1');
                await renderExpanded();

                expect(screen.getByRole('button', {name: 'Add passkey'})).toBeInTheDocument();
                expect(screen.queryByRole('button', {name: 'Sign in again'})).not.toBeInTheDocument();
                expect(canAddPasskey).toHaveBeenCalledWith('csrf1');
            });

            test('offers Sign in again instead of the name field for a stale session', async () => {
                canAddPasskey.mockResolvedValue(false);
                await renderExpanded();

                expect(await screen.findByRole('button', {name: 'Sign in again'})).toBeInTheDocument();
                expect(screen.getByText('To add a passkey, sign in again first.')).toBeInTheDocument();
                expect(screen.queryByLabelText('Passkey name')).not.toBeInTheDocument();
                expect(screen.queryByRole('button', {name: 'Add passkey'})).not.toBeInTheDocument();
            });

            test('shows only the limit hint at the limit with a stale session', async () => {
                canAddPasskey.mockResolvedValue(false);
                getPasskeys.mockResolvedValue(manyPasskeys);
                await renderExpanded();
                await canAddPasskey.mock.results[0].value;

                expect(screen.getByText(/You have reached the limit of 10 passkeys/)).toBeInTheDocument();
                expect(screen.queryByRole('button', {name: 'Sign in again'})).not.toBeInTheDocument();
                expect(screen.queryByText('To add a passkey, sign in again first.')).not.toBeInTheDocument();
            });

            test('keeps the add control when the lookup fails', async () => {
                canAddPasskey.mockRejectedValue(new Error('sessions unavailable'));
                await renderExpanded();

                await waitFor(() => expect(canAddPasskey).toHaveBeenCalled());
                await canAddPasskey.mock.results[0].value.catch(() => {});
                expect(screen.getByRole('button', {name: 'Add passkey'})).toBeInTheDocument();
                expect(screen.queryByRole('button', {name: 'Sign in again'})).not.toBeInTheDocument();
            });

            test('signs out to the login page and returns to this page with Profile > Security open', async () => {
                canAddPasskey.mockResolvedValue(false);
                const logout = jest.spyOn(GlobalActions, 'emitUserLoggedOutEvent').mockImplementation(() => {});
                await renderExpanded({history: createMemoryHistory({initialEntries: ['/team1/channels/town-square?a=1&b=2']})});

                await userEvent.click(await screen.findByRole('button', {name: 'Sign in again'}));

                expect(logout).toHaveBeenCalledWith('/login?redirect_to=' + encodeURIComponent('/team1/channels/town-square?action=open_security_settings'));
            });
        });

        describe('when the session started with a passkey', () => {
            const hint = 'You signed in with a passkey. To add a passkey, sign out and sign in with your password or single sign-on.';

            beforeEach(() => {
                document.cookie = 'MMLOGINMETHOD=passkey';
            });

            afterEach(() => {
                document.cookie = 'MMLOGINMETHOD=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
            });

            test('shows the list and the hint, with no add control and no Sign in again', async () => {
                await renderExpanded();

                expect(screen.getByText(hint)).toBeInTheDocument();
                expect(screen.queryByRole('button', {name: 'Add passkey'})).not.toBeInTheDocument();
                expect(screen.queryByLabelText('Passkey name')).not.toBeInTheDocument();
                expect(screen.queryByRole('button', {name: 'Sign in again'})).not.toBeInTheDocument();
                expect(screen.getByRole('button', {name: 'Delete passkey Laptop'})).toBeInTheDocument();
                expect(canAddPasskey).not.toHaveBeenCalled();
            });

            test('shows only the limit hint at the limit', async () => {
                getPasskeys.mockResolvedValue(manyPasskeys);
                await renderExpanded();

                expect(screen.getByText(/You have reached the limit of 10 passkeys/)).toBeInTheDocument();
                expect(screen.queryByText(hint)).not.toBeInTheDocument();
            });
        });

        test('is hidden without WebAuthn support but the list still shows', async () => {
            Reflect.deleteProperty(window, 'PublicKeyCredential');
            await renderExpanded();

            expect(screen.queryByRole('button', {name: 'Add passkey'})).not.toBeInTheDocument();
            expect(screen.queryByLabelText('Passkey name')).not.toBeInTheDocument();
        });

        test('clears a failed add attempt\'s error when the section is collapsed and reopened', async () => {
            beginRegistration.mockRejectedValue({server_error_id: 'app.passkey.limit_reached.app_error', message: 'limit hit'});
            const {rerender} = renderWithContext(
                <PasskeySection
                    {...baseProps}
                    active={true}
                />,
                enabledState,
            );
            await screen.findByText('Laptop');
            await clickAdd();
            expect(await screen.findByText('limit hit')).toBeInTheDocument();

            // Reopening re-fetches; a re-fetch that never settles cannot clear the error, so only the collapse can.
            getPasskeys.mockReturnValue(new Promise(() => {}));
            rerender(
                <PasskeySection
                    {...baseProps}
                    active={false}
                />,
            );
            rerender(
                <PasskeySection
                    {...baseProps}
                    active={true}
                />,
            );

            expect(screen.getByText('Laptop')).toBeInTheDocument();
            expect(screen.queryByText('limit hit')).not.toBeInTheDocument();
        });

        test('is hidden when enrollment is disabled but the list still shows', async () => {
            const state = {entities: {general: {config: {FeatureFlagPasskeys: 'true', PasskeyEnrollmentEnabled: 'false' as const}, license: {IsLicensed: 'true', SkuShortName: 'professional'}}}};
            renderWithContext(
                <PasskeySection
                    {...baseProps}
                    active={true}
                />,
                state,
            );

            expect(await screen.findByText('Laptop')).toBeInTheDocument();
            expect(screen.queryByRole('button', {name: 'Add passkey'})).not.toBeInTheDocument();
            expect(screen.queryByLabelText('Passkey name')).not.toBeInTheDocument();
        });

        test('is hidden inside the desktop app', async () => {
            isDesktopAppMock.mockReturnValue(true);
            await renderExpanded();

            expect(screen.queryByRole('button', {name: 'Add passkey'})).not.toBeInTheDocument();
        });

        test('is hidden when embedded (list still shows)', async () => {
            isEmbeddedMock.mockReturnValue(true);
            await renderExpanded();

            expect(screen.getByText('Laptop')).toBeInTheDocument();
            expect(screen.queryByRole('button', {name: 'Add passkey'})).not.toBeInTheDocument();
            expect(screen.queryByRole('button', {name: 'Sign in again'})).not.toBeInTheDocument();
        });

        test('at the limit shows the limit text instead of the control', async () => {
            getPasskeys.mockResolvedValue(manyPasskeys);
            renderWithContext(
                <PasskeySection
                    {...baseProps}
                    active={true}
                />,
                enabledState,
            );

            expect(await screen.findByText('You have reached the limit of 10 passkeys. Delete one to add another.')).toBeInTheDocument();
            expect(screen.queryByRole('button', {name: 'Add passkey'})).not.toBeInTheDocument();
        });

        test('registers a passkey with the trimmed name and refetches the list', async () => {
            await renderExpanded();
            getPasskeys.mockClear();

            await userEvent.type(screen.getByLabelText('Passkey name'), '  Work laptop  ');
            await clickAdd();

            await waitFor(() => expect(finishRegistration).toHaveBeenCalled());
            expect(beginRegistration).toHaveBeenCalledWith('me');
            const options = create.mock.calls[0][0].publicKey;
            expect(options.challenge).toBeInstanceOf(ArrayBuffer);
            expect(finishRegistration).toHaveBeenCalledWith('me', 'cer1', 'Work laptop', expect.objectContaining({id: 'cred1', rawId: 'AQI'}));
            await waitFor(() => expect(screen.getByLabelText('Passkey name')).toHaveValue(''));
            expect(getPasskeys).toHaveBeenCalledWith('me');
        });

        test('disables the button while the ceremony runs', async () => {
            let resolveCreate: (v: unknown) => void = () => {};
            create.mockReturnValue(new Promise((r) => {
                resolveCreate = r;
            }));
            await renderExpanded();

            await clickAdd();

            const button = screen.getByRole('button', {name: 'Add passkey'});
            expect(button).toBeDisabled();

            // compass Button renders its spinner in an aria-hidden slot.
            expect(button.querySelector('[aria-hidden="true"]')).not.toBeNull();
            resolveCreate(rawCredential);
            await waitFor(() => expect(screen.getByRole('button', {name: 'Add passkey'})).toBeEnabled());
        });

        test.each([
            ['begin', () => beginRegistration],
            ['finish', () => finishRegistration],
        ])('switches to Sign in again when %s is refused as recent-login-required', async (_name, spy) => {
            spy().mockRejectedValue({server_error_id: 'app.passkey.recent_login_required.app_error', message: 'server text'});
            await renderExpanded();

            await clickAdd();

            expect(await screen.findByRole('button', {name: 'Sign in again'})).toBeInTheDocument();
            expect(screen.getByText('To add a passkey, sign in again first.')).toBeInTheDocument();
            expect(screen.queryByText('server text')).not.toBeInTheDocument();
            expect(screen.queryByRole('button', {name: 'Add passkey'})).not.toBeInTheDocument();
        });

        test.each([
            ['limit reached', 'app.passkey.limit_reached.app_error', 'You already have the maximum number of passkeys.'],
            ['name too long', 'app.passkey.name_too_long.app_error', 'Passkey name is too long.'],
        ])('shows the server message when finish is refused: %s', async (_name, id, message) => {
            finishRegistration.mockRejectedValue({server_error_id: id, message});
            await renderExpanded();

            await clickAdd();

            expect(await screen.findByText(message)).toBeInTheDocument();
            expect(screen.getByRole('button', {name: 'Add passkey'})).toBeEnabled();
        });

        test('shows the server message when begin fails', async () => {
            beginRegistration.mockRejectedValue({server_error_id: 'app.passkey.limit_reached.app_error', message: 'limit hit'});
            await renderExpanded();

            await clickAdd();

            expect(await screen.findByText('limit hit')).toBeInTheDocument();
            expect(create).not.toHaveBeenCalled();
        });

        test.each(['NotAllowedError', 'AbortError'])('%s from the browser prompt is not an error', async (name) => {
            create.mockRejectedValue(domError(name));
            await renderExpanded();

            await userEvent.type(screen.getByLabelText('Passkey name'), 'Keep me');
            await clickAdd();

            await waitFor(() => expect(create).toHaveBeenCalled());
            await waitFor(() => expect(screen.getByRole('button', {name: 'Add passkey'})).toBeEnabled());
            expect(finishRegistration).not.toHaveBeenCalled();
            expect(screen.getByLabelText('Passkey name')).toHaveValue('Keep me');
            expect(screen.queryByText(/passkey for your account/)).not.toBeInTheDocument();
            expect(document.querySelector('.has-error')).not.toBeInTheDocument();
        });

        test.each([
            ['403 recent login required', 403, 'app.passkey.recent_login_required.app_error', 'To add a passkey, sign in again first.'],
            ['400 limit reached', 400, 'app.passkey.limit_reached.app_error', 'limit text'],
        ])('tells the browser to forget the new passkey when finish is refused: %s', async (_name, status, id, text) => {
            finishRegistration.mockRejectedValue({server_error_id: id, status_code: status, message: 'limit text'});
            await renderExpanded();

            await clickAdd();

            expect(await screen.findByText(text)).toBeInTheDocument();
            expect(signalUnknownCredential).toHaveBeenCalledTimes(1);
            expect(signalUnknownCredential).toHaveBeenCalledWith({rpId: 'example.com', credentialId: 'cred1'});
        });

        test.each([
            ['the credential is already registered', {server_error_id: 'app.passkey.already_registered.app_error', status_code: 400, message: 'already there'}, 'already there'],
            ['the server fails with a 5xx', {server_error_id: 'app.passkey.save.app_error', status_code: 500, message: 'server broke'}, 'server broke'],
            ['the error has no server_error_id', {message: 'network down'}, 'network down'],
        ])('does not forget the passkey when %s', async (_name, error, text) => {
            finishRegistration.mockRejectedValue(error);
            await renderExpanded();

            await clickAdd();

            expect(await screen.findByText(text)).toBeInTheDocument();
            expect(signalUnknownCredential).not.toHaveBeenCalled();
        });

        test('records the user as enrolled in this browser after a successful add', async () => {
            localStorage.clear();
            await renderExpanded();
            expect(LocalStorageStore.isPasskeyPromptDue('me', 'login')).toBe(true);
            await userEvent.type(screen.getByLabelText('Passkey name'), 'Work');

            await clickAdd();

            await waitFor(() => expect(screen.getByLabelText('Passkey name')).toHaveValue(''));
            expect(LocalStorageStore.isPasskeyPromptDue('me', 'login')).toBe(false);
            expect(LocalStorageStore.isPasskeyPromptDue('other', 'login')).toBe(true);
        });

        test('does not record the user as enrolled when the browser prompt is dismissed', async () => {
            localStorage.clear();
            create.mockRejectedValue(domError('NotAllowedError'));
            await renderExpanded();

            await clickAdd();

            await waitFor(() => expect(screen.getByRole('button', {name: 'Add passkey'})).toBeEnabled());
            expect(LocalStorageStore.isPasskeyPromptDue('me', 'login')).toBe(true);
        });

        test('still adds the passkey when storage cannot record it', async () => {
            localStorage.clear();
            jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
                throw new Error('blocked');
            });
            jest.spyOn(console, 'warn').mockImplementation(() => {});
            await renderExpanded();
            getPasskeys.mockClear();
            await userEvent.type(screen.getByLabelText('Passkey name'), 'Work');

            await clickAdd();

            await waitFor(() => expect(screen.getByLabelText('Passkey name')).toHaveValue(''));
            expect(getPasskeys).toHaveBeenCalledWith('me');
        });

        test('does not forget anything when begin is refused', async () => {
            beginRegistration.mockRejectedValue({server_error_id: 'app.passkey.limit_reached.app_error', status_code: 400, message: 'limit hit'});
            await renderExpanded();

            await clickAdd();

            expect(await screen.findByText('limit hit')).toBeInTheDocument();
            expect(signalUnknownCredential).not.toHaveBeenCalled();
        });

        test('does not forget anything when the browser prompt is dismissed', async () => {
            create.mockRejectedValue(domError('NotAllowedError'));
            await renderExpanded();

            await clickAdd();

            await waitFor(() => expect(screen.getByRole('button', {name: 'Add passkey'})).toBeEnabled());
            expect(signalUnknownCredential).not.toHaveBeenCalled();
        });

        test('does not forget the passkey after a successful add', async () => {
            await renderExpanded();
            await userEvent.type(screen.getByLabelText('Passkey name'), 'Work');

            await clickAdd();

            await waitFor(() => expect(screen.getByLabelText('Passkey name')).toHaveValue(''));
            expect(signalUnknownCredential).not.toHaveBeenCalled();
        });

        test('InvalidStateError says the device already has a passkey', async () => {
            create.mockRejectedValue(domError('InvalidStateError'));
            await renderExpanded();

            await clickAdd();

            expect(await screen.findByText('This device already has a passkey for your account.')).toBeInTheDocument();
            expect(finishRegistration).not.toHaveBeenCalled();
        });
    });
});
