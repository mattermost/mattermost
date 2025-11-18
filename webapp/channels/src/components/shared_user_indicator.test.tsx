// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import userEvent from '@testing-library/user-event';
import React from 'react';
import * as reactIntl from 'react-intl';

import {renderWithContext, screen, waitFor} from 'tests/react_testing_utils';

import SharedUserIndicator from './shared_user_indicator';

describe('components/SharedUserIndicator', () => {
    // Mocks for i18n
    beforeEach(() => {
        const mockIntl = {
            formatMessage: jest.fn((descriptor) => {
                if (descriptor.id === 'shared_user_indicator.tooltip') {
                    return 'From trusted organizations';
                }
                if (descriptor.id === 'shared_user_indicator.tooltip_with_names') {
                    return `From: ${descriptor.values?.remoteNames}`;
                }
                if (descriptor.id === 'shared_user_indicator.aria_label') {
                    return 'shared user';
                }
                return descriptor.defaultMessage || '';
            }),
            locale: 'en',
            defaultLocale: 'en',
            messages: {},
        };

        jest.spyOn(reactIntl, 'useIntl').mockImplementation(() => mockIntl as any);
    });

    test('should render without tooltip', () => {
        renderWithContext(
            <SharedUserIndicator withTooltip={false}/>,
        );

        const icon = screen.getByTestId('SharedUserIcon');
        expect(icon).toHaveClass('icon-circle-multiple-outline');
    });

    test('should render with custom title in tooltip', async () => {
        jest.useFakeTimers();

        renderWithContext(
            <SharedUserIndicator
                withTooltip={true}
                title='Custom title'
            />,
        );

        const icon = screen.getByTestId('SharedUserIcon');
        expect(icon).toHaveClass('icon-circle-multiple-outline');

        await userEvent.hover(icon, {advanceTimers: jest.advanceTimersByTime});

        await waitFor(() => {
            expect(screen.getByText('Custom title')).toBeInTheDocument();
        });
    });

    test('should render with default tooltip when no remote names', async () => {
        jest.useFakeTimers();

        renderWithContext(
            <SharedUserIndicator withTooltip={true}/>,
        );

        const icon = screen.getByTestId('SharedUserIcon');
        expect(icon).toHaveClass('icon-circle-multiple-outline');

        await userEvent.hover(icon, {advanceTimers: jest.advanceTimersByTime});

        await waitFor(() => {
            expect(screen.getByText('From trusted organizations')).toBeInTheDocument();
        });
    });

    test('should render with remote names in tooltip', async () => {
        jest.useFakeTimers();

        const remoteNames = ['Remote 1', 'Remote 2'];
        renderWithContext(
            <SharedUserIndicator
                withTooltip={true}
                remoteNames={remoteNames}
            />,
        );

        const icon = screen.getByTestId('SharedUserIcon');
        expect(icon).toHaveClass('icon-circle-multiple-outline');

        await userEvent.hover(icon, {advanceTimers: jest.advanceTimersByTime});

        await waitFor(() => {
            expect(screen.getByText('From: Remote 1, Remote 2')).toBeInTheDocument();
        });
    });

    test('should truncate and show count when more than 3 remote names', async () => {
        jest.useFakeTimers();

        const remoteNames = ['Remote 1', 'Remote 2', 'Remote 3', 'Remote 4', 'Remote 5'];
        renderWithContext(
            <SharedUserIndicator
                withTooltip={true}
                remoteNames={remoteNames}
            />,
        );

        const icon = screen.getByTestId('SharedUserIcon');
        expect(icon).toHaveClass('icon-circle-multiple-outline');

        await userEvent.hover(icon, {advanceTimers: jest.advanceTimersByTime});

        await waitFor(() => {
            expect(screen.getByText('From: Remote 1, Remote 2, Remote 3 and 2 others')).toBeInTheDocument();
        });
    });

    test('should correctly handle singular "other" in text', async () => {
        jest.useFakeTimers();

        const remoteNames = ['Remote 1', 'Remote 2', 'Remote 3', 'Remote 4'];
        renderWithContext(
            <SharedUserIndicator
                withTooltip={true}
                remoteNames={remoteNames}
            />,
        );

        const icon = screen.getByTestId('SharedUserIcon');
        expect(icon).toHaveClass('icon-circle-multiple-outline');

        await userEvent.hover(icon, {advanceTimers: jest.advanceTimersByTime});

        await waitFor(() => {
            expect(screen.getByText('From: Remote 1, Remote 2, Remote 3 and 1 other')).toBeInTheDocument();
        });
    });

    test('should limit the overall tooltip length for extremely long content', async () => {
        jest.useFakeTimers();

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

        await userEvent.hover(icon, {advanceTimers: jest.advanceTimersByTime});

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
        jest.clearAllTimers();
        jest.useRealTimers();
        jest.restoreAllMocks();
    });
});
