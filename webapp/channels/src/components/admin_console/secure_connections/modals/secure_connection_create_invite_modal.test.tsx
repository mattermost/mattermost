// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {waitFor} from '@testing-library/react';
import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import SecureConnectionCreateInviteModal from './secure_connection_create_invite_modal';

const remoteCluster = TestHelper.getRemoteClusterMock({
    remote_id: 'rc-1',
    display_name: 'Acme',
});

const shareResult = {
    remoteCluster,
    share: {invite: 'INVITE_CODE_XYZ', password: 'pa$$w0rd'},
};

describe('SecureConnectionCreateInviteModal', () => {
    it('calls onConfirm on mount and renders the invite + password inputs once resolved', async () => {
        const onConfirm = jest.fn().mockResolvedValue(shareResult);

        renderWithContext(
            <SecureConnectionCreateInviteModal
                onConfirm={onConfirm}
                onCancel={jest.fn()}
                onExited={jest.fn()}
            />,
        );

        expect(onConfirm).toHaveBeenCalledTimes(1);

        await waitFor(() => {
            expect(screen.getByTestId('invite-code')).toHaveValue('INVITE_CODE_XYZ');
        });
        expect(screen.getByTestId('password')).toHaveValue('pa$$w0rd');
    });

    it('shows the "Connection created" title when creating and resolved', async () => {
        const onConfirm = jest.fn().mockResolvedValue(shareResult);

        renderWithContext(
            <SecureConnectionCreateInviteModal
                creating={true}
                onConfirm={onConfirm}
                onCancel={jest.fn()}
                onExited={jest.fn()}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText('Connection created')).toBeInTheDocument();
        });
    });

    it('shows the default "Invitation code" title when not creating', async () => {
        const onConfirm = jest.fn().mockResolvedValue(shareResult);

        renderWithContext(
            <SecureConnectionCreateInviteModal
                onConfirm={onConfirm}
                onCancel={jest.fn()}
                onExited={jest.fn()}
            />,
        );

        await waitFor(() => {
            expect(screen.getByRole('heading', {name: 'Invitation code'})).toBeInTheDocument();
        });
    });

    it('flips the confirm button label from "Save" to "Done" once both invite and password are populated', async () => {
        let resolveConfirm!: (value: typeof shareResult) => void;
        const onConfirm = jest.fn(() => new Promise<typeof shareResult>((resolve) => {
            resolveConfirm = resolve;
        }));

        renderWithContext(
            <SecureConnectionCreateInviteModal
                onConfirm={onConfirm}
                onCancel={jest.fn()}
                onExited={jest.fn()}
            />,
        );

        // Pre-resolve: button shows "Save" (the not-done label) and "Done" is absent.
        expect(screen.queryByRole('button', {name: 'Done'})).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Save'})).toBeInTheDocument();

        // Resolve onConfirm; label flips to "Done".
        resolveConfirm(shareResult);
        await waitFor(() => {
            expect(screen.getByRole('button', {name: 'Done'})).toBeInTheDocument();
        });
        expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();
    });

    it('renders the security warning notice when done', async () => {
        const onConfirm = jest.fn().mockResolvedValue(shareResult);

        renderWithContext(
            <SecureConnectionCreateInviteModal
                onConfirm={onConfirm}
                onCancel={jest.fn()}
                onExited={jest.fn()}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText('Share these two separately to avoid a security compromise')).toBeInTheDocument();
        });
    });

    it('does not invoke onConfirm again when the Done button is clicked', async () => {
        const onConfirm = jest.fn().mockResolvedValue(shareResult);
        const user = userEvent.setup();

        renderWithContext(
            <SecureConnectionCreateInviteModal
                onConfirm={onConfirm}
                onCancel={jest.fn()}
                onExited={jest.fn()}
            />,
        );

        await waitFor(() => {
            expect(screen.getByRole('button', {name: 'Done'})).toBeInTheDocument();
        });
        expect(onConfirm).toHaveBeenCalledTimes(1);

        await user.click(screen.getByRole('button', {name: 'Done'}));

        expect(onConfirm).toHaveBeenCalledTimes(1);
    });
});
