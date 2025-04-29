// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {mount} from 'enzyme';
import React from 'react';
import {Provider} from 'react-redux';
import configureStore from 'redux-mock-store';

import {fetchSharedChannelsWithRemotes} from 'mattermost-redux/actions/shared_channels';
import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getRemoteNamesForChannel} from 'mattermost-redux/selectors/entities/shared_channels';

import ChannelHeaderTitle from './channel_header_title';

jest.mock('mattermost-redux/selectors/entities/channels', () => ({
    getCurrentChannel: jest.fn(),
}));

jest.mock('mattermost-redux/selectors/entities/shared_channels', () => ({
    getRemoteNamesForChannel: jest.fn(),
}));

jest.mock('mattermost-redux/actions/shared_channels', () => ({
    fetchSharedChannelsWithRemotes: jest.fn(() => ({type: 'MOCK_ACTION'})),
}));

describe('components/channel_header/ChannelHeaderTitle', () => {
    const mockStore = configureStore();

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should not fetch shared channels for non-shared channels', () => {
        // Mock non-shared channel
        const channel = {
            id: 'channel_id',
            team_id: 'team_id',
            display_name: 'Test Channel',
            type: 'O',
            shared: false,
        };

        (getCurrentChannel as jest.Mock).mockReturnValue(channel);
        (getRemoteNamesForChannel as jest.Mock).mockReturnValue([]);

        const store = mockStore({});

        mount(
            <Provider store={store}>
                <ChannelHeaderTitle/>
            </Provider>,
        );

        expect(fetchSharedChannelsWithRemotes).not.toHaveBeenCalled();
    });

    test('should fetch shared channels data when channel is shared', () => {
        // Mock shared channel
        const channel = {
            id: 'channel_id',
            team_id: 'team_id',
            display_name: 'Test Channel',
            type: 'O',
            shared: true,
        };

        (getCurrentChannel as jest.Mock).mockReturnValue(channel);
        (getRemoteNamesForChannel as jest.Mock).mockReturnValue([]);

        const store = mockStore({});

        mount(
            <Provider store={store}>
                <ChannelHeaderTitle/>
            </Provider>,
        );

        expect(fetchSharedChannelsWithRemotes).toHaveBeenCalledWith('team_id');
    });

    test('should not fetch shared channels data when data already exists', () => {
        // Mock shared channel
        const channel = {
            id: 'channel_id',
            team_id: 'team_id',
            display_name: 'Test Channel',
            type: 'O',
            shared: true,
        };

        (getCurrentChannel as jest.Mock).mockReturnValue(channel);
        (getRemoteNamesForChannel as jest.Mock).mockReturnValue(['Remote 1', 'Remote 2']); // Data exists

        const store = mockStore({});

        mount(
            <Provider store={store}>
                <ChannelHeaderTitle/>
            </Provider>,
        );

        expect(fetchSharedChannelsWithRemotes).not.toHaveBeenCalled();
    });
});
