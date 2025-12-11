// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import {SearchableChannelList} from 'components/searchable_channel_list';

import {type MockIntl} from 'tests/helpers/intl-test-helper';

import {Filter} from './browse_channels/browse_channels';

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
        filter: Filter.All,
        intl: {
            formatMessage: ({defaultMessage}) => defaultMessage,
        } as MockIntl,
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

    test('should render ArchiveOutlineIcon for archived public channels', () => {
        const channels = [
            {
                id: 'channel1',
                name: 'archived-public-channel',
                display_name: 'Archived Public Channel',
                type: 'O',
                delete_at: 1234567890,
                team_id: 'team1',
            } as Channel,
        ];

        const wrapper = shallow(
            <SearchableChannelList
                {...baseProps}
                channels={channels}
            />,
        );

        const channelRow = wrapper.find('.more-modal__row').first();
        expect(channelRow.find('ArchiveOutlineIcon')).toHaveLength(1);
        expect(channelRow.find('ArchiveLockOutlineIcon')).toHaveLength(0);
    });

    test('should render ArchiveLockOutlineIcon for archived private channels', () => {
        const channels = [
            {
                id: 'channel2',
                name: 'archived-private-channel',
                display_name: 'Archived Private Channel',
                type: 'P',
                delete_at: 1234567890,
                team_id: 'team1',
            } as Channel,
        ];

        const wrapper = shallow(
            <SearchableChannelList
                {...baseProps}
                channels={channels}
            />,
        );

        const channelRow = wrapper.find('.more-modal__row').first();
        expect(channelRow.find('ArchiveLockOutlineIcon')).toHaveLength(1);
        expect(channelRow.find('ArchiveOutlineIcon')).toHaveLength(0);
    });
});
