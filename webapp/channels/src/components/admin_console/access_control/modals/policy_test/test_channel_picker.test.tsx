// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {searchAllChannels} from 'mattermost-redux/actions/channels';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import TestChannelPicker from './test_channel_picker';

jest.mock('mattermost-redux/actions/channels', () => ({
    searchAllChannels: jest.fn(),
}));

// ChannelIcon reads plugin overrides from the store; stub it so the picker can
// be tested without that wiring.
jest.mock('components/channel_type_icon', () => ({
    ChannelIcon: () => <span data-testid='channel-icon'/>,
}));

const mockSearchAllChannels = searchAllChannels as jest.MockedFunction<any>;

const channels = [
    {id: 'c1', display_name: 'Engineering', team_display_name: 'Core', type: 'P', delete_at: 0},
    {id: 'c2', display_name: 'Design', team_display_name: 'Product', type: 'P', delete_at: 0},
];

describe('TestChannelPicker', () => {
    const onSelect = jest.fn();

    beforeEach(() => {
        onSelect.mockClear();
        mockSearchAllChannels.mockReset();
        mockSearchAllChannels.mockReturnValue(() => Promise.resolve({data: channels}));
    });

    it('searches public and private channels and renders a row per result', async () => {
        renderWithContext(<TestChannelPicker onSelect={onSelect}/>);

        expect(await screen.findByText('Engineering')).toBeInTheDocument();
        expect(screen.getByText('Design')).toBeInTheDocument();

        // Team name shown as subtext, no member counts.
        expect(screen.getByText('Core')).toBeInTheDocument();

        // No public/private flag: ABAC policies can be assigned to both, so the
        // picker must not restrict to private. Exact match locks that out.
        expect(mockSearchAllChannels).toHaveBeenCalledWith('', {
            exclude_group_constrained: true,
            exclude_remote: true,
            exclude_default_channels: true,
        });
    });

    it('reports the chosen channel id through onSelect', async () => {
        renderWithContext(<TestChannelPicker onSelect={onSelect}/>);

        const row = await screen.findByText('Engineering');
        await userEvent.click(row);

        expect(onSelect).toHaveBeenCalledWith('c1');
    });

    it('re-queries as the search term changes', async () => {
        renderWithContext(<TestChannelPicker onSelect={onSelect}/>);

        await screen.findByText('Engineering');

        const input = screen.getByLabelText('Search channels');
        await userEvent.type(input, 'des');

        await waitFor(() => {
            expect(mockSearchAllChannels).toHaveBeenLastCalledWith('des', expect.anything());
        });
    });

    it('shows an empty state when there are no results', async () => {
        mockSearchAllChannels.mockReturnValue(() => Promise.resolve({data: []}));

        renderWithContext(<TestChannelPicker onSelect={onSelect}/>);

        expect(await screen.findByText('No channels found')).toBeInTheDocument();
    });

    it('surfaces an error state instead of "no results" on a failed search', async () => {
        mockSearchAllChannels.mockReturnValue(() => Promise.resolve({error: new Error('network')}));

        renderWithContext(<TestChannelPicker onSelect={onSelect}/>);

        expect(await screen.findByText('Could not load channels. Check your connection and try again.')).toBeInTheDocument();
        expect(screen.queryByText('No channels found')).not.toBeInTheDocument();
    });
});
