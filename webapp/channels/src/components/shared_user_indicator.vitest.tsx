// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, waitFor, userEvent} from 'tests/vitest_react_testing_utils';

import SharedUserIndicator from './shared_user_indicator';

describe('components/SharedUserIndicator', () => {
    test('should render without tooltip', () => {
        renderWithContext(
            <SharedUserIndicator withTooltip={false}/>,
        );

        const icon = screen.getByTestId('SharedUserIcon');
        expect(icon).toHaveClass('icon-circle-multiple-outline');
    });

    test('should render with custom title in tooltip', async () => {
        vi.useFakeTimers({shouldAdvanceTime: true});

        renderWithContext(
            <SharedUserIndicator
                withTooltip={true}
                title='Custom title'
            />,
        );

        const icon = screen.getByTestId('SharedUserIcon');
        expect(icon).toHaveClass('icon-circle-multiple-outline');

        const user = userEvent.setup({advanceTimers: vi.advanceTimersByTime});
        await user.hover(icon);

        await waitFor(() => {
            expect(screen.getByText('Custom title')).toBeInTheDocument();
        });
    });

    test('should render with default tooltip when no remote names', async () => {
        vi.useFakeTimers({shouldAdvanceTime: true});

        renderWithContext(
            <SharedUserIndicator withTooltip={true}/>,
        );

        const icon = screen.getByTestId('SharedUserIcon');
        expect(icon).toHaveClass('icon-circle-multiple-outline');

        const user = userEvent.setup({advanceTimers: vi.advanceTimersByTime});
        await user.hover(icon);

        await waitFor(() => {
            expect(screen.getByText('From a trusted organization')).toBeInTheDocument();
        });
    });

    test('should render with remote names in tooltip', async () => {
        vi.useFakeTimers({shouldAdvanceTime: true});

        const remoteNames = ['Remote 1', 'Remote 2'];
        renderWithContext(
            <SharedUserIndicator
                withTooltip={true}
                remoteNames={remoteNames}
            />,
        );

        const icon = screen.getByTestId('SharedUserIcon');
        expect(icon).toHaveClass('icon-circle-multiple-outline');

        const user = userEvent.setup({advanceTimers: vi.advanceTimersByTime});
        await user.hover(icon);

        await waitFor(() => {
            expect(screen.getByText('From: Remote 1, Remote 2')).toBeInTheDocument();
        });
    });

    test('should truncate and show count when more than 3 remote names', async () => {
        vi.useFakeTimers({shouldAdvanceTime: true});

        const remoteNames = ['Remote 1', 'Remote 2', 'Remote 3', 'Remote 4', 'Remote 5'];
        renderWithContext(
            <SharedUserIndicator
                withTooltip={true}
                remoteNames={remoteNames}
            />,
        );

        const icon = screen.getByTestId('SharedUserIcon');
        expect(icon).toHaveClass('icon-circle-multiple-outline');

        const user = userEvent.setup({advanceTimers: vi.advanceTimersByTime});
        await user.hover(icon);

        await waitFor(() => {
            expect(screen.getByText('From: Remote 1, Remote 2, Remote 3 and 2 others')).toBeInTheDocument();
        });
    });

    test('should correctly handle singular "other" in text', async () => {
        vi.useFakeTimers({shouldAdvanceTime: true});

        const remoteNames = ['Remote 1', 'Remote 2', 'Remote 3', 'Remote 4'];
        renderWithContext(
            <SharedUserIndicator
                withTooltip={true}
                remoteNames={remoteNames}
            />,
        );

        const icon = screen.getByTestId('SharedUserIcon');
        expect(icon).toHaveClass('icon-circle-multiple-outline');

        const user = userEvent.setup({advanceTimers: vi.advanceTimersByTime});
        await user.hover(icon);

        await waitFor(() => {
            expect(screen.getByText('From: Remote 1, Remote 2, Remote 3 and 1 other')).toBeInTheDocument();
        });
    });

    test('should limit the overall tooltip length for extremely long content', async () => {
        vi.useFakeTimers({shouldAdvanceTime: true});

        // Generate an array of very long remote names that would produce an extremely long tooltip
        const longRemoteNames = [
            'Very Long Organization Name 1 That Exceeds Length Limits',
            'Very Long Organization Name 2 That Exceeds Length Limits',
            'Very Long Organization Name 3 That Exceeds Length Limits',
            'Very Long Organization Name 4 That Exceeds Length Limits',
            'Very Long Organization Name 5 That Exceeds Length Limits',
            'Very Long Organization Name 6 That Exceeds Length Limits',
        ];

        renderWithContext(
            <SharedUserIndicator
                withTooltip={true}
                remoteNames={longRemoteNames}
            />,
        );

        const icon = screen.getByTestId('SharedUserIcon');
        expect(icon).toHaveClass('icon-circle-multiple-outline');

        const user = userEvent.setup({advanceTimers: vi.advanceTimersByTime});
        await user.hover(icon);

        await waitFor(() => {
            // Just check that the tooltip text ends with ellipsis, indicating truncation
            const tooltipText = screen.getByText(/From:.+\.\.\.$/);
            expect(tooltipText).toBeInTheDocument();

            // Verify overall tooltip length doesn't exceed the maximum length (120)
            // Add some extra characters to account for the "From: " prefix
            const tooltipContent = tooltipText.textContent || '';
            const actualContent = tooltipContent.replace('From: ', '');
            expect(actualContent.length).toBeLessThanOrEqual(120);
        });
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
    });
});
