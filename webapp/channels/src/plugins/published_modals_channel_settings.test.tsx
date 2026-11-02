// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {ChannelTypes} from 'mattermost-redux/action_types';
import {getChannel as fetchChannel} from 'mattermost-redux/actions/channels';

import {closeModal} from 'actions/views/modals';

import {renderWithContext, screen, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import {openPublishedModal} from './published_modals';

jest.mock('components/channel_settings_modal/channel_settings_modal', () => ({
    __esModule: true,
    default: ({channelId, initialTab}: {channelId: string; initialTab?: string}) => (
        <div data-testid='channel-settings'>{`${channelId} ${initialTab}`}</div>
    ),
}));

jest.mock('mattermost-redux/actions/channels', () => ({
    ...jest.requireActual('mattermost-redux/actions/channels'),
    getChannel: jest.fn(),
}));

jest.mock('actions/views/modals', () => ({
    ...jest.requireActual('actions/views/modals'),
    closeModal: jest.fn(() => ({type: 'MOCK_CLOSE_MODAL'})),
}));

describe('published channel_settings', () => {
    const channel = TestHelper.getChannelMock({id: 'channel_id', team_id: 'team_id'});
    const ChannelSettings = openPublishedModal('channel_settings').dialogType as React.ComponentType<{channelId: string; initialTab?: string}>;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('opens on a loaded channel without fetching it', async () => {
        renderWithContext(
            <ChannelSettings
                channelId='channel_id'
                initialTab='info'
            />,
            {entities: {channels: {channels: {channel_id: channel}}}},
        );

        expect(await screen.findByTestId('channel-settings')).toHaveTextContent('channel_id info');
        expect(fetchChannel).not.toHaveBeenCalled();
    });

    test('loads a channel this client has not loaded before opening on it', async () => {
        jest.mocked(fetchChannel).mockReturnValue((async (dispatch: any) => {
            dispatch({type: ChannelTypes.RECEIVED_CHANNEL, data: channel});
            return {data: channel};
        }) as any);

        renderWithContext(<ChannelSettings channelId='channel_id'/>);

        expect(fetchChannel).toHaveBeenCalledWith('channel_id');
        expect(await screen.findByTestId('channel-settings')).toHaveTextContent('channel_id');
        expect(closeModal).not.toHaveBeenCalled();
    });

    test('closes when the channel cannot be loaded', async () => {
        jest.mocked(fetchChannel).mockReturnValue((async () => ({error: new Error('not found')})) as any);

        renderWithContext(<ChannelSettings channelId='missing_id'/>);

        await waitFor(() => expect(closeModal).toHaveBeenCalledWith('channel_settings'));
        expect(screen.queryByTestId('channel-settings')).not.toBeInTheDocument();
    });
});
