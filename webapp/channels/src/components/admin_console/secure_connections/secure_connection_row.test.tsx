// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {waitFor} from '@testing-library/react';
import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import SecureConnectionRow from './secure_connection_row';

jest.mock('./modals/modal_utils', () => ({
    useRemoteClusterDelete: jest.fn(),
    useRemoteClusterCreateInvite: jest.fn(),
}));

const {useRemoteClusterDelete, useRemoteClusterCreateInvite} = jest.requireMock('./modals/modal_utils');

const promptDelete = jest.fn();
const promptCreateInvite = jest.fn();

const confirmedRC = TestHelper.getRemoteClusterMock({
    remote_id: 'rc-1',
    display_name: 'Acme',
    name: 'acme',
    site_url: 'https://siteurl',
    last_ping_at: 0,
});

const pendingRC = {
    ...confirmedRC,
    site_url: 'pending_https://siteurl',
};

describe('SecureConnectionRow', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        promptDelete.mockResolvedValue(undefined);
        promptCreateInvite.mockResolvedValue(undefined);
        useRemoteClusterDelete.mockReturnValue({promptDelete});
        useRemoteClusterCreateInvite.mockReturnValue({promptCreateInvite});
    });

    it('renders the connection display name and a status label', () => {
        renderWithContext(
            <SecureConnectionRow
                remoteCluster={confirmedRC}
                onDeleteSuccess={jest.fn()}
                disabled={false}
            />,
        );

        expect(screen.getByText('Acme')).toBeInTheDocument();
        expect(screen.getByText('Offline')).toBeInTheDocument();
    });

    it('shows "Connection Pending" for unconfirmed clusters', () => {
        renderWithContext(
            <SecureConnectionRow
                remoteCluster={pendingRC}
                onDeleteSuccess={jest.fn()}
                disabled={false}
            />,
        );

        expect(screen.getByText('Connection Pending')).toBeInTheDocument();
    });

    it('shows "Generate invitation code" when the connection is not yet confirmed', async () => {
        const user = userEvent.setup();

        renderWithContext(
            <SecureConnectionRow
                remoteCluster={pendingRC}
                onDeleteSuccess={jest.fn()}
                disabled={false}
            />,
        );

        await user.click(screen.getByLabelText(/Connection options for/));

        expect(screen.getByRole('menuitem', {name: 'Generate invitation code'})).toBeInTheDocument();
    });

    it('clicking "Generate invitation code" opens the create-invite prompt', async () => {
        const user = userEvent.setup();

        renderWithContext(
            <SecureConnectionRow
                remoteCluster={pendingRC}
                onDeleteSuccess={jest.fn()}
                disabled={false}
            />,
        );

        await user.click(screen.getByLabelText(/Connection options for/));
        await user.click(screen.getByRole('menuitem', {name: 'Generate invitation code'}));

        await waitFor(() => {
            expect(promptCreateInvite).toHaveBeenCalledTimes(1);
        });
    });

    it('hides "Generate invitation code" when the connection is confirmed', async () => {
        const user = userEvent.setup();

        renderWithContext(
            <SecureConnectionRow
                remoteCluster={confirmedRC}
                onDeleteSuccess={jest.fn()}
                disabled={false}
            />,
        );

        await user.click(screen.getByLabelText(/Connection options for/));

        expect(screen.queryByRole('menuitem', {name: 'Generate invitation code'})).not.toBeInTheDocument();
        expect(screen.getByRole('menuitem', {name: 'Edit'})).toBeInTheDocument();
    });

    it('passes the remoteCluster into useRemoteClusterDelete', () => {
        renderWithContext(
            <SecureConnectionRow
                remoteCluster={confirmedRC}
                onDeleteSuccess={jest.fn()}
                disabled={false}
            />,
        );

        expect(useRemoteClusterDelete).toHaveBeenCalledWith(confirmedRC);
        expect(useRemoteClusterCreateInvite).toHaveBeenCalledWith(confirmedRC);
    });

    it('clicking "Delete" calls onDeleteSuccess after promptDelete resolves', async () => {
        const user = userEvent.setup();
        const onDeleteSuccess = jest.fn();

        renderWithContext(
            <SecureConnectionRow
                remoteCluster={confirmedRC}
                onDeleteSuccess={onDeleteSuccess}
                disabled={false}
            />,
        );

        await user.click(screen.getByLabelText(/Connection options for/));
        await user.click(screen.getByRole('menuitem', {name: 'Delete'}));

        await waitFor(() => {
            expect(promptDelete).toHaveBeenCalledTimes(1);
            expect(onDeleteSuccess).toHaveBeenCalled();
        });
    });

    it('does NOT call onDeleteSuccess when the user cancels the delete prompt', async () => {
        const user = userEvent.setup();
        const onDeleteSuccess = jest.fn();

        // Cancellation in the real prompt leaves the promise pending forever
        // (the modal closes without resolving or rejecting).
        promptDelete.mockReturnValueOnce(new Promise(() => {}));

        renderWithContext(
            <SecureConnectionRow
                remoteCluster={confirmedRC}
                onDeleteSuccess={onDeleteSuccess}
                disabled={false}
            />,
        );

        await user.click(screen.getByLabelText(/Connection options for/));
        await user.click(screen.getByRole('menuitem', {name: 'Delete'}));

        await waitFor(() => {
            expect(promptDelete).toHaveBeenCalledTimes(1);
        });
        expect(onDeleteSuccess).not.toHaveBeenCalled();
    });

    it('disables the menu button when disabled', () => {
        renderWithContext(
            <SecureConnectionRow
                remoteCluster={confirmedRC}
                onDeleteSuccess={jest.fn()}
                disabled={true}
            />,
        );

        expect(screen.getByLabelText(/Connection options for/)).toBeDisabled();
    });
});
