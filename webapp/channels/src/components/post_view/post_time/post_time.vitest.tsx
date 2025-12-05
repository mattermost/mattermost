// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import userEvent from '@testing-library/user-event';
import React from 'react';

import {renderWithContext, screen, waitFor} from 'tests/vitest_react_testing_utils';

import PostTime from './post_time';

vi.mock('utils/user_agent', () => ({
    isMobile: vi.fn().mockReturnValue(false),
    isDesktopApp: vi.fn().mockReturnValue(false),
}));

vi.mock('actions/global_actions', () => ({
    emitCloseRightHandSide: vi.fn(),
}));

describe('components/post_view/post_time/PostTime', () => {
    const baseProps = {
        isPermalink: true,
        eventTime: 1577836800000, // Jan 1, 2020 00:00:00 UTC
        isMobileView: false,
        location: 'center',
        postId: 'post123',
        teamUrl: '/team1',
    };

    const initialState = {
        entities: {
            general: {
                config: {},
            },
            preferences: {
                myPreferences: {},
            },
        },
    };

    test('should render PostTime component', () => {
        renderWithContext(<PostTime {...baseProps}/>, initialState);

        expect(screen.getByText('12:00 AM')).toBeInTheDocument();
    });

    test('should render as permalink when isPermalink is true and not mobile', () => {
        renderWithContext(<PostTime {...baseProps}/>, initialState);

        const link = screen.getByRole('link');
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute('href', '/team1/pl/post123');
        expect(link).toHaveClass('post__permalink');
    });

    test('should render as div when isPermalink is false', () => {
        const props = {
            ...baseProps,
            isPermalink: false,
        };
        renderWithContext(<PostTime {...props}/>, initialState);

        expect(screen.queryByRole('link')).not.toBeInTheDocument();
        expect(screen.getByText('12:00 AM').closest('div')).toHaveClass('post__permalink', 'post_permalink_mobile_view');
    });

    test('should show tooltip with date and time on hover', async () => {
        renderWithContext(<PostTime {...baseProps}/>, initialState);

        const timeElement = screen.getByText('12:00 AM');
        await userEvent.hover(timeElement.closest('a') || timeElement);

        await waitFor(() => {
            // Check for the tooltip content with date and time
            expect(screen.getByText(/Wednesday, January 1, 2020 at 12:00:00 AM/)).toBeInTheDocument();
        }, {timeout: 3000});
    });

    test('should show tooltip with correct date format', async () => {
        const props = {
            ...baseProps,
            eventTime: 1609459200000, // Jan 1, 2021 00:00:00 UTC
        };

        renderWithContext(<PostTime {...props}/>, initialState);

        const timeElement = screen.getByText('12:00 AM');
        await userEvent.hover(timeElement.closest('a') || timeElement);

        await waitFor(() => {
            // Check for the tooltip content with the correct date format
            expect(screen.getByText(/Friday, January 1, 2021 at 12:00:00 AM/)).toBeInTheDocument();
        }, {timeout: 3000});
    });

    test('should show tooltip with correct time format for different times', async () => {
        const props = {
            ...baseProps,
            eventTime: 1577880000000, // Jan 1, 2020 12:00:00 UTC (noon)
        };

        renderWithContext(<PostTime {...props}/>, initialState);

        const timeElement = screen.getByText('12:00 PM');
        await userEvent.hover(timeElement.closest('a') || timeElement);

        await waitFor(() => {
            // Check for the tooltip content with PM time
            expect(screen.getByText(/Wednesday, January 1, 2020 at 12:00:00 PM/)).toBeInTheDocument();
        }, {timeout: 3000});
    });

    test('should handle timestampProps correctly', () => {
        const props = {
            ...baseProps,
            timestampProps: {
                className: 'custom-timestamp',
                hourCycle: 'h23' as const,
            },
        };

        renderWithContext(<PostTime {...props}/>, initialState);

        const timeElement = screen.getByText('00:00');
        expect(timeElement).toHaveClass('custom-timestamp');
    });

    test('should have correct accessibility attributes', () => {
        renderWithContext(<PostTime {...baseProps}/>, initialState);

        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('aria-labelledby', baseProps.eventTime.toString());
        expect(link).toHaveAttribute('id', `${baseProps.location}_time_${baseProps.postId}`);
    });

    test('should render as div when isMobile returns true', async () => {
        const userAgent = await import('utils/user_agent');
        (userAgent.isMobile as ReturnType<typeof vi.fn>).mockReturnValue(true);

        renderWithContext(<PostTime {...baseProps}/>, initialState);

        expect(screen.queryByRole('link')).not.toBeInTheDocument();
        expect(screen.getByText('12:00 AM').closest('div')).toHaveClass('post__permalink', 'post_permalink_mobile_view');

        // Reset mock
        (userAgent.isMobile as ReturnType<typeof vi.fn>).mockReturnValue(false);
    });

    test('should call emitCloseRightHandSide when clicked on mobile', async () => {
        const globalActions = await import('actions/global_actions');
        const mockEmitCloseRightHandSide = globalActions.emitCloseRightHandSide;

        const props = {
            ...baseProps,
            isMobileView: true,
        };

        renderWithContext(<PostTime {...props}/>, initialState);

        const timeElement = screen.getByText('12:00 AM');
        await userEvent.click(timeElement.closest('a') || timeElement);

        expect(mockEmitCloseRightHandSide).toHaveBeenCalled();
    });
});
