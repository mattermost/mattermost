// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import SyncStatusFooter from './sync_status_footer';

const mockGetJobsByType = jest.fn();
const mockCreateSyncJob = jest.fn();

jest.mock('mattermost-redux/actions/jobs', () => ({
    getJobsByType: (...args: any[]) => mockGetJobsByType(...args),
}));

jest.mock('mattermost-redux/actions/access_control', () => ({
    createAccessControlSyncJob: (...args: any[]) => mockCreateSyncJob(...args),
}));

describe('SyncStatusFooter', () => {
    beforeEach(() => {
        mockGetJobsByType.mockReset();
        mockCreateSyncJob.mockReset();
        mockGetJobsByType.mockReturnValue({type: 'MOCK', data: []});
        mockCreateSyncJob.mockReturnValue({type: 'MOCK', data: {}});
    });

    test('should not render when hasPolicies is false', () => {
        renderWithContext(
            <SyncStatusFooter
                teamId='team1'
                hasPolicies={false}
            />,
        );
        expect(screen.queryByText(/synced/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Sync now/i)).not.toBeInTheDocument();
    });

    test('should show "Never synced" when no completed jobs exist', async () => {
        mockGetJobsByType.mockReturnValue({type: 'MOCK', data: []});
        renderWithContext(
            <SyncStatusFooter
                teamId='team1'
                hasPolicies={true}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText(/Never synced/i)).toBeInTheDocument();
        });
        expect(screen.getByText(/Sync now/i)).toBeInTheDocument();
    });

    test('should show relative time when a completed job exists', async () => {
        const recentJob = {
            id: 'job1',
            status: 'success',
            last_activity_at: Date.now() - (5 * 60000), // 5 minutes ago
            data: {team_id: 'team1'},
        };
        mockGetJobsByType.mockReturnValue({type: 'MOCK', data: [recentJob]});
        renderWithContext(
            <SyncStatusFooter
                teamId='team1'
                hasPolicies={true}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText(/Last synced 5 minutes ago/i)).toBeInTheDocument();
        });
    });

    test('should show "Syncing..." after clicking Sync now', async () => {
        mockGetJobsByType.mockReturnValue({type: 'MOCK', data: []});
        renderWithContext(
            <SyncStatusFooter
                teamId='team1'
                hasPolicies={true}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText(/Sync now/i)).toBeInTheDocument();
        });

        await userEvent.click(screen.getByText(/Sync now/i));

        await waitFor(() => {
            expect(screen.getByText(/Syncing/i)).toBeInTheDocument();
        });
    });

    test('should revert to "Sync now" when job creation returns an error', async () => {
        mockGetJobsByType.mockReturnValue({type: 'MOCK', data: []});
        mockCreateSyncJob.mockReturnValue({type: 'MOCK', error: {message: 'server error'}});
        renderWithContext(
            <SyncStatusFooter
                teamId='team1'
                hasPolicies={true}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText(/Sync now/i)).toBeInTheDocument();
        });

        await userEvent.click(screen.getByText(/Sync now/i));

        await waitFor(() => {
            expect(screen.getByText(/Sync now/i)).toBeInTheDocument();
        });
        expect(screen.queryByText(/Syncing/i)).not.toBeInTheDocument();
    });

    test('should fetch jobs with teamId parameter', async () => {
        mockGetJobsByType.mockReturnValue({type: 'MOCK', data: []});
        renderWithContext(
            <SyncStatusFooter
                teamId='team123'
                hasPolicies={true}
            />,
        );

        await waitFor(() => {
            expect(mockGetJobsByType).toHaveBeenCalledWith('access_control_sync', 0, 10, 'team123');
        });
    });
});
