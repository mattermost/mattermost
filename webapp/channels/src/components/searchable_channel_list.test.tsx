// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import SearchableChannelList from 'components/searchable_channel_list';
import {FILTER} from './browse_channels/browse_channels';

describe('components/SearchableChannelList', () => {
    const baseProps = {
        channels: [],
        isSearch: false,
        channelsPerPage: 10,
        nextPage: jest.fn(),
        search: jest.fn(),
        handleJoin: jest.fn(),
        loading: true,
        toggleArchivedChannels: jest.fn(),
        closeModal: jest.fn(),
        hideJoinedChannelsPreference: jest.fn(),
        changeFilter: jest.fn(),
        myChannelMemberships: {},
        canShowArchivedChannels: false,
        rememberHideJoinedChannelsChecked: false,
        noResultsText: <>{'no channel found'}</>,
        filter: FILTER.all,
    };

    test('should match init snapshot', () => {
        const wrapper = shallow(
            <SearchableChannelList {...baseProps}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should set page to 0 when starting search', () => {
        const wrapper = shallow(
            <SearchableChannelList {...baseProps}/>,
        );

        wrapper.setState({page: 10});
        wrapper.setProps({isSearch: true});

        expect(wrapper.state('page')).toEqual(0);
    });
});
