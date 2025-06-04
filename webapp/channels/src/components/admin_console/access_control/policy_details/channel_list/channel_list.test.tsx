// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import type {ChannelWithTeamData} from '@mattermost/types/channels';

import ChannelList from './channel_list';

describe('components/admin_console/access_control/channel_list', () => {
    const mockSearchChannels = jest.fn();
    const mockSetChannelListSearch = jest.fn();
    const mockSetChannelListFilters = jest.fn();
    const mockOnRemoveCallback = jest.fn();
    const mockOnUndoRemoveCallback = jest.fn();
    const mockOnAddCallback = jest.fn();

    const defaultProps = {
        channels: [],
        totalCount: 2,
        searchTerm: '',
        filters: {},
        policyId: 'policy1',
        onRemoveCallback: mockOnRemoveCallback,
        onUndoRemoveCallback: mockOnUndoRemoveCallback,
        onAddCallback: mockOnAddCallback,
        channelsToRemove: {},
        channelsToAdd: {},
        actions: {
            searchChannels: jest.fn().mockResolvedValue({
                data: {
                    channels: [
                        {id: 'channel1', name: 'Channel 1', display_name: 'Channel 1', team_display_name: 'Team 1', type: 'O'} as ChannelWithTeamData,
                        {id: 'channel2', name: 'channel2', display_name: 'Channel 2', team_display_name: 'Team 2', type: 'P'} as ChannelWithTeamData,
                    ],
                },
            }),
            setChannelListSearch: mockSetChannelListSearch,
            setChannelListFilters: mockSetChannelListFilters,
        },
    };

    beforeEach(() => {
        mockSearchChannels.mockReset();
        mockSetChannelListSearch.mockReset();
        mockSetChannelListFilters.mockReset();
        mockOnRemoveCallback.mockReset();
        mockOnUndoRemoveCallback.mockReset();
        mockOnAddCallback.mockReset();
    });

    test('should match snapshot with no channels', () => {
        const props = {
            ...defaultProps,
            channels: [],
            totalCount: 0,
            policyId: '',
        };
        const wrapper = shallow(<ChannelList {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with channels', () => {
        const props = {
            ...defaultProps,
            totalCount: 2,
            policyId: 'policy1',
            actions: {
                ...defaultProps.actions,
            },
        };
        const wrapper = shallow(<ChannelList {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with channels to remove', () => {
        const props = {
            ...defaultProps,
            totalCount: 2,
            policyId: 'policy1',
            channelsToRemove: {
                channel1: {id: 'channel1', name: 'Channel 1', display_name: 'Channel 1', team_display_name: 'Team 1', type: 'O'} as ChannelWithTeamData,
            },
        };
        const wrapper = shallow(<ChannelList {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with channels to add', () => {
        const props = {
            ...defaultProps,
            channelsToAdd: {
                channel3: {id: 'channel3', name: 'channel3', display_name: 'Channel 3', team_display_name: 'Team 1', type: 'O'} as ChannelWithTeamData,
            },
        };
        const wrapper = shallow(<ChannelList {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });
});
