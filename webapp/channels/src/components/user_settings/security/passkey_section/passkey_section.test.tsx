// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Passkey} from '@mattermost/types/passkeys';

import {Client4} from 'mattermost-redux/client';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import PasskeySection from './index';

const passkeys: Passkey[] = [
    {id: 'pk1', user_id: 'me', name: 'Laptop', create_at: Date.UTC(2025, 0, 15, 12), last_used_at: 0},
    {id: 'pk2', user_id: 'me', name: 'Phone', create_at: Date.UTC(2025, 1, 20, 12), last_used_at: Date.UTC(2025, 2, 5, 12)},
];

const enabledState = {
    entities: {
        general: {
            config: {FeatureFlagPasskeys: 'true'},
            license: {IsLicensed: 'true', SkuShortName: 'professional'},
        },
    },
};

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
});
