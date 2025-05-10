// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import {adminConsoleChannelManagementTablePropertiesInitialState} from 'reducers/views/admin';

import {TestHelper} from 'utils/test_helper';

import type {AdminConsoleChannelManagementTableProperties} from 'types/store/views';

import ChannelList from './channel_list';

describe('admin_console/team_channel_settings/channel/ChannelList', () => {
    const channel: Channel = Object.assign(TestHelper.getChannelMock({id: 'channel-1'}));
    const tableProperties = adminConsoleChannelManagementTablePropertiesInitialState;

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
            setAdminConsoleChannelsManagementTableProperties: jest.fn(),
        };

        const wrapper = shallow(
            <ChannelList
                data={testChannels}
                total={testChannels.length}
                actions={actions}
                tableProperties={tableProperties}
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
            setAdminConsoleChannelsManagementTableProperties: jest.fn(),
        };

        const wrapper = shallow(
            <ChannelList
                data={testChannels}
                total={testChannels.length}
                actions={actions}
                tableProperties={tableProperties}
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
            setAdminConsoleChannelsManagementTableProperties: jest.fn(),
        };

        const wrapper = shallow(
            <ChannelList
                data={testChannels}
                total={30}
                actions={actions}
                tableProperties={tableProperties}
            />);
        wrapper.setState({loading: false});
        expect(wrapper).toMatchSnapshot();
    });

    test('should call setAdminConsoleChannelsManagementTableProperties and set state', () => {
        const testChannels = [{
            ...channel,
            id: '123',
            display_name: 'DN',
            team_display_name: 'teamDisplayName',
            team_name: 'teamName',
            team_update_at: 1,
        }];

        const searchOpts = {
            team_ids: ['teamId1'],
            public: true,
        };
        const tableProperties: AdminConsoleChannelManagementTableProperties = {
            pageIndex: 0,
            searchTerm: 'test',
            searchOpts,
        };

        const setGlobalState = jest.fn();
        const actions = {
            getData: jest.fn().mockResolvedValue(Promise.resolve(testChannels)),
            searchAllChannels: jest.fn().mockResolvedValue(Promise.resolve(testChannels)),
            setAdminConsoleChannelsManagementTableProperties: setGlobalState,
        };

        const wrapper = shallow<ChannelList>(
            <ChannelList
                data={testChannels}
                total={testChannels.length}
                actions={actions}
                tableProperties={tableProperties}
            />);
        wrapper.setState({loading: false});
        expect(wrapper.find('DataGrid').find('rows')).toEqual({});
        expect(wrapper).toMatchSnapshot();
        expect(setGlobalState).toBeCalledWith(tableProperties);
        expect(wrapper.instance().state.searchOpts).toEqual(searchOpts);
    });
});
