// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {RecapChannel} from '@mattermost/types/recaps';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import RecapChannelCard from './recap_channel_card';

const mockDispatch = jest.fn();

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    useDispatch: () => mockDispatch,
}));

jest.mock('mattermost-redux/actions/channels', () => ({
    readMultipleChannels: jest.fn((channelIds) => ({type: 'READ_MULTIPLE_CHANNELS', channelIds})),
}));

jest.mock('actions/views/channel', () => ({
    switchToChannel: jest.fn((channel) => ({type: 'SWITCH_TO_CHANNEL', channel})),
}));

jest.mock('components/external_link', () => {
    return function ExternalLink({children, href}: {children: React.ReactNode; href: string}) {
        return <a href={href}>{children}</a>;
    };
});

jest.mock('./recap_menu', () => {
    return function RecapMenu({actions}: {actions: any[]}) {
        return (
            <div data-testid='recap-menu'>
                {actions.map((action) => (
                    <button
                        key={action.id}
                        onClick={action.onClick}
                        data-testid={`menu-action-${action.id}`}
                    >
                        {action.label}
                    </button>
                ))}
            </div>
        );
    };
});

jest.mock('./recap_text_formatter', () => {
    return function RecapTextFormatter({text}: {text: string}) {
        return <div data-testid='recap-text'>{text}</div>;
    };
});

describe('RecapChannelCard', () => {
    const mockChannel = TestHelper.getChannelMock({
        id: 'channel1',
        name: 'test-channel',
        display_name: 'Test Channel',
    });

    const baseState = {
        entities: {
            channels: {
                channels: {
                    channel1: mockChannel,
                },
            },
            teams: {
                currentTeamId: 'team1',
                teams: {
                    team1: TestHelper.getTeamMock({
                        id: 'team1',
                        name: 'test-team',
                    }),
                },
            },
        },
    };

    const mockRecapChannel: RecapChannel = {
        id: 'recap_channel1',
        recap_id: 'recap1',
        channel_id: 'channel1',
        channel_name: 'test-channel',
        highlights: ['Important update from @john', 'New feature released'],
        action_items: ['Review PR #123', 'Schedule meeting'],
        source_post_ids: ['post1', 'post2'],
        create_at: 1000,
    };

    test('should render channel name', () => {
        renderWithContext(
            <RecapChannelCard channel={mockRecapChannel}/>,
            baseState,
        );

        expect(screen.getByText('test-channel')).toBeInTheDocument();
    });

    test('should render highlights section', () => {
        renderWithContext(
            <RecapChannelCard channel={mockRecapChannel}/>,
            baseState,
        );

        expect(screen.getByText('Highlights')).toBeInTheDocument();
        expect(screen.getByText('Important update from @john')).toBeInTheDocument();
        expect(screen.getByText('New feature released')).toBeInTheDocument();
    });

    test('should render action items section', () => {
        renderWithContext(
            <RecapChannelCard channel={mockRecapChannel}/>,
            baseState,
        );

        expect(screen.getByText('Action items:')).toBeInTheDocument();
        expect(screen.getByText('Review PR #123')).toBeInTheDocument();
        expect(screen.getByText('Schedule meeting')).toBeInTheDocument();
    });

    test('should not render when no highlights or action items', () => {
        const emptyChannel: RecapChannel = {
            ...mockRecapChannel,
            highlights: [],
            action_items: [],
        };

        const {container} = renderWithContext(
            <RecapChannelCard channel={emptyChannel}/>,
            baseState,
        );

        expect(container.firstChild).toBeNull();
    });

    test('should toggle collapse state when collapse button clicked', async () => {
        const user = userEvent.setup();
        renderWithContext(
            <RecapChannelCard channel={mockRecapChannel}/>,
            baseState,
        );

        // Initially expanded, content should be visible
        expect(screen.getByText('Highlights')).toBeInTheDocument();

        // Find and click the collapse button
        const collapseButton = screen.getByRole('button', {name: ''});
        await user.click(collapseButton);

        // Content should be hidden after collapse
        expect(screen.queryByText('Highlights')).not.toBeInTheDocument();
    });

    test('should dispatch switchToChannel when channel name clicked', async () => {
        const {switchToChannel} = require('actions/views/channel');
        const user = userEvent.setup();
        renderWithContext(
            <RecapChannelCard channel={mockRecapChannel}/>,
            baseState,
        );

        const channelButton = screen.getByText('test-channel');
        await user.click(channelButton);

        expect(mockDispatch).toHaveBeenCalled();
        expect(switchToChannel).toHaveBeenCalledWith(mockChannel);
    });

    test('should render menu with actions', () => {
        renderWithContext(
            <RecapChannelCard channel={mockRecapChannel}/>,
            baseState,
        );

        expect(screen.getByTestId('recap-menu')).toBeInTheDocument();
    });

    test('should call mark channel as read action', async () => {
        const {readMultipleChannels} = require('mattermost-redux/actions/channels');
        const user = userEvent.setup();
        renderWithContext(
            <RecapChannelCard channel={mockRecapChannel}/>,
            baseState,
        );

        const markReadButton = screen.getByTestId('menu-action-mark-channel-read');
        await user.click(markReadButton);

        expect(mockDispatch).toHaveBeenCalled();
        expect(readMultipleChannels).toHaveBeenCalledWith(['channel1']);
    });

    test('should call open channel action', async () => {
        const {switchToChannel} = require('actions/views/channel');
        const user = userEvent.setup();
        renderWithContext(
            <RecapChannelCard channel={mockRecapChannel}/>,
            baseState,
        );

        const openChannelButton = screen.getByTestId('menu-action-open-channel');
        await user.click(openChannelButton);

        expect(mockDispatch).toHaveBeenCalled();
        expect(switchToChannel).toHaveBeenCalledWith(mockChannel);
    });

    test('should parse permalinks from highlights', () => {
        const channelWithPermalinks: RecapChannel = {
            ...mockRecapChannel,
            highlights: ['Update from @john [PERMALINK:https://example.com/post1]'],
        };

        const {container} = renderWithContext(
            <RecapChannelCard channel={channelWithPermalinks}/>,
            baseState,
        );

        // Check that the text is rendered without the permalink tag
        expect(screen.getByText('Update from @john')).toBeInTheDocument();

        // Check that a link is rendered
        const link = container.querySelector('a[href="https://example.com/post1"]');
        expect(link).toBeInTheDocument();
    });

    test('should parse permalinks from action items', () => {
        const channelWithPermalinks: RecapChannel = {
            ...mockRecapChannel,
            action_items: ['Review PR [PERMALINK:https://example.com/pr123]'],
        };

        const {container} = renderWithContext(
            <RecapChannelCard channel={channelWithPermalinks}/>,
            baseState,
        );

        // Check that the text is rendered without the permalink tag
        expect(screen.getByText('Review PR')).toBeInTheDocument();

        // Check that a link is rendered
        const link = container.querySelector('a[href="https://example.com/pr123"]');
        expect(link).toBeInTheDocument();
    });

    test('should render badges for items without permalinks', () => {
        const {container} = renderWithContext(
            <RecapChannelCard channel={mockRecapChannel}/>,
            baseState,
        );

        // Check for badge elements
        const badges = container.querySelectorAll('.recap-item-badge');
        expect(badges.length).toBeGreaterThan(0);
    });

    test('should disable channel button when channel object not found', () => {
        const stateWithoutChannel = {
            entities: {
                channels: {
                    channels: {},
                },
                teams: {
                    currentTeamId: 'team1',
                    teams: {
                        team1: TestHelper.getTeamMock({
                            id: 'team1',
                            name: 'test-team',
                        }),
                    },
                },
            },
        };

        renderWithContext(
            <RecapChannelCard channel={mockRecapChannel}/>,
            stateWithoutChannel,
        );

        const channelButton = screen.getByText('test-channel');
        expect(channelButton).toBeDisabled();
    });

    test('should render only highlights when action items are empty', () => {
        const channelWithOnlyHighlights: RecapChannel = {
            ...mockRecapChannel,
            action_items: [],
        };

        renderWithContext(
            <RecapChannelCard channel={channelWithOnlyHighlights}/>,
            baseState,
        );

        expect(screen.getByText('Highlights')).toBeInTheDocument();
        expect(screen.queryByText('Action items:')).not.toBeInTheDocument();
    });

    test('should render only action items when highlights are empty', () => {
        const channelWithOnlyActions: RecapChannel = {
            ...mockRecapChannel,
            highlights: [],
        };

        renderWithContext(
            <RecapChannelCard channel={channelWithOnlyActions}/>,
            baseState,
        );

        expect(screen.queryByText('Highlights')).not.toBeInTheDocument();
        expect(screen.getByText('Action items:')).toBeInTheDocument();
    });
});

