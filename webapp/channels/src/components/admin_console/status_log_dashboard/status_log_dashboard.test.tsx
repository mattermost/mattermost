// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {AdminConfig} from '@mattermost/types/config';

import {renderWithContext, screen, waitFor, userEvent} from 'tests/react_testing_utils';

import StatusLogDashboard from './status_log_dashboard';

// Mock the Client4 module
jest.mock('mattermost-redux/client', () => ({
    Client4: {
        getStatusLogs: jest.fn(),
        clearStatusLogs: jest.fn(),
        exportStatusLogs: jest.fn(),
        getProfiles: jest.fn().mockResolvedValue([]),
        getProfilePictureUrl: jest.fn().mockReturnValue('/api/v4/users/test-user/image'),
    },
}));

// Mock the websocket client
jest.mock('client/web_websocket_client', () => ({
    __esModule: true,
    default: {
        addMessageListener: jest.fn(),
        removeMessageListener: jest.fn(),
    },
}));

// Mock ProfilePicture component
jest.mock('components/profile_picture', () => ({
    __esModule: true,
    default: ({username}: {username: string}) => <div data-testid='profile-picture'>{username}</div>,
}));

// Mock Timestamp component
jest.mock('components/timestamp', () => ({
    __esModule: true,
    default: ({value}: {value: number}) => <span data-testid='timestamp'>{new Date(value).toISOString()}</span>,
}));

// Mock StatusNotificationRules component
jest.mock('./status_notification_rules', () => ({
    __esModule: true,
    default: () => <div data-testid='status-notification-rules'>Notification Rules</div>,
}));

const {Client4} = require('mattermost-redux/client');

describe('StatusLogDashboard', () => {
    const mockPatchConfig = jest.fn().mockResolvedValue({data: {}});

    const baseConfig: AdminConfig = {
        MattermostExtendedSettings: {
            Statuses: {
                EnableStatusLogs: true,
                InactivityTimeoutMinutes: 5,
                HeartbeatIntervalSeconds: 30,
                StatusLogRetentionDays: 7,
                DNDInactivityTimeoutMinutes: 30,
            },
        },
    } as AdminConfig;

    const disabledConfig: AdminConfig = {
        MattermostExtendedSettings: {
            Statuses: {
                EnableStatusLogs: false,
                InactivityTimeoutMinutes: 5,
                HeartbeatIntervalSeconds: 30,
                StatusLogRetentionDays: 7,
                DNDInactivityTimeoutMinutes: 30,
            },
        },
    } as AdminConfig;

    const mockLogs = [
        {
            id: 'log1',
            create_at: Date.now() - 60000,
            user_id: 'user1',
            username: 'testuser1',
            old_status: 'online',
            new_status: 'away',
            reason: 'inactivity',
            window_active: false,
            device: 'desktop',
            log_type: 'status_change',
            manual: false,
            source: 'UpdateActivityFromHeartbeat',
        },
        {
            id: 'log2',
            create_at: Date.now() - 30000,
            user_id: 'user2',
            username: 'testuser2',
            old_status: 'away',
            new_status: 'online',
            reason: 'window_focus',
            window_active: true,
            device: 'web',
            log_type: 'status_change',
            manual: true,
            source: 'SetStatusOnline',
        },
        {
            id: 'log3',
            create_at: Date.now() - 10000,
            user_id: 'user1',
            username: 'testuser1',
            old_status: 'online',
            new_status: 'online',
            reason: 'heartbeat',
            window_active: true,
            device: 'desktop',
            log_type: 'activity',
            trigger: 'Loaded #general',
            source: 'LogActivityUpdate',
            last_activity_at: Date.now() - 10000,
        },
    ];

    const mockStats = {
        total: 3,
        online: 2,
        away: 1,
        dnd: 0,
        offline: 0,
    };

    beforeEach(() => {
        jest.clearAllMocks();
        Client4.getStatusLogs.mockResolvedValue({
            logs: mockLogs,
            stats: mockStats,
            has_more: false,
            total_count: 3,
        });
        Client4.getProfiles.mockResolvedValue([
            {id: 'user1', username: 'testuser1'},
            {id: 'user2', username: 'testuser2'},
        ]);
    });

    test('should render promotional card when feature is disabled', async () => {
        renderWithContext(
            <StatusLogDashboard
                config={disabledConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        expect(screen.getByText('Status Log Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Enable Status Logging')).toBeInTheDocument();
        expect(screen.getByText('Real-time status change streaming via WebSocket')).toBeInTheDocument();
    });

    test('should enable feature when enable button clicked', async () => {
        renderWithContext(
            <StatusLogDashboard
                config={disabledConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        const enableButton = screen.getByText('Enable Status Logging');
        await userEvent.click(enableButton);

        expect(mockPatchConfig).toHaveBeenCalledWith({
            MattermostExtendedSettings: expect.objectContaining({
                Statuses: expect.objectContaining({
                    EnableStatusLogs: true,
                }),
            }),
        });
    });

    test('should render dashboard when feature is enabled', async () => {
        renderWithContext(
            <StatusLogDashboard
                config={baseConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        await waitFor(() => {
            // "Status Logs" appears multiple times (header and tab button), use getAllByText
            const statusLogsElements = screen.getAllByText('Status Logs');
            expect(statusLogsElements.length).toBeGreaterThan(0);
        });

        expect(screen.getByText('Connected')).toBeInTheDocument();
        expect(screen.getByText('Export JSON')).toBeInTheDocument();
        expect(screen.getByText('Clear All')).toBeInTheDocument();
    });

    test('should display log entries', async () => {
        renderWithContext(
            <StatusLogDashboard
                config={baseConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        await waitFor(() => {
            // testuser1 appears multiple times (multiple log entries)
            const user1Elements = screen.getAllByText('testuser1');
            const user2Elements = screen.getAllByText('testuser2');
            expect(user1Elements.length).toBeGreaterThan(0);
            expect(user2Elements.length).toBeGreaterThan(0);
        });
    });

    test('should display status change correctly', async () => {
        renderWithContext(
            <StatusLogDashboard
                config={baseConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        await waitFor(() => {
            // Check for status badges (online, away appear multiple times)
            const onlineStatuses = screen.getAllByText('online');
            const awayStatuses = screen.getAllByText('away');
            expect(onlineStatuses.length).toBeGreaterThan(0);
            expect(awayStatuses.length).toBeGreaterThan(0);
        });
    });

    test('should filter logs by log type', async () => {
        renderWithContext(
            <StatusLogDashboard
                config={baseConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText('All Logs')).toBeInTheDocument();
        });

        // Click on Activity filter - use getAllByText since "Activity" appears multiple times
        // and select the one that's a button in the filter row
        const activityButtons = screen.getAllByText('Activity');
        // The first "Activity" is the filter button in the log type filter row
        await userEvent.click(activityButtons[0]);

        // API should be called with logType filter
        await waitFor(() => {
            expect(Client4.getStatusLogs).toHaveBeenCalledWith(
                expect.objectContaining({
                    logType: 'activity',
                }),
            );
        });
    });

    test('should filter logs by status', async () => {
        renderWithContext(
            <StatusLogDashboard
                config={baseConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText('Filters')).toBeInTheDocument();
        });

        // Open filters panel
        const filtersButton = screen.getByText('Filters');
        await userEvent.click(filtersButton);

        // Find status select by finding the select that contains "All statuses" option
        const statusSelect = screen.getByDisplayValue('All statuses');
        await userEvent.selectOptions(statusSelect, 'away');

        // API should be called with status filter
        await waitFor(() => {
            expect(Client4.getStatusLogs).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'away',
                }),
            );
        });
    });

    test('should search logs by text', async () => {
        renderWithContext(
            <StatusLogDashboard
                config={baseConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        await waitFor(() => {
            expect(screen.getByPlaceholderText(/Search by username, reason, or trigger/i)).toBeInTheDocument();
        });

        const searchInput = screen.getByPlaceholderText(/Search by username, reason, or trigger/i);
        await userEvent.type(searchInput, 'testuser1');

        // API should be called with search filter
        await waitFor(() => {
            expect(Client4.getStatusLogs).toHaveBeenCalledWith(
                expect.objectContaining({
                    search: 'testuser1',
                }),
            );
        });
    });

    test('should clear all logs when button clicked and confirmed', async () => {
        const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);

        renderWithContext(
            <StatusLogDashboard
                config={baseConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText('Clear All')).toBeInTheDocument();
        });

        const clearButton = screen.getByText('Clear All');
        await userEvent.click(clearButton);

        expect(confirmSpy).toHaveBeenCalled();
        expect(Client4.clearStatusLogs).toHaveBeenCalled();

        confirmSpy.mockRestore();
    });

    test('should NOT clear logs when confirmation is cancelled', async () => {
        const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);

        renderWithContext(
            <StatusLogDashboard
                config={baseConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText('Clear All')).toBeInTheDocument();
        });

        const clearButton = screen.getByText('Clear All');
        await userEvent.click(clearButton);

        expect(confirmSpy).toHaveBeenCalled();
        expect(Client4.clearStatusLogs).not.toHaveBeenCalled();

        confirmSpy.mockRestore();
    });

    test('should export logs as JSON', async () => {
        Client4.exportStatusLogs.mockResolvedValue({
            exported_at: Date.now(),
            stats: mockStats,
            total_count: 3,
            logs: mockLogs,
        });

        // Render first before setting up DOM mocks
        renderWithContext(
            <StatusLogDashboard
                config={baseConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText('Export JSON')).toBeInTheDocument();
        });

        // Now set up download mocks AFTER render is complete
        const mockCreateObjectURL = jest.fn().mockReturnValue('blob:test');
        const mockRevokeObjectURL = jest.fn();
        global.URL.createObjectURL = mockCreateObjectURL;
        global.URL.revokeObjectURL = mockRevokeObjectURL;

        // Mock only createElement for 'a' tags, not appendChild/removeChild
        const mockLink = {
            href: '',
            download: '',
            click: jest.fn(),
            style: {},
        } as unknown as HTMLAnchorElement;
        const originalCreateElement = document.createElement.bind(document);
        const createElementSpy = jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
            if (tagName === 'a') {
                return mockLink;
            }
            return originalCreateElement(tagName);
        });

        const exportButton = screen.getByText('Export JSON');
        await userEvent.click(exportButton);

        await waitFor(() => {
            expect(Client4.exportStatusLogs).toHaveBeenCalled();
        });

        // Restore mocks
        createElementSpy.mockRestore();
    });

    test('should switch between tabs', async () => {
        renderWithContext(
            <StatusLogDashboard
                config={baseConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        // Wait for data to load
        await waitFor(() => {
            expect(screen.getByText('Connected')).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(screen.getByText('Push Notification Rules')).toBeInTheDocument();
        });

        // Click on Rules tab
        const rulesTab = screen.getByText('Push Notification Rules');
        await userEvent.click(rulesTab);

        // Rules component should be rendered
        expect(screen.getByTestId('status-notification-rules')).toBeInTheDocument();

        // Click back to Logs tab - find the tab button (there may be multiple "Status Logs" elements)
        const statusLogsTabs = screen.getAllByText('Status Logs');
        // Find the tab button (has role of button or is a button element)
        const logsTabButton = statusLogsTabs.find((el) => el.closest('button'));
        if (logsTabButton) {
            await userEvent.click(logsTabButton);
        }

        // Logs should be visible again
        await waitFor(() => {
            expect(screen.getByText('Connected')).toBeInTheDocument();
        });
    });

    test('should display loading state', () => {
        // Make API take longer
        Client4.getStatusLogs.mockImplementation(() => new Promise(() => {}));

        renderWithContext(
            <StatusLogDashboard
                config={baseConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        expect(screen.getByText('Loading status logs...')).toBeInTheDocument();
    });

    test('should display empty state when no logs', async () => {
        Client4.getStatusLogs.mockResolvedValue({
            logs: [],
            stats: {total: 0, online: 0, away: 0, dnd: 0, offline: 0},
            has_more: false,
            total_count: 0,
        });

        renderWithContext(
            <StatusLogDashboard
                config={baseConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText('No status changes recorded')).toBeInTheDocument();
        });
    });

    test('should load more logs when button clicked', async () => {
        Client4.getStatusLogs.mockResolvedValueOnce({
            logs: mockLogs,
            stats: mockStats,
            has_more: true,
            total_count: 10,
        }).mockResolvedValueOnce({
            logs: mockLogs,
            stats: mockStats,
            has_more: false,
            total_count: 10,
        });

        renderWithContext(
            <StatusLogDashboard
                config={baseConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        // Wait for initial data load
        await waitFor(() => {
            const user1Elements = screen.getAllByText('testuser1');
            expect(user1Elements.length).toBeGreaterThan(0);
        });

        // Check for Load More button
        await waitFor(() => {
            expect(screen.getByText(/Load More/)).toBeInTheDocument();
        });

        const loadMoreButton = screen.getByText(/Load More/);
        await userEvent.click(loadMoreButton);

        // Should call API with page 1
        await waitFor(() => {
            expect(Client4.getStatusLogs).toHaveBeenCalledWith(
                expect.objectContaining({
                    page: 1,
                }),
            );
        });
    });

    test('should display device icon based on device type', async () => {
        renderWithContext(
            <StatusLogDashboard
                config={baseConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        await waitFor(() => {
            expect(screen.getAllByText('Desktop').length).toBeGreaterThan(0);
            expect(screen.getAllByText('Web').length).toBeGreaterThan(0);
        });
    });

    test('should display manual vs auto badge', async () => {
        renderWithContext(
            <StatusLogDashboard
                config={baseConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        await waitFor(() => {
            expect(screen.getAllByText('Manual').length).toBeGreaterThan(0);
            expect(screen.getAllByText('Auto').length).toBeGreaterThan(0);
        });
    });

    test('should clear all filters when clear button clicked', async () => {
        renderWithContext(
            <StatusLogDashboard
                config={baseConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText('Filters')).toBeInTheDocument();
        });

        // Open filters panel
        const filtersButton = screen.getByText('Filters');
        await userEvent.click(filtersButton);

        // Select a time filter - find by the "All time" default value
        const timeSelect = screen.getByDisplayValue('All time');
        await userEvent.selectOptions(timeSelect, '1h');

        // Clear button should appear
        await waitFor(() => {
            expect(screen.getByText('Clear')).toBeInTheDocument();
        });

        const clearButton = screen.getByText('Clear');
        await userEvent.click(clearButton);

        // Filters should be reset (API called without filters)
        await waitFor(() => {
            const lastCall = Client4.getStatusLogs.mock.calls[Client4.getStatusLogs.mock.calls.length - 1][0];
            expect(lastCall.since).toBeUndefined();
        });
    });

    test('should display activity log with trigger', async () => {
        renderWithContext(
            <StatusLogDashboard
                config={baseConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText('Loaded #general')).toBeInTheDocument();
        });
    });
});
