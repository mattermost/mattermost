// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import userEvent from '@testing-library/user-event';
import React from 'react';

import {renderWithContext, screen, waitFor, act} from 'tests/react_testing_utils';

import SharedChannelIndicator from './shared_channel_indicator';

describe('components/SharedChannelIndicator', () => {
    test('should render without tooltip', () => {
        renderWithContext(
            <SharedChannelIndicator withTooltip={false}/>,
        );

        expect(screen.getByTestId('SharedChannelIcon')).toHaveClass('icon-circle-multiple-outline');
    });

    test('should render with default tooltip when no remote names', async () => {
        jest.useFakeTimers();

        renderWithContext(
            <SharedChannelIndicator withTooltip={true}/>,
        );

        const icon = screen.getByTestId('SharedChannelIcon');
        expect(icon).toHaveClass('icon-circle-multiple-outline');

        await act(async () => {
            userEvent.hover(icon);
            jest.advanceTimersByTime(1000);

            await waitFor(() => {
                expect(screen.getByText('Shared with trusted organizations')).toBeInTheDocument();
            });
        });
    });

    test('should render with remote names in tooltip', async () => {
        jest.useFakeTimers();

        const remoteNames = ['Remote 1', 'Remote 2'];
        renderWithContext(
            <SharedChannelIndicator
                withTooltip={true}
                remoteNames={remoteNames}
            />,
        );

        const icon = screen.getByTestId('SharedChannelIcon');
        expect(icon).toHaveClass('icon-circle-multiple-outline');

        await act(async () => {
            userEvent.hover(icon);
            jest.advanceTimersByTime(1000);

            await waitFor(() => {
                expect(screen.getByText('Shared with: Remote 1, Remote 2')).toBeInTheDocument();
            });
        });
    });

    test('should truncate and show count when more than 3 remote names', async () => {
        jest.useFakeTimers();

        const remoteNames = ['Remote 1', 'Remote 2', 'Remote 3', 'Remote 4', 'Remote 5'];
        renderWithContext(
            <SharedChannelIndicator
                withTooltip={true}
                remoteNames={remoteNames}
            />,
        );

        const icon = screen.getByTestId('SharedChannelIcon');
        expect(icon).toHaveClass('icon-circle-multiple-outline');

        await act(async () => {
            userEvent.hover(icon);
            jest.advanceTimersByTime(1000);

            await waitFor(() => {
                expect(screen.getByText('Shared with: Remote 1, Remote 2, Remote 3 and 2 others')).toBeInTheDocument();
            });
        });
    });

    test('should truncate long organization names with ellipsis', async () => {
        jest.useFakeTimers();

        const remoteNames = ['A Very Very Very Very Very Long Organization Name That Needs Truncation', 'Remote 2'];
        renderWithContext(
            <SharedChannelIndicator
                withTooltip={true}
                remoteNames={remoteNames}
            />,
        );

        const icon = screen.getByTestId('SharedChannelIcon');
        expect(icon).toHaveClass('icon-circle-multiple-outline');

        await act(async () => {
            userEvent.hover(icon);
            jest.advanceTimersByTime(1000);

            await waitFor(() => {
                expect(screen.getByText('Shared with: A Very Very Very Very Very Lon..., Remote 2')).toBeInTheDocument();
            });
        });
    });

    test('should correctly handle singular "other" in text', async () => {
        jest.useFakeTimers();

        const remoteNames = ['Remote 1', 'Remote 2', 'Remote 3', 'Remote 4'];
        renderWithContext(
            <SharedChannelIndicator
                withTooltip={true}
                remoteNames={remoteNames}
            />,
        );

        const icon = screen.getByTestId('SharedChannelIcon');
        expect(icon).toHaveClass('icon-circle-multiple-outline');

        await act(async () => {
            userEvent.hover(icon);
            jest.advanceTimersByTime(1000);

            await waitFor(() => {
                expect(screen.getByText('Shared with: Remote 1, Remote 2, Remote 3 and 1 other')).toBeInTheDocument();
            });
        });
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });
});
