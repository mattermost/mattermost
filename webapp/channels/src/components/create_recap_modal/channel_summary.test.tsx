// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import ChannelSummary from './channel_summary';

describe('ChannelSummary', () => {
    const mockChannels: Channel[] = [
        {
            id: 'channel1',
            name: 'town-square',
            display_name: 'Town Square',
            type: 'O',
            create_at: 1000,
            update_at: 1000,
            delete_at: 0,
            team_id: 'team1',
            creator_id: 'user1',
        } as Channel,
        {
            id: 'channel2',
            name: 'off-topic',
            display_name: 'Off-Topic',
            type: 'O',
            create_at: 2000,
            update_at: 2000,
            delete_at: 0,
            team_id: 'team1',
            creator_id: 'user1',
        } as Channel,
        {
            id: 'channel3',
            name: 'private-channel',
            display_name: 'Private Channel',
            type: 'P',
            create_at: 3000,
            update_at: 3000,
            delete_at: 0,
            team_id: 'team1',
            creator_id: 'user1',
        } as Channel,
        {
            id: 'channel4',
            name: 'group-message',
            display_name: 'Group Message',
            type: 'G',
            create_at: 4000,
            update_at: 4000,
            delete_at: 0,
            team_id: 'team1',
            creator_id: 'user1',
        } as Channel,
        {
            id: 'channel5',
            name: 'direct-message',
            display_name: 'Direct Message',
            type: 'D',
            create_at: 5000,
            update_at: 5000,
            delete_at: 0,
            team_id: 'team1',
            creator_id: 'user1',
        } as Channel,
    ];

    const defaultProps = {
        selectedChannelIds: ['channel1', 'channel2'],
        myChannels: mockChannels,
    };

    describe('Rendering', () => {
        it('should render the component with title', () => {
            renderWithContext(<ChannelSummary {...defaultProps}/>);

            expect(screen.getByText('The following channels will be included in your recap')).toBeInTheDocument();
        });

        it('should render selected channels only', () => {
            renderWithContext(<ChannelSummary {...defaultProps}/>);

            expect(screen.getByText('Town Square')).toBeInTheDocument();
            expect(screen.getByText('Off-Topic')).toBeInTheDocument();
            expect(screen.queryByText('Private Channel')).not.toBeInTheDocument();
        });

        it('should render all selected channels when multiple are selected', () => {
            renderWithContext(
                <ChannelSummary
                    {...defaultProps}
                    selectedChannelIds={['channel1', 'channel2', 'channel3']}
                />,
            );

            expect(screen.getByText('Town Square')).toBeInTheDocument();
            expect(screen.getByText('Off-Topic')).toBeInTheDocument();
            expect(screen.getByText('Private Channel')).toBeInTheDocument();
        });

        it('should not render any channels when none are selected', () => {
            renderWithContext(
                <ChannelSummary
                    {...defaultProps}
                    selectedChannelIds={[]}
                />,
            );

            expect(screen.queryByText('Town Square')).not.toBeInTheDocument();
            expect(screen.queryByText('Off-Topic')).not.toBeInTheDocument();
        });
    });

    describe('Channel Icons', () => {
        it('should show globe icon for open channels', () => {
            renderWithContext(
                <ChannelSummary
                    {...defaultProps}
                    selectedChannelIds={['channel1']}
                />,
            );

            const channelItem = screen.getByText('Town Square').closest('.summary-channel-item');
            const icon = channelItem?.querySelector('.icon-globe');
            expect(icon).toBeInTheDocument();
        });

        it('should show lock icon for private channels', () => {
            renderWithContext(
                <ChannelSummary
                    {...defaultProps}
                    selectedChannelIds={['channel3']}
                />,
            );

            const channelItem = screen.getByText('Private Channel').closest('.summary-channel-item');
            const icon = channelItem?.querySelector('.icon-lock-outline');
            expect(icon).toBeInTheDocument();
        });

        it('should show group icon for group messages', () => {
            renderWithContext(
                <ChannelSummary
                    {...defaultProps}
                    selectedChannelIds={['channel4']}
                />,
            );

            const channelItem = screen.getByText('Group Message').closest('.summary-channel-item');
            const icon = channelItem?.querySelector('.icon-account-multiple-outline');
            expect(icon).toBeInTheDocument();
        });

        it('should show account icon for direct messages', () => {
            renderWithContext(
                <ChannelSummary
                    {...defaultProps}
                    selectedChannelIds={['channel5']}
                />,
            );

            const channelItem = screen.getByText('Direct Message').closest('.summary-channel-item');
            const icon = channelItem?.querySelector('.icon-account-outline');
            expect(icon).toBeInTheDocument();
        });

        it('should default to globe icon for unknown channel types', () => {
            const unknownChannel: Channel = {
                id: 'channel6',
                name: 'unknown',
                display_name: 'Unknown Channel',
                type: 'X' as any,
                create_at: 6000,
                update_at: 6000,
                delete_at: 0,
                team_id: 'team1',
                creator_id: 'user1',
            } as Channel;

            renderWithContext(
                <ChannelSummary
                    selectedChannelIds={['channel6']}
                    myChannels={[...mockChannels, unknownChannel]}
                />,
            );

            const channelItem = screen.getByText('Unknown Channel').closest('.summary-channel-item');
            const icon = channelItem?.querySelector('.icon-globe');
            expect(icon).toBeInTheDocument();
        });
    });

    describe('Channel Filtering', () => {
        it('should only show channels that are both selected and in myChannels', () => {
            renderWithContext(
                <ChannelSummary
                    selectedChannelIds={['channel1', 'channel999']}
                    myChannels={mockChannels}
                />,
            );

            expect(screen.getByText('Town Square')).toBeInTheDocument();
            expect(screen.queryByText('channel999')).not.toBeInTheDocument();
        });

        it('should handle empty myChannels array', () => {
            renderWithContext(
                <ChannelSummary
                    selectedChannelIds={['channel1', 'channel2']}
                    myChannels={[]}
                />,
            );

            expect(screen.queryByText('Town Square')).not.toBeInTheDocument();
            expect(screen.queryByText('Off-Topic')).not.toBeInTheDocument();
        });

        it('should maintain order of channels based on myChannels array', () => {
            renderWithContext(
                <ChannelSummary
                    {...defaultProps}
                    selectedChannelIds={['channel3', 'channel1', 'channel2']}
                />,
            );

            const channelItems = screen.getAllByRole('generic').filter(
                (el) => el.className === 'summary-channel-item',
            );

            // Channels should appear in the order they appear in myChannels (channel1, channel2, channel3)
            expect(channelItems[0]).toHaveTextContent('Town Square');
            expect(channelItems[1]).toHaveTextContent('Off-Topic');
            expect(channelItems[2]).toHaveTextContent('Private Channel');
        });
    });

    describe('Display Names', () => {
        it('should display channel display_name not name', () => {
            renderWithContext(<ChannelSummary {...defaultProps}/>);

            expect(screen.getByText('Town Square')).toBeInTheDocument();
            expect(screen.queryByText('town-square')).not.toBeInTheDocument();
        });
    });

    describe('Edge Cases', () => {
        it('should handle duplicate channel IDs in selectedChannelIds', () => {
            renderWithContext(
                <ChannelSummary
                    selectedChannelIds={['channel1', 'channel1', 'channel2']}
                    myChannels={mockChannels}
                />,
            );

            const townSquareItems = screen.getAllByText('Town Square');

            // Should only render each channel once even if ID appears multiple times
            expect(townSquareItems.length).toBe(1);
        });

        it('should handle very long channel names', () => {
            const longNameChannel: Channel = {
                id: 'channel-long',
                name: 'long-channel-name',
                display_name: 'A'.repeat(100),
                type: 'O',
                create_at: 6000,
                update_at: 6000,
                delete_at: 0,
                team_id: 'team1',
                creator_id: 'user1',
            } as Channel;

            renderWithContext(
                <ChannelSummary
                    selectedChannelIds={['channel-long']}
                    myChannels={[longNameChannel]}
                />,
            );

            expect(screen.getByText('A'.repeat(100))).toBeInTheDocument();
        });
    });
});

