// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import AdminChannelSharedIndicator from './admin_channel_shared_indicator';

jest.mock('mattermost-redux/actions/shared_channels', () => ({
    fetchChannelRemotes: jest.fn(() => ({type: 'MOCK_FETCH_CHANNEL_REMOTES'})),
}));

jest.mock('mattermost-redux/selectors/entities/shared_channels', () => ({
    getRemoteNamesForChannel: jest.fn(() => [] as string[]),
}));

jest.mock('components/shared_channel_indicator', () => {
    return jest.fn(() => <i data-testid='SharedChannelIcon'/>);
});

describe('admin_console/team_channel_settings/channel/list/AdminChannelSharedIndicator', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('fetches remotes on mount when remoteNames is empty', () => {
        const {getRemoteNamesForChannel} = require('mattermost-redux/selectors/entities/shared_channels');
        const {fetchChannelRemotes} = require('mattermost-redux/actions/shared_channels');
        getRemoteNamesForChannel.mockReturnValue([]);

        renderWithContext(<AdminChannelSharedIndicator channelId='channel-1'/>);

        expect(fetchChannelRemotes).toHaveBeenCalledTimes(1);
        expect(fetchChannelRemotes).toHaveBeenCalledWith('channel-1');
    });

    test('does not fetch remotes when remoteNames is already populated', () => {
        const {getRemoteNamesForChannel} = require('mattermost-redux/selectors/entities/shared_channels');
        const {fetchChannelRemotes} = require('mattermost-redux/actions/shared_channels');
        getRemoteNamesForChannel.mockReturnValue(['Org A', 'Org B']);

        renderWithContext(<AdminChannelSharedIndicator channelId='channel-1'/>);

        expect(fetchChannelRemotes).not.toHaveBeenCalled();
    });

    test('passes remoteNames from the selector to SharedChannelIndicator', () => {
        const {getRemoteNamesForChannel} = require('mattermost-redux/selectors/entities/shared_channels');
        const SharedChannelIndicator = require('components/shared_channel_indicator');
        getRemoteNamesForChannel.mockReturnValue(['Org A', 'Org B']);

        renderWithContext(<AdminChannelSharedIndicator channelId='channel-1'/>);

        const props = SharedChannelIndicator.mock.calls[0][0];
        expect(props.remoteNames).toEqual(['Org A', 'Org B']);
        expect(props.withTooltip).toBe(true);
    });

    test('forwards the className prop to SharedChannelIndicator', () => {
        const SharedChannelIndicator = require('components/shared_channel_indicator');

        renderWithContext(
            <AdminChannelSharedIndicator
                channelId='channel-1'
                className='channel-icon'
            />,
        );

        const props = SharedChannelIndicator.mock.calls[0][0];
        expect(props.className).toBe('channel-icon');
    });
});
