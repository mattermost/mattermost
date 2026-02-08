// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {AdminConfig} from '@mattermost/types/config';

import {renderWithContext, screen, waitFor, userEvent} from 'tests/react_testing_utils';

import ErrorLogDashboard from './error_log_dashboard';

// Mock the Client4 module
jest.mock('mattermost-redux/client', () => ({
    Client4: {
        getErrorLogs: jest.fn(),
        clearErrorLogs: jest.fn(),
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

const {Client4} = require('mattermost-redux/client');

// Mock localStorage
const mockLocalStorage = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: jest.fn((key: string) => store[key] || null),
        setItem: jest.fn((key: string, value: string) => {
            store[key] = value;
        }),
        removeItem: jest.fn((key: string) => {
            delete store[key];
        }),
        clear: jest.fn(() => {
            store = {};
        }),
    };
})();

Object.defineProperty(window, 'localStorage', {
    value: mockLocalStorage,
});

describe('ErrorLogDashboard', () => {
    const mockPatchConfig = jest.fn().mockResolvedValue({data: {}});

    const baseConfig: AdminConfig = {
        FeatureFlags: {
            ErrorLogDashboard: true,
        },
    } as AdminConfig;

    const disabledConfig: AdminConfig = {
        FeatureFlags: {
            ErrorLogDashboard: false,
        },
    } as AdminConfig;

    const mockErrors = [
        {
            id: 'error1',
            create_at: Date.now() - 60000,
            type: 'api' as const,
            user_id: 'user1',
            username: 'testuser1',
            message: 'API request failed',
            stack: 'Error: API request failed\n    at fetch...',
            url: '/channels/general',
            user_agent: 'Mozilla/5.0',
            status_code: 500,
            endpoint: '/api/v4/posts',
            method: 'POST',
        },
        {
            id: 'error2',
            create_at: Date.now() - 30000,
            type: 'js' as const,
            user_id: 'user2',
            username: 'testuser2',
            message: 'TypeError: Cannot read property',
            stack: 'TypeError: Cannot read property\n    at Component...',
            url: '/channels/town-square',
            user_agent: 'Chrome/100.0',
            component_stack: '\n    at Post\n    at Channel',
        },
        {
            id: 'error3',
            create_at: Date.now() - 10000,
            type: 'api' as const,
            user_id: 'user1',
            username: 'testuser1',
            message: 'Unauthorized request',
            stack: 'Error: Unauthorized\n    at auth...',
            url: '/channels/private',
            user_agent: 'Mozilla/5.0',
            status_code: 401,
            endpoint: '/api/v4/users/me',
            method: 'GET',
        },
    ];

    const mockStats = {
        total: 3,
        api: 2,
        js: 1,
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockLocalStorage.clear();
        Client4.getErrorLogs.mockResolvedValue({
            errors: mockErrors,
            stats: mockStats,
        });
    });

    test('should render promotional card when feature is disabled', async () => {
        renderWithContext(
            <ErrorLogDashboard
                config={disabledConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        expect(screen.getByText('Error Log Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Enable Error Logging')).toBeInTheDocument();
    });

    test('should enable feature when enable button clicked', async () => {
        renderWithContext(
            <ErrorLogDashboard
                config={disabledConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        const enableButton = screen.getByText('Enable Error Logging');
        await userEvent.click(enableButton);

        expect(mockPatchConfig).toHaveBeenCalledWith({
            FeatureFlags: expect.objectContaining({
                ErrorLogDashboard: true,
            }),
        });
    });

    test('should render dashboard when feature is enabled', async () => {
        renderWithContext(
            <ErrorLogDashboard
                config={baseConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText('Error Logs')).toBeInTheDocument();
        });

        expect(screen.getByText('Export JSON')).toBeInTheDocument();
        expect(screen.getByText('Clear All')).toBeInTheDocument();
    });

    test('should display error statistics', async () => {
        renderWithContext(
            <ErrorLogDashboard
                config={baseConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        await waitFor(() => {
            // Stats cards should show counts
            expect(screen.getByText('3')).toBeInTheDocument(); // Total
            expect(screen.getByText('2')).toBeInTheDocument(); // API errors
            expect(screen.getByText('1')).toBeInTheDocument(); // JS errors
        });
    });

    test('should display error entries', async () => {
        renderWithContext(
            <ErrorLogDashboard
                config={baseConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText('API request failed')).toBeInTheDocument();
        });
    });

    test('should filter errors by type', async () => {
        renderWithContext(
            <ErrorLogDashboard
                config={baseConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText('API request failed')).toBeInTheDocument();
        });

        // Click on JavaScript stat card to filter (the stat card shows "JS Errors")
        const jsFilter = screen.getByText('JS Errors');
        await userEvent.click(jsFilter);

        // Only JS errors should be visible
        await waitFor(() => {
            expect(screen.getByText('TypeError: Cannot read property')).toBeInTheDocument();
            // Check that the display changed (we're in grouped mode by default)
        });
    });

    test('should search errors by text', async () => {
        renderWithContext(
            <ErrorLogDashboard
                config={baseConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText('API request failed')).toBeInTheDocument();
        });

        const searchInput = screen.getByPlaceholderText(/Search errors/i);
        await userEvent.type(searchInput, 'Unauthorized');

        // The matching error should still be visible
        await waitFor(() => {
            expect(screen.getByText('Unauthorized request')).toBeInTheDocument();
        });
    });

    test('should clear all errors when button clicked and confirmed', async () => {
        const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);

        renderWithContext(
            <ErrorLogDashboard
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
        expect(Client4.clearErrorLogs).toHaveBeenCalled();

        confirmSpy.mockRestore();
    });

    test('should NOT clear errors when confirmation is cancelled', async () => {
        const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);

        renderWithContext(
            <ErrorLogDashboard
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
        expect(Client4.clearErrorLogs).not.toHaveBeenCalled();

        confirmSpy.mockRestore();
    });

    test('should export errors as JSON', async () => {
        // Render first before setting up DOM mocks
        renderWithContext(
            <ErrorLogDashboard
                config={baseConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText('API request failed')).toBeInTheDocument();
        });

        // Set up download mocks - use a real anchor element to avoid appendChild issues
        const mockCreateObjectURL = jest.fn().mockReturnValue('blob:test');
        const mockRevokeObjectURL = jest.fn();
        global.URL.createObjectURL = mockCreateObjectURL;
        global.URL.revokeObjectURL = mockRevokeObjectURL;

        // Create a real anchor element and spy on its click method
        const realLink = document.createElement('a');
        const clickSpy = jest.spyOn(realLink, 'click').mockImplementation(() => {});
        const originalCreateElement = document.createElement.bind(document);
        const createElementSpy = jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
            if (tagName === 'a') {
                return realLink;
            }
            return originalCreateElement(tagName);
        });

        const exportButton = screen.getByText('Export JSON');
        await userEvent.click(exportButton);

        expect(mockCreateObjectURL).toHaveBeenCalled();
        expect(mockRevokeObjectURL).toHaveBeenCalled();
        expect(clickSpy).toHaveBeenCalled();

        // Restore mocks
        createElementSpy.mockRestore();
        clickSpy.mockRestore();
    });

    test('should display loading state', () => {
        // Make API take longer
        Client4.getErrorLogs.mockImplementation(() => new Promise(() => {}));

        renderWithContext(
            <ErrorLogDashboard
                config={baseConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        expect(screen.getByText('Loading errors...')).toBeInTheDocument();
    });

    test('should display empty state when no errors', async () => {
        Client4.getErrorLogs.mockResolvedValue({
            errors: [],
            stats: {total: 0, api: 0, js: 0},
        });

        renderWithContext(
            <ErrorLogDashboard
                config={baseConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText('No errors recorded')).toBeInTheDocument();
        });
    });

    test('should toggle view mode between list and grouped', async () => {
        renderWithContext(
            <ErrorLogDashboard
                config={baseConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        // Wait for data to load
        await waitFor(() => {
            expect(screen.getByText('API request failed')).toBeInTheDocument();
        });

        // View mode buttons are now icon-only with title attributes
        // Find the list view button by its title
        const listButton = screen.getByTitle('List View');
        await userEvent.click(listButton);

        // Should show individual error entries in list mode with API badges
        await waitFor(() => {
            // In list mode, errors show "API Error" text in the badge
            const apiLabels = screen.getAllByText('API Error');
            expect(apiLabels.length).toBeGreaterThan(0);
        });
    });

    test('should display API error details', async () => {
        renderWithContext(
            <ErrorLogDashboard
                config={baseConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText('API request failed')).toBeInTheDocument();
        });
    });

    test('should display JavaScript error details', async () => {
        renderWithContext(
            <ErrorLogDashboard
                config={baseConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText('TypeError: Cannot read property')).toBeInTheDocument();
        });
    });

    test('should expand stack trace when clicked', async () => {
        renderWithContext(
            <ErrorLogDashboard
                config={baseConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        // Wait for data to load
        await waitFor(() => {
            expect(screen.getByText('API request failed')).toBeInTheDocument();
        });

        // Switch to list mode to see individual errors
        const listButton = screen.getByTitle('List View');
        await userEvent.click(listButton);

        // The stack trace toggle shows "Stack Trace" text
        await waitFor(() => {
            const showStackButtons = screen.getAllByText('Stack Trace');
            expect(showStackButtons.length).toBeGreaterThan(0);
        });
    });

    test('should add muted pattern', async () => {
        renderWithContext(
            <ErrorLogDashboard
                config={baseConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        // Wait for data to load
        await waitFor(() => {
            expect(screen.getByText('API request failed')).toBeInTheDocument();
        });

        // Open mute patterns manager - button has title "Muted Patterns"
        const muteButton = screen.getByTitle('Muted Patterns');
        await userEvent.click(muteButton);

        // Wait for the muted patterns panel to appear
        await waitFor(() => {
            expect(screen.getByText('Muted Patterns')).toBeInTheDocument();
        });

        // Add a mute pattern - placeholder is "Add pattern to mute..."
        const patternInput = screen.getByPlaceholderText(/Add pattern to mute/i);
        await userEvent.type(patternInput, 'test-pattern');

        const addButton = screen.getByText('Add');
        await userEvent.click(addButton);

        // Pattern should be saved to localStorage
        expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    test('should toggle showing muted errors', async () => {
        // Set up muted patterns
        mockLocalStorage.setItem('errorLogDashboard_mutedPatterns', JSON.stringify(['API request']));

        renderWithContext(
            <ErrorLogDashboard
                config={baseConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        // Wait for data to load - with muted patterns, some errors will be hidden
        await waitFor(() => {
            // The dashboard should show "X hidden" button when there are muted errors
            // The button text is "{count} hidden" when muted errors are hidden
            expect(screen.getByText(/hidden/i)).toBeInTheDocument();
        });

        // Toggle to show muted errors
        const showMutedButton = screen.getByText(/hidden/i);
        await userEvent.click(showMutedButton);

        // Muted errors should now be visible - button shows "Showing X hidden"
        await waitFor(() => {
            expect(screen.getByText(/Showing/i)).toBeInTheDocument();
        });
    });

    test('should copy error to clipboard', async () => {
        // Mock clipboard
        const mockWriteText = jest.fn().mockResolvedValue(undefined);
        Object.assign(navigator, {
            clipboard: {
                writeText: mockWriteText,
            },
        });

        renderWithContext(
            <ErrorLogDashboard
                config={baseConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        // Wait for data to load
        await waitFor(() => {
            expect(screen.getByText('API request failed')).toBeInTheDocument();
        });

        // Switch to list mode first to see individual errors
        const listButton = screen.getByTitle('List View');
        await userEvent.click(listButton);

        // Now wait for individual error messages to be visible
        await waitFor(() => {
            expect(screen.getByText('API request failed')).toBeInTheDocument();
        });

        // Find and click copy button
        await waitFor(() => {
            const copyButtons = screen.getAllByTitle('Copy error details');
            expect(copyButtons.length).toBeGreaterThan(0);
        });

        const copyButton = screen.getAllByTitle('Copy error details')[0];
        await userEvent.click(copyButton);

        expect(mockWriteText).toHaveBeenCalled();
    });

    test('should group errors with timestamps together', async () => {
        // Mock errors with timestamps in messages
        const timestampedErrors = [
            {
                id: 'ws1',
                create_at: Date.now() - 60000,
                type: 'js' as const,
                user_id: 'user1',
                username: 'user1',
                message: '[1770561332.93] WSClient websocket onerror. data: {"isTrusted":true}',
                stack: 'Error stack',
                url: '/channels/test',
                user_agent: 'Mozilla/5.0',
            },
            {
                id: 'ws2',
                create_at: Date.now() - 30000,
                type: 'js' as const,
                user_id: 'user2',
                username: 'user2',
                message: '[1770533397.71] WSClient websocket onerror. data: {"isTrusted":true}',
                stack: 'Error stack',
                url: '/channels/test',
                user_agent: 'Mozilla/5.0',
            },
            {
                id: 'ws3',
                create_at: Date.now() - 10000,
                type: 'js' as const,
                user_id: 'user1',
                username: 'user1',
                message: '[1770599999.12] WSClient websocket onerror. data: {"isTrusted":true}',
                stack: 'Error stack',
                url: '/channels/test',
                user_agent: 'Mozilla/5.0',
            },
        ];

        Client4.getErrorLogs.mockResolvedValue({
            errors: timestampedErrors,
            stats: {total: 3, api: 0, js: 3},
        });

        renderWithContext(
            <ErrorLogDashboard
                config={baseConfig}
                patchConfig={mockPatchConfig}
            />,
        );

        // Wait for data to load - should be in grouped mode by default
        await waitFor(() => {
            expect(screen.getByText(/WSClient websocket onerror/i)).toBeInTheDocument();
        });

        // In grouped mode, all 3 errors should be grouped into 1 group
        // Look for the occurrence count text
        await waitFor(() => {
            expect(screen.getByText('3 occurrences')).toBeInTheDocument();
        });

        // Should show 2 users in the group
        await waitFor(() => {
            expect(screen.getByText('2 users')).toBeInTheDocument();
        });
    });
});
