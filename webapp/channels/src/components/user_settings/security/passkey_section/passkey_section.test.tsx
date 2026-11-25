// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {isDesktopApp} from '@mattermost/shared/utils/user_agent';
import type {Passkey} from '@mattermost/types/passkeys';

import {Client4} from 'mattermost-redux/client';

import LocalStorageStore from 'stores/local_storage_store';

import {renderWithContext, screen, userEvent, waitFor, within} from 'tests/react_testing_utils';

import PasskeySection from './index';

jest.mock('@mattermost/shared/utils/user_agent', () => ({
    isDesktopApp: jest.fn(() => false),
}));

const isDesktopAppMock = jest.mocked(isDesktopApp);

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

    beforeEach(() => {
        getPasskeys = jest.spyOn(Client4, 'getPasskeys').mockResolvedValue(passkeys);
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
        expect(screen.getByText('Never used')).toBeInTheDocument();
        expect(screen.getByText(/Last used Mar 5, 2025/)).toBeInTheDocument();
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

    describe('adding a passkey', () => {
        let beginRegistration: jest.SpyInstance;
        let finishRegistration: jest.SpyInstance;
        let create: jest.Mock;
        let signalUnknownCredential: jest.Mock;

        const renderExpanded = async () => {
            renderWithContext(
                <PasskeySection
                    {...baseProps}
                    active={true}
                />,
                enabledState,
            );
            await screen.findByText('Laptop');
        };

        const clickAdd = () => userEvent.click(screen.getByRole('button', {name: 'Add passkey'}));

        beforeEach(() => {
            isDesktopAppMock.mockReturnValue(false);
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

            expect(screen.getByRole('button', {name: 'Add passkey'})).toBeDisabled();
            resolveCreate(rawCredential);
            await waitFor(() => expect(screen.getByRole('button', {name: 'Add passkey'})).toBeEnabled());
        });

        test.each([
            ['begin', () => beginRegistration],
            ['finish', () => finishRegistration],
        ])('tells the user to sign in again when %s is refused as recent-login-required', async (_name, spy) => {
            spy().mockRejectedValue({server_error_id: 'app.passkey.recent_login_required.app_error', message: 'server text'});
            await renderExpanded();

            await clickAdd();

            expect(await screen.findByText('For your security, sign out and sign back in, then add your passkey within 10 minutes.')).toBeInTheDocument();
            expect(screen.queryByText('server text')).not.toBeInTheDocument();
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
            ['403 recent login required', 403, 'app.passkey.recent_login_required.app_error', 'For your security, sign out and sign back in, then add your passkey within 10 minutes.'],
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

        test('records this browser as enrolled after a successful add', async () => {
            localStorage.clear();
            await renderExpanded();
            expect(LocalStorageStore.isPasskeyPromptDue('login')).toBe(true);
            await userEvent.type(screen.getByLabelText('Passkey name'), 'Work');

            await clickAdd();

            await waitFor(() => expect(screen.getByLabelText('Passkey name')).toHaveValue(''));
            expect(LocalStorageStore.isPasskeyPromptDue('login')).toBe(false);
        });

        test('does not record this browser as enrolled when the browser prompt is dismissed', async () => {
            localStorage.clear();
            create.mockRejectedValue(domError('NotAllowedError'));
            await renderExpanded();

            await clickAdd();

            await waitFor(() => expect(screen.getByRole('button', {name: 'Add passkey'})).toBeEnabled());
            expect(LocalStorageStore.isPasskeyPromptDue('login')).toBe(true);
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
