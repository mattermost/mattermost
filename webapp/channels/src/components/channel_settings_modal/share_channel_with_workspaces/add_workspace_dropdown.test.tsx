// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import AddWorkspaceDropdown from './add_workspace_dropdown';

jest.mock('mattermost-redux/client', () => ({
    Client4: {
        getRemoteClusters: jest.fn().mockResolvedValue([
            {
                remote_id: 'remote1',
                name: 'nebula',
                display_name: 'Nebula Networks',
            },
            {
                remote_id: 'remote2',
                name: 'cascade',
                display_name: 'Cascade Collaborative',
            },
        ]),
    },
}));

describe('AddWorkspaceDropdown', () => {
    const defaultProps: ComponentProps<typeof AddWorkspaceDropdown> = {
        currentRemoteIds: new Set<string>(),
        onAdd: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (require('mattermost-redux/client').Client4.getRemoteClusters as jest.Mock).mockResolvedValue([
            {
                remote_id: 'remote1',
                name: 'nebula',
                display_name: 'Nebula Networks',
            },
            {
                remote_id: 'remote2',
                name: 'cascade',
                display_name: 'Cascade Collaborative',
            },
        ]);
    });

    it('should render Add workspace button', () => {
        renderWithContext(<AddWorkspaceDropdown {...defaultProps}/>);

        expect(screen.getByRole('button', {name: /Add workspace/i})).toBeInTheDocument();
    });

    it('should show workspace list when menu opens', async () => {
        renderWithContext(<AddWorkspaceDropdown {...defaultProps}/>);

        await userEvent.click(screen.getByRole('button', {name: /Add workspace/i}));

        await waitFor(() => {
            expect(screen.getByText('Nebula Networks')).toBeInTheDocument();
        });

        expect(screen.getByText('Cascade Collaborative')).toBeInTheDocument();
    });

    it('should call onAdd when workspace is clicked', async () => {
        renderWithContext(<AddWorkspaceDropdown {...defaultProps}/>);

        await userEvent.click(screen.getByRole('button', {name: /Add workspace/i}));

        await waitFor(() => {
            expect(screen.getByText('Nebula Networks')).toBeInTheDocument();
        });

        await userEvent.click(screen.getByRole('menuitem', {name: 'Nebula Networks'}));

        await waitFor(() => {
            expect(defaultProps.onAdd).toHaveBeenCalledWith([
                {remote_id: 'remote1', display_name: 'Nebula Networks'},
            ]);
        });
    });

    it('should show empty message when all workspaces are already added', async () => {
        const propsWithCurrent = {
            ...defaultProps,
            currentRemoteIds: new Set(['remote1', 'remote2']),
        };

        renderWithContext(<AddWorkspaceDropdown {...propsWithCurrent}/>);

        await userEvent.click(screen.getByRole('button', {name: /Add workspace/i}));

        await waitFor(() => {
            expect(screen.getByText(/All connected workspaces are already sharing this channel/)).toBeInTheDocument();
        });
    });

    it('should show error when getRemoteClusters fails', async () => {
        (require('mattermost-redux/client').Client4.getRemoteClusters as jest.Mock).mockRejectedValue(new Error('Network error'));

        renderWithContext(<AddWorkspaceDropdown {...defaultProps}/>);

        await userEvent.click(screen.getByRole('button', {name: /Add workspace/i}));

        await waitFor(() => {
            expect(screen.getByText('Network error')).toBeInTheDocument();
        });
    });
});
