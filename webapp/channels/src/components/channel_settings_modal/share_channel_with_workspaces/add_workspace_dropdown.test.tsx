// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';

import type {RemoteCluster} from '@mattermost/types/remote_clusters';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import AddWorkspaceDropdown from './add_workspace_dropdown';

const mockRemoteClusters: RemoteCluster[] = [
    {
        remote_id: 'remote1',
        name: 'nebula',
        display_name: 'Nebula Networks',
        remote_team_id: '',
        site_url: 'https://nebula.example.com',
        create_at: 0,
        delete_at: 0,
        last_ping_at: 0,
        topics: '',
        creator_id: '',
        plugin_id: '',
        options: 0,
        default_team_id: '',
    },
    {
        remote_id: 'remote2',
        name: 'cascade',
        display_name: 'Cascade Collaborative',
        remote_team_id: '',
        site_url: 'https://cascade.example.com',
        create_at: 0,
        delete_at: 0,
        last_ping_at: 0,
        topics: '',
        creator_id: '',
        plugin_id: '',
        options: 0,
        default_team_id: '',
    },
];

describe('AddWorkspaceDropdown', () => {
    const defaultProps: ComponentProps<typeof AddWorkspaceDropdown> = {
        currentRemoteIds: new Set<string>(),
        onAdd: jest.fn(),
        remoteClusters: mockRemoteClusters,
    };

    it('should render Add workspace button', () => {
        renderWithContext(<AddWorkspaceDropdown {...defaultProps}/>);

        expect(screen.getByRole('button', {name: /Add workspace/i})).toBeInTheDocument();
    });

    it('should show workspace list when menu opens', async () => {
        renderWithContext(<AddWorkspaceDropdown {...defaultProps}/>);

        await userEvent.click(screen.getByRole('button', {name: /Add workspace/i}));

        expect(screen.getByText('Nebula Networks')).toBeInTheDocument();
        expect(screen.getByText('Cascade Collaborative')).toBeInTheDocument();
    });

    it('should call onAdd when workspace is clicked', async () => {
        renderWithContext(<AddWorkspaceDropdown {...defaultProps}/>);

        await userEvent.click(screen.getByRole('button', {name: /Add workspace/i}));

        expect(screen.getByText('Nebula Networks')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('menuitem', {name: 'Nebula Networks'}));

        await waitFor(() => {
            expect(defaultProps.onAdd).toHaveBeenCalledWith(
                {remote_id: 'remote1', display_name: 'Nebula Networks'},
            );
        });
    });

    it('should show empty message when all workspaces are already added', async () => {
        const propsWithCurrent = {
            ...defaultProps,
            currentRemoteIds: new Set(['remote1', 'remote2']),
        };

        renderWithContext(<AddWorkspaceDropdown {...propsWithCurrent}/>);

        await userEvent.click(screen.getByRole('button', {name: /Add workspace/i}));

        expect(screen.getByText(/No other connected workspaces available/)).toBeInTheDocument();
    });

    it('should show loading when remoteClusters is null', async () => {
        renderWithContext(
            <AddWorkspaceDropdown
                {...defaultProps}
                remoteClusters={null}
            />,
        );

        await userEvent.click(screen.getByRole('button', {name: /Add workspace/i}));

        expect(screen.getByText(/Loading workspaces/)).toBeInTheDocument();
    });
});
