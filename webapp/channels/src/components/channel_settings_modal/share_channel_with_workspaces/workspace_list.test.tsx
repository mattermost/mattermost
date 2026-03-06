// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import type {WorkspaceWithStatus} from './types';
import WorkspaceList from './workspace_list';

jest.mock('utils/remote_cluster_connection', () => ({
    getRemoteClusterConnectionStatus: jest.fn(() => 'connected' as const),
}));

const baseWorkspace: WorkspaceWithStatus = {
    remote_id: 'remote1',
    name: 'nebula',
    display_name: 'Nebula Networks',
    create_at: 0,
    delete_at: 0,
    last_ping_at: Date.now(),
    site_url: 'https://nebula.example.com',
};

describe('WorkspaceList', () => {
    it('returns null when workspaces is empty', () => {
        const {container} = renderWithContext(
            <WorkspaceList
                workspaces={[]}
                onRemove={jest.fn()}
            />,
        );

        expect(container.firstChild).toBeNull();
    });

    it('renders workspace names and remove button for each workspace', () => {
        const onRemove = jest.fn();
        const workspaces: WorkspaceWithStatus[] = [
            baseWorkspace,
            {
                ...baseWorkspace,
                remote_id: 'remote2',
                name: 'cascade',
                display_name: 'Cascade Collaborative',
            },
        ];

        renderWithContext(
            <WorkspaceList
                workspaces={workspaces}
                onRemove={onRemove}
            />,
        );

        expect(screen.getByText('Nebula Networks')).toBeInTheDocument();
        expect(screen.getByText('Cascade Collaborative')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /Remove Nebula Networks/i})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /Remove Cascade Collaborative/i})).toBeInTheDocument();
    });

    it('uses name when display_name is missing', () => {
        const workspaces: WorkspaceWithStatus[] = [
            {
                ...baseWorkspace,
                display_name: undefined as any,
                name: 'fallback-name',
            },
        ];

        renderWithContext(
            <WorkspaceList
                workspaces={workspaces}
                onRemove={jest.fn()}
            />,
        );

        expect(screen.getByText('fallback-name')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /Remove fallback-name/i})).toBeInTheDocument();
    });

    it('shows Pending save when workspace has pendingSave', () => {
        const workspaces: WorkspaceWithStatus[] = [
            {...baseWorkspace, pendingSave: true},
        ];

        renderWithContext(
            <WorkspaceList
                workspaces={workspaces}
                onRemove={jest.fn()}
            />,
        );

        expect(screen.getByText('Pending save')).toBeInTheDocument();
    });

    it('shows connection status from getRemoteClusterConnectionStatus when not pendingSave', () => {
        const {getRemoteClusterConnectionStatus} = require('utils/remote_cluster_connection');

        getRemoteClusterConnectionStatus.mockReturnValue('connection_pending');
        const workspaces: WorkspaceWithStatus[] = [baseWorkspace];

        const {rerender} = renderWithContext(
            <WorkspaceList
                workspaces={workspaces}
                onRemove={jest.fn()}
            />,
        );
        expect(screen.getByText('Connection Pending')).toBeInTheDocument();

        getRemoteClusterConnectionStatus.mockReturnValue('connected');
        rerender(
            <WorkspaceList
                workspaces={workspaces}
                onRemove={jest.fn()}
            />,
        );
        expect(screen.getByText('Connected')).toBeInTheDocument();

        getRemoteClusterConnectionStatus.mockReturnValue('offline');
        rerender(
            <WorkspaceList
                workspaces={workspaces}
                onRemove={jest.fn()}
            />,
        );
        expect(screen.getByText('Offline')).toBeInTheDocument();
    });

    it('calls onRemove with remote_id when remove button is clicked', async () => {
        const onRemove = jest.fn();
        const workspaces: WorkspaceWithStatus[] = [baseWorkspace];

        renderWithContext(
            <WorkspaceList
                workspaces={workspaces}
                onRemove={onRemove}
            />,
        );

        await userEvent.click(screen.getByRole('button', {name: /Remove Nebula Networks/i}));

        expect(onRemove).toHaveBeenCalledTimes(1);
        expect(onRemove).toHaveBeenCalledWith('remote1');
    });

    it('calls onRemove with name when remote_id is missing', async () => {
        const onRemove = jest.fn();
        const workspaces: WorkspaceWithStatus[] = [
            {
                ...baseWorkspace,
                remote_id: undefined as any,
                name: 'name-as-id',
                display_name: 'Display Name',
            },
        ];

        renderWithContext(
            <WorkspaceList
                workspaces={workspaces}
                onRemove={onRemove}
            />,
        );

        await userEvent.click(screen.getByRole('button', {name: /Remove Display Name/i}));

        expect(onRemove).toHaveBeenCalledWith('name-as-id');
    });
});
