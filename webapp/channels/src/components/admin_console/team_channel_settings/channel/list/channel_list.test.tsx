// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import {TestHelper} from 'utils/test_helper';

import ChannelList from './channel_list';

describe('admin_console/team_channel_settings/channel/ChannelList', () => {
    const channel: Channel = Object.assign(TestHelper.getChannelMock({id: 'channel-1'}));

    test('should match snapshot', () => {
        const testChannels = [{
            ...channel,
            id: '123',
            display_name: 'DN',
            team_display_name: 'teamDisplayName',
            team_name: 'teamName',
            team_update_at: 1,
        }];

        const actions = {
            getData: jest.fn().mockResolvedValue(testChannels),
            searchAllChannels: jest.fn().mockResolvedValue(testChannels),
        };

        const wrapper = shallow(
            <ChannelList
                data={testChannels}
                total={testChannels.length}
                actions={actions}
            />);

        wrapper.setState({loading: false});
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with shared channel', () => {
        const testChannels = [{
            ...channel,
            shared: true,
            id: '123',
            display_name: 'DN',
            team_display_name: 'teamDisplayName',
            team_name: 'teamName',
            team_update_at: 1,
        }];

        const actions = {
            getData: jest.fn().mockResolvedValue(testChannels),
            searchAllChannels: jest.fn().mockResolvedValue(testChannels),
        };

        const wrapper = shallow(
            <ChannelList
                data={testChannels}
                total={testChannels.length}
                actions={actions}
            />);

        wrapper.setState({loading: false});
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with paging', () => {
        const testChannels = [];
        for (let i = 0; i < 30; i++) {
            testChannels.push({
                ...channel,
                id: 'id' + i,
                display_name: 'DN' + i,
                team_display_name: 'teamDisplayName',
                team_name: 'teamName',
                team_update_at: 1,
            });
        }
        const actions = {
            getData: jest.fn().mockResolvedValue(Promise.resolve(testChannels)),
            searchAllChannels: jest.fn().mockResolvedValue(Promise.resolve(testChannels)),
        };

        const wrapper = shallow(
            <ChannelList
                data={testChannels}
                total={30}
                actions={actions}
            />);
        wrapper.setState({loading: false});
        expect(wrapper).toMatchSnapshot();
    });
});
