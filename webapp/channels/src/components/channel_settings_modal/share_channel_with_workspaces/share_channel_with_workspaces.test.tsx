// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import ShareChannelWithWorkspaces from './share_channel_with_workspaces';

jest.mock('mattermost-redux/client', () => ({
    Client4: {
        getRemoteClusters: jest.fn().mockResolvedValue([
            {remote_id: 'remote1', name: 'nebula', display_name: 'Nebula Networks'},
            {remote_id: 'remote2', name: 'cascade', display_name: 'Cascade Collaborative'},
        ]),
    },
}));

const mockRemotes = [
    {
        remote_id: 'remote1',
        name: 'remote1',
        display_name: 'Nebula Networks',
        create_at: 0,
        delete_at: 0,
        last_ping_at: Date.now(),
        site_url: 'https://nebula.example.com',
    },
    {
        remote_id: 'remote2',
        name: 'remote2',
        display_name: 'Cascade Collaborative',
        create_at: 0,
        delete_at: 0,
        last_ping_at: Date.now(),
        site_url: 'https://cascade.example.com',
    },
];

describe('ShareChannelWithWorkspaces', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (require('mattermost-redux/client').Client4.getRemoteClusters as jest.Mock).mockResolvedValue([
            {remote_id: 'remote1', name: 'nebula', display_name: 'Nebula Networks'},
            {remote_id: 'remote2', name: 'cascade', display_name: 'Cascade Collaborative'},
        ]);
    });

    it('should render with toggle off when no remotes', () => {
        const onRemotesChange = jest.fn();
        renderWithContext(
            <ShareChannelWithWorkspaces
                remotes={[]}
                onRemotesChange={onRemotesChange}
            />,
        );

        expect(screen.getByText('Share with connected workspaces')).toBeInTheDocument();
        expect(screen.getByText('Collaborate with trusted organizations in this channel. Connections must first be defined by a system administrator.')).toBeInTheDocument();
        const toggle = screen.getByTestId('shareChannelWithWorkspacesToggle-button');
        expect(toggle).not.toHaveClass('active');
    });

    it('should render with toggle on when remotes exist', () => {
        const onRemotesChange = jest.fn();
        renderWithContext(
            <ShareChannelWithWorkspaces
                remotes={mockRemotes}
                onRemotesChange={onRemotesChange}
            />,
        );

        const toggle = screen.getByTestId('shareChannelWithWorkspacesToggle-button');
        expect(toggle).toHaveClass('active');
        expect(screen.getByText('Nebula Networks')).toBeInTheDocument();
    });

    it('should show workspace list and Add workspace button when toggle is on', async () => {
        const onRemotesChange = jest.fn();
        renderWithContext(
            <ShareChannelWithWorkspaces
                remotes={[]}
                onRemotesChange={onRemotesChange}
            />,
        );

        const toggle = screen.getByTestId('shareChannelWithWorkspacesToggle-button');
        await userEvent.click(toggle);

        expect(screen.getByText('No workspaces sharing this channel yet.')).toBeInTheDocument();
        expect(screen.getByText('Add workspace')).toBeInTheDocument();
    });

    it('should open Add workspace dropdown when Add workspace is clicked', async () => {
        const onRemotesChange = jest.fn();
        renderWithContext(
            <ShareChannelWithWorkspaces
                remotes={[]}
                onRemotesChange={onRemotesChange}
            />,
        );

        await userEvent.click(screen.getByTestId('shareChannelWithWorkspacesToggle-button'));
        await userEvent.click(screen.getByRole('button', {name: /Add workspace/i}));

        await waitFor(() => {
            expect(screen.getByRole('menuitem', {name: 'Nebula Networks'})).toBeInTheDocument();
        });
    });

    it('should add workspace and call onRemotesChange when dropdown item is selected', async () => {
        const onRemotesChange = jest.fn();
        renderWithContext(
            <ShareChannelWithWorkspaces
                remotes={[]}
                onRemotesChange={onRemotesChange}
            />,
        );

        await userEvent.click(screen.getByTestId('shareChannelWithWorkspacesToggle-button'));
        await userEvent.click(screen.getByRole('button', {name: /Add workspace/i}));

        await waitFor(() => {
            expect(screen.getByRole('menuitem', {name: 'Nebula Networks'})).toBeInTheDocument();
        });
        await userEvent.click(screen.getByRole('menuitem', {name: 'Nebula Networks'}));

        await waitFor(() => {
            expect(onRemotesChange).toHaveBeenCalled();
        });
        expect(screen.getByText('Nebula Networks')).toBeInTheDocument();
        expect(screen.getByText('Pending save')).toBeInTheDocument();
    });

    it('should show Connected status for existing remotes', () => {
        renderWithContext(
            <ShareChannelWithWorkspaces
                remotes={mockRemotes}
                onRemotesChange={jest.fn()}
            />,
        );

        expect(screen.getByText('Nebula Networks')).toBeInTheDocument();
        expect(screen.getAllByText('Connected').length).toBeGreaterThan(0);
    });

    it('should show connection status when re-adding a removed workspace without saving', async () => {
        const onRemotesChange = jest.fn();
        renderWithContext(
            <ShareChannelWithWorkspaces
                remotes={mockRemotes}
                initialRemotes={mockRemotes}
                onRemotesChange={onRemotesChange}
            />,
        );

        await userEvent.click(screen.getByRole('button', {name: /Remove Nebula Networks/i}));
        await userEvent.click(screen.getByRole('button', {name: /Add workspace/i}));

        await waitFor(() => {
            expect(screen.getByRole('menuitem', {name: 'Nebula Networks'})).toBeInTheDocument();
        });
        await userEvent.click(screen.getByRole('menuitem', {name: 'Nebula Networks'}));

        expect(screen.getByText('Nebula Networks')).toBeInTheDocument();
        expect(screen.getAllByText('Connected').length).toBeGreaterThan(0);
        expect(screen.queryByText('Pending save')).not.toBeInTheDocument();
    });

    it('should remove workspace when remove button is clicked', async () => {
        const onRemotesChange = jest.fn();
        renderWithContext(
            <ShareChannelWithWorkspaces
                remotes={mockRemotes}
                onRemotesChange={onRemotesChange}
            />,
        );

        const removeButton = screen.getByRole('button', {name: /Remove Nebula Networks/i});
        await userEvent.click(removeButton);

        expect(onRemotesChange).toHaveBeenCalled();
    });
});
