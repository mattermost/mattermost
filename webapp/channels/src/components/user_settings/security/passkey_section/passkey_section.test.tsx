// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {isDesktopApp} from '@mattermost/shared/utils/user_agent';
import type {Passkey} from '@mattermost/types/passkeys';

import {Client4} from 'mattermost-redux/client';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import PasskeySection from './index';

jest.mock('@mattermost/shared/utils/user_agent', () => ({
    isDesktopApp: jest.fn(() => false),
}));

const isDesktopAppMock = jest.mocked(isDesktopApp);

const passkeys: Passkey[] = [
    {id: 'pk1', user_id: 'me', name: 'Laptop', create_at: Date.UTC(2025, 0, 15, 12), last_used_at: 0},
    {id: 'pk2', user_id: 'me', name: 'Phone', create_at: Date.UTC(2025, 1, 20, 12), last_used_at: Date.UTC(2025, 2, 5, 12)},
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
    id: `pk${i}`, user_id: 'me', name: `Key ${i}`, create_at: Date.UTC(2025, 0, 1), last_used_at: 0,
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
            Object.defineProperty(window, 'PublicKeyCredential', {value: function PublicKeyCredential() {}, configurable: true});
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

            await screen.findByText('Laptop');
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
            await waitFor(() => expect(getPasskeys).toHaveBeenCalledWith('me'));
            expect(screen.getByLabelText('Passkey name')).toHaveValue('');
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

        test('InvalidStateError says the device already has a passkey', async () => {
            create.mockRejectedValue(domError('InvalidStateError'));
            await renderExpanded();

            await clickAdd();

            expect(await screen.findByText('This device already has a passkey for your account.')).toBeInTheDocument();
            expect(finishRegistration).not.toHaveBeenCalled();
        });
    });
});
