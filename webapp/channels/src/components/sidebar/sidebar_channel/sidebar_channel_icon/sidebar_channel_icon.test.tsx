// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import Constants from 'utils/constants';

import SidebarChannelIcon from './sidebar_channel_icon';

describe('components/sidebar/sidebar_channel/sidebar_channel_icon', () => {
    const baseIcon = <i className='icon icon-globe'/>;

    test('should render the provided icon when channel is not deleted', () => {
        const wrapper = shallow(
            <SidebarChannelIcon
                isDeleted={false}
                icon={baseIcon}
            />,
        );

        expect(wrapper.find('.icon-globe')).toHaveLength(1);
        expect(wrapper.find('.icon-archive-outline')).toHaveLength(0);
        expect(wrapper.find('.icon-archive-lock-outline')).toHaveLength(0);
    });

    test('should render archive icon for deleted public channel', () => {
        const wrapper = shallow(
            <SidebarChannelIcon
                isDeleted={true}
                icon={baseIcon}
                channelType={Constants.OPEN_CHANNEL}
            />,
        );

        expect(wrapper.find('.icon-archive-outline')).toHaveLength(1);
        expect(wrapper.find('.icon-archive-lock-outline')).toHaveLength(0);
    });

    test('should render archive-lock icon for deleted private channel', () => {
        const wrapper = shallow(
            <SidebarChannelIcon
                isDeleted={true}
                icon={baseIcon}
                channelType={Constants.PRIVATE_CHANNEL}
            />,
        );

        expect(wrapper.find('.icon-archive-lock-outline')).toHaveLength(1);
        expect(wrapper.find('.icon-archive-outline')).toHaveLength(0);
    });

    test('should render regular archive icon when channelType is not provided', () => {
        const wrapper = shallow(
            <SidebarChannelIcon
                isDeleted={true}
                icon={baseIcon}
            />,
        );

        expect(wrapper.find('.icon-archive-outline')).toHaveLength(1);
        expect(wrapper.find('.icon-archive-lock-outline')).toHaveLength(0);
    });
});
