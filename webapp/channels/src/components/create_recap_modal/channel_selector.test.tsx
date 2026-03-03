// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import ChannelSelector from './channel_selector';

describe('ChannelSelector', () => {
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
            name: 'dev-team',
            display_name: 'Dev Team',
            type: 'O',
            create_at: 4000,
            update_at: 4000,
            delete_at: 0,
            team_id: 'team1',
            creator_id: 'user1',
        } as Channel,
    ];

    const mockUnreadChannels: Channel[] = [mockChannels[0], mockChannels[2]];

    const defaultProps = {
        selectedChannelIds: [],
        setSelectedChannelIds: jest.fn(),
        myChannels: mockChannels,
        unreadChannels: mockUnreadChannels,
    };

    describe('Rendering', () => {
        it('should render the component with label', () => {
            renderWithContext(<ChannelSelector {...defaultProps}/>);

            expect(screen.getByText('Select the channels you want to include')).toBeInTheDocument();
        });

        it('should render search input', () => {
            renderWithContext(<ChannelSelector {...defaultProps}/>);

            expect(screen.getByPlaceholderText('Search and select channels')).toBeInTheDocument();
        });

        it('should render all channels', () => {
            renderWithContext(<ChannelSelector {...defaultProps}/>);

            expect(screen.getByText('Town Square')).toBeInTheDocument();
            expect(screen.getByText('Off-Topic')).toBeInTheDocument();
            expect(screen.getByText('Private Channel')).toBeInTheDocument();
            expect(screen.getByText('Dev Team')).toBeInTheDocument();
        });
    });

    describe('Channel Groups', () => {
        it('should show recommended channels group with unread channels', () => {
            renderWithContext(<ChannelSelector {...defaultProps}/>);

            expect(screen.getByText('RECOMMENDED')).toBeInTheDocument();
            expect(screen.getByText('Town Square')).toBeInTheDocument();
            expect(screen.getByText('Private Channel')).toBeInTheDocument();
        });

        it('should show all channels group', () => {
            renderWithContext(<ChannelSelector {...defaultProps}/>);

            expect(screen.getByText('ALL CHANNELS')).toBeInTheDocument();
        });

        it('should limit recommended channels to 5', () => {
            const manyUnreadChannels: Channel[] = Array.from({length: 10}, (_, i) => ({
                id: `channel${i}`,
                name: `channel-${i}`,
                display_name: `Channel ${i}`,
                type: 'O',
                create_at: i * 1000,
                update_at: i * 1000,
                delete_at: 0,
                team_id: 'team1',
                creator_id: 'user1',
            } as Channel));

            renderWithContext(
                <ChannelSelector
                    {...defaultProps}
                    myChannels={manyUnreadChannels}
                    unreadChannels={manyUnreadChannels}
                />,
            );

            const recommendedSection = screen.getByText('RECOMMENDED').parentElement;
            const channelItems = recommendedSection?.querySelectorAll('.channel-selector-item');
            expect(channelItems?.length).toBeLessThanOrEqual(5);
        });
    });

    describe('Search Functionality', () => {
        it('should filter channels by display name', async () => {
            renderWithContext(<ChannelSelector {...defaultProps}/>);

            const searchInput = screen.getByPlaceholderText('Search and select channels');
            await userEvent.type(searchInput, 'Town');

            expect(screen.getByText('Town Square')).toBeInTheDocument();
            expect(screen.queryByText('Off-Topic')).not.toBeInTheDocument();
        });

        it('should filter channels by channel name', async () => {
            renderWithContext(<ChannelSelector {...defaultProps}/>);

            const searchInput = screen.getByPlaceholderText('Search and select channels');
            await userEvent.type(searchInput, 'off-topic');

            expect(screen.getByText('Off-Topic')).toBeInTheDocument();
            expect(screen.queryByText('Town Square')).not.toBeInTheDocument();
        });

        it('should be case insensitive', async () => {
            renderWithContext(<ChannelSelector {...defaultProps}/>);

            const searchInput = screen.getByPlaceholderText('Search and select channels');
            await userEvent.type(searchInput, 'PRIVATE');

            expect(screen.getByText('Private Channel')).toBeInTheDocument();
        });

        it('should show empty state when no channels match search', async () => {
            renderWithContext(<ChannelSelector {...defaultProps}/>);

            const searchInput = screen.getByPlaceholderText('Search and select channels');
            await userEvent.type(searchInput, 'nonexistent');

            expect(screen.getByText('No channels found')).toBeInTheDocument();
        });

        it('should update recommended channels based on search', async () => {
            renderWithContext(<ChannelSelector {...defaultProps}/>);

            const searchInput = screen.getByPlaceholderText('Search and select channels');
            await userEvent.type(searchInput, 'Private');

            // Only Private Channel should be visible, and it should be in recommended
            expect(screen.getByText('Private Channel')).toBeInTheDocument();
            expect(screen.queryByText('Town Square')).not.toBeInTheDocument();
        });
    });

    describe('Channel Selection', () => {
        it('should show checkbox for each channel', () => {
            renderWithContext(<ChannelSelector {...defaultProps}/>);

            const checkboxes = screen.getAllByRole('checkbox');
            expect(checkboxes.length).toBe(mockChannels.length);
        });

        it('should check checkbox for selected channels', () => {
            renderWithContext(
                <ChannelSelector
                    {...defaultProps}
                    selectedChannelIds={['channel1', 'channel2']}
                />,
            );

            const checkboxes = screen.getAllByRole('checkbox');
            const checkedBoxes = checkboxes.filter((cb) => (cb as HTMLInputElement).checked);
            expect(checkedBoxes.length).toBe(2);
        });

        it('should call setSelectedChannelIds when channel is clicked', async () => {
            const setSelectedChannelIds = jest.fn();
            renderWithContext(
                <ChannelSelector
                    {...defaultProps}
                    setSelectedChannelIds={setSelectedChannelIds}
                />,
            );

            const channelItem = screen.getByText('Town Square').closest('.channel-selector-item');
            await userEvent.click(channelItem!);

            expect(setSelectedChannelIds).toHaveBeenCalledWith(['channel1']);
        });

        it('should add channel to selection when unselected channel is clicked', async () => {
            const setSelectedChannelIds = jest.fn();
            renderWithContext(
                <ChannelSelector
                    {...defaultProps}
                    selectedChannelIds={['channel1']}
                    setSelectedChannelIds={setSelectedChannelIds}
                />,
            );

            const channelItem = screen.getByText('Off-Topic').closest('.channel-selector-item');
            await userEvent.click(channelItem!);

            expect(setSelectedChannelIds).toHaveBeenCalledWith(['channel1', 'channel2']);
        });

        it('should remove channel from selection when selected channel is clicked', async () => {
            const setSelectedChannelIds = jest.fn();
            renderWithContext(
                <ChannelSelector
                    {...defaultProps}
                    selectedChannelIds={['channel1', 'channel2']}
                    setSelectedChannelIds={setSelectedChannelIds}
                />,
            );

            const channelItem = screen.getByText('Town Square').closest('.channel-selector-item');
            await userEvent.click(channelItem!);

            expect(setSelectedChannelIds).toHaveBeenCalledWith(['channel2']);
        });
    });

    describe('Channel Icons', () => {
        it('should show globe icon for open channels', () => {
            renderWithContext(<ChannelSelector {...defaultProps}/>);

            const townSquareItem = screen.getByText('Town Square').closest('.channel-selector-item');
            const icon = townSquareItem?.querySelector('.icon-globe');
            expect(icon).toBeInTheDocument();
        });

        it('should show lock icon for private channels', () => {
            renderWithContext(<ChannelSelector {...defaultProps}/>);

            const privateChannelItem = screen.getByText('Private Channel').closest('.channel-selector-item');
            const icon = privateChannelItem?.querySelector('.icon-lock-outline');
            expect(icon).toBeInTheDocument();
        });
    });

    describe('Empty State', () => {
        it('should show empty state when no channels available', () => {
            renderWithContext(
                <ChannelSelector
                    {...defaultProps}
                    myChannels={[]}
                    unreadChannels={[]}
                />,
            );

            expect(screen.getByText('No channels found')).toBeInTheDocument();
        });
    });
});

