// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ServerChannel} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';

import {Client4} from 'mattermost-redux/client';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import ChannelMultiSelector from './channel_multiselector';

// Returns a ServerChannel, the shape Client4.getChannel resolves to. It is a superset of
// Channel, so the same factory also serves the search-result mocks.
function makeChannel(id: string, displayName: string, teamId = 'team1'): ServerChannel {
    return {
        id,
        display_name: displayName,
        name: displayName.toLowerCase(),
        type: 'O',
        team_id: teamId,
        delete_at: 0,
        total_msg_count: 0,
        total_msg_count_root: 0,
    } as ServerChannel;
}

function makeTeam(id: string, displayName: string): Team {
    return {id, display_name: displayName} as Team;
}

describe('ChannelMultiSelector', () => {
    let getChannel: jest.SpyInstance;
    let getTeam: jest.SpyInstance;
    let searchAllChannels: jest.SpyInstance;

    beforeEach(() => {
        getChannel = jest.spyOn(Client4, 'getChannel').mockImplementation(
            (channelId: string) => Promise.resolve(makeChannel(channelId, `Channel ${channelId}`)),
        );
        getTeam = jest.spyOn(Client4, 'getTeam').mockResolvedValue(makeTeam('team1', 'Team One'));
        searchAllChannels = jest.spyOn(Client4, 'searchAllChannels').mockResolvedValue([]);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    const renderSelector = (channelIds: string[], onChange = jest.fn()) => {
        const result = renderWithContext(
            <ChannelMultiSelector
                id='delivery_tracking_channels'
                channelIds={channelIds}
                onChange={onChange}
            />,
        );
        return {...result, onChange};
    };

    test('should hydrate saved ids into pills labelled with the channel and team', async () => {
        renderSelector(['channel1']);

        expect(await screen.findByText('Channel channel1 (Team One)')).toBeInTheDocument();
        expect(getChannel).toHaveBeenCalledWith('channel1');
        expect(getTeam).toHaveBeenCalledWith('team1');
    });

    test('should hydrate ids that arrive after mount', async () => {
        // Regression test: an earlier implementation latched hydration off the first time it
        // saw an empty list, so ids arriving later never rendered and were then silently
        // dropped on the next edit.
        const {rerender, onChange} = renderSelector([]);

        expect(getChannel).not.toHaveBeenCalled();

        rerender(
            <ChannelMultiSelector
                id='delivery_tracking_channels'
                channelIds={['channel1']}
                onChange={onChange}
            />,
        );

        expect(await screen.findByText('Channel channel1 (Team One)')).toBeInTheDocument();
    });

    test('should render an unresolved pill and keep the id when a channel cannot be fetched', async () => {
        getChannel.mockImplementation((channelId: string) => {
            if (channelId === 'deletedchannel') {
                return Promise.reject(new Error('not found'));
            }
            return Promise.resolve(makeChannel(channelId, `Channel ${channelId}`));
        });

        const {onChange} = renderSelector(['channel1', 'deletedchannel']);

        expect(await screen.findByText('Unknown channel (deletedchannel)')).toBeInTheDocument();
        expect(await screen.findByText('Channel channel1 (Team One)')).toBeInTheDocument();

        // Editing the selection must not silently discard the unresolvable id: removing the
        // resolvable pill should leave it in place rather than dropping it from the save.
        const removeButtons = document.querySelectorAll('.ChannelSelectorPill .Remove');
        expect(removeButtons).toHaveLength(2);
        await userEvent.click(removeButtons[0]);

        await waitFor(() => expect(onChange).toHaveBeenCalledWith(['deletedchannel']));
    });

    test('should not drop an id that is still hydrating when a selection is made', async () => {
        let resolveChannel: (channel: ServerChannel) => void = () => {};
        getChannel.mockImplementation(() => new Promise<ServerChannel>((resolve) => {
            resolveChannel = resolve;
        }));

        const {onChange} = renderSelector(['pendingchannel']);

        // Simulate the async select emitting a brand-new selection before hydration lands.
        searchAllChannels.mockResolvedValue([
            {...makeChannel('newchannel', 'New Channel'), team_display_name: 'Team One'},
        ]);

        await userEvent.type(screen.getByRole('combobox'), 'New');
        const option = await screen.findByText('New Channel (Team One)');
        await userEvent.click(option);

        await waitFor(() => expect(onChange).toHaveBeenCalled());
        expect(onChange).toHaveBeenCalledWith(expect.arrayContaining(['newchannel', 'pendingchannel']));

        // Let the in-flight hydration settle so its state update happens inside the test.
        resolveChannel(makeChannel('pendingchannel', 'Pending Channel'));
        await waitFor(() => expect(getTeam).toHaveBeenCalled());
    });

    test('should search channels and map results to options', async () => {
        searchAllChannels.mockResolvedValue([
            {...makeChannel('found1', 'Found One'), team_display_name: 'Team One'},
        ]);

        renderSelector([]);

        await userEvent.type(screen.getByRole('combobox'), 'Found');

        expect(await screen.findByText('Found One (Team One)')).toBeInTheDocument();
        expect(searchAllChannels).toHaveBeenCalledWith('Found', {exclude_default_channels: false});
    });

    test('should emit the reduced list when a pill is removed', async () => {
        const {onChange} = renderSelector(['channel1', 'channel2']);

        await screen.findByText('Channel channel1 (Team One)');
        await screen.findByText('Channel channel2 (Team One)');

        const removeButtons = document.querySelectorAll('.ChannelSelectorPill .Remove');
        expect(removeButtons).toHaveLength(2);

        await userEvent.click(removeButtons[0]);

        await waitFor(() => expect(onChange).toHaveBeenCalledWith(['channel2']));
    });
});
