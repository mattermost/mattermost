// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import SearchableChannelList from 'components/searchable_channel_list.jsx';

describe('components/SearchableChannelList', () => {
    const baseProps = {
        channels: [],
        isSearch: false,
        channelsPerPage: 10,
        nextPage: () => {}, // eslint-disable-line no-empty-function
        search: () => {}, // eslint-disable-line no-empty-function
        handleJoin: () => {}, // eslint-disable-line no-empty-function
        loading: true,
        toggleArchivedChannels: () => {}, // eslint-disable-line no-empty-function
        shouldShowArchivedChannels: false,
        canShowArchivedChannels: false,
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
