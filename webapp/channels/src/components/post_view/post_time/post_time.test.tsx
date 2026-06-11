// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {TimestampFormat} from '@mattermost/types/config';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import PostTime from './post_time';

jest.mock('@mattermost/shared/utils/user_agent', () => ({
    isMobile: jest.fn().mockReturnValue(false),
    isDesktopApp: jest.fn().mockReturnValue(false),
}));

jest.mock('actions/global_actions', () => ({
    emitCloseRightHandSide: jest.fn(),
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
                config: {
                    DefaultTimestampFormat: TimestampFormat.STANDARD,
                },
            },
            preferences: {
                myPreferences: {},
            },
        },
    };

    afterEach(() => {
        jest.useRealTimers();
    });

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
        const user = userEvent.setup();

        renderWithContext(<PostTime {...baseProps}/>, initialState);

        await user.hover(screen.getByRole('link'));

        expect(await screen.findByRole('tooltip')).toHaveTextContent(/Wednesday, January 1, 2020 at 12:00:00 AM/);
    });

    test('should show tooltip with correct date format', async () => {
        const user = userEvent.setup();

        const props = {
            ...baseProps,
            eventTime: 1609459200000, // Jan 1, 2021 00:00:00 UTC
        };

        renderWithContext(<PostTime {...props}/>, initialState);

        await user.hover(screen.getByRole('link'));

        expect(await screen.findByRole('tooltip')).toHaveTextContent(/Friday, January 1, 2021 at 12:00:00 AM/);
    });

    test('should show tooltip with correct time format for different times', async () => {
        const user = userEvent.setup();

        const props = {
            ...baseProps,
            eventTime: 1577880000000, // Jan 1, 2020 12:00:00 UTC (noon)
        };

        renderWithContext(<PostTime {...props}/>, initialState);

        await user.hover(screen.getByRole('link'));

        expect(await screen.findByRole('tooltip')).toHaveTextContent(/Wednesday, January 1, 2020 at 12:00:00 PM/);
    });

    test('should have correct accessibility attributes', () => {
        renderWithContext(<PostTime {...baseProps}/>, initialState);

        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('aria-labelledby', baseProps.eventTime.toString());
        expect(link).toHaveAttribute('id', `${baseProps.location}_time_${baseProps.postId}`);
    });

    test('should render as div when isMobile returns true', () => {
        require('@mattermost/shared/utils/user_agent').isMobile.mockReturnValue(true);

        renderWithContext(<PostTime {...baseProps}/>, initialState);

        expect(screen.queryByRole('link')).not.toBeInTheDocument();
        expect(screen.getByText('12:00 AM').closest('div')).toHaveClass('post__permalink', 'post_permalink_mobile_view');

        // Reset mock
        require('@mattermost/shared/utils/user_agent').isMobile.mockReturnValue(false);
    });

    test('should call emitCloseRightHandSide when clicked on mobile', async () => {
        const user = userEvent.setup();
        const mockEmitCloseRightHandSide = require('actions/global_actions').emitCloseRightHandSide;

        const props = {
            ...baseProps,
            isMobileView: true,
        };

        renderWithContext(<PostTime {...props}/>, initialState);

        const timeElement = screen.getByText('12:00 AM');
        await user.click(timeElement.closest('a') || timeElement);

        expect(mockEmitCloseRightHandSide).toHaveBeenCalled();
    });
});
