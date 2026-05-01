// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {render} from 'tests/react_testing_utils';
import Constants from 'utils/constants';

import SidebarChannelIcon from './sidebar_channel_icon';

describe('components/sidebar/sidebar_channel/sidebar_channel_icon', () => {
    const baseIcon = <i className='icon icon-globe'/>;

    test('should render the provided icon when channel is not deleted', () => {
        const {container} = render(
            <SidebarChannelIcon
                isDeleted={false}
                icon={baseIcon}
            />,
        );

        expect(container.querySelector('.icon-globe')).toBeInTheDocument();
        expect(container.querySelector('.icon-archive-outline')).not.toBeInTheDocument();
        expect(container.querySelector('.icon-archive-lock-outline')).not.toBeInTheDocument();
    });

    test('should render archive icon for deleted public channel', () => {
        const {container} = render(
            <SidebarChannelIcon
                isDeleted={true}
                icon={baseIcon}
                channelType={Constants.OPEN_CHANNEL}
            />,
        );

        expect(container.querySelector('.icon-archive-outline')).toBeInTheDocument();
        expect(container.querySelector('.icon-archive-lock-outline')).not.toBeInTheDocument();
    });

    test('should render archive-lock icon for deleted private channel', () => {
        const {container} = render(
            <SidebarChannelIcon
                isDeleted={true}
                icon={baseIcon}
                channelType={Constants.PRIVATE_CHANNEL}
            />,
        );

        expect(container.querySelector('.icon-archive-lock-outline')).toBeInTheDocument();
        expect(container.querySelector('.icon-archive-outline')).not.toBeInTheDocument();
    });

    test('should render regular archive icon when channelType is not provided', () => {
        const {container} = render(
            <SidebarChannelIcon
                isDeleted={true}
                icon={baseIcon}
            />,
        );

        expect(container.querySelector('.icon-archive-outline')).toBeInTheDocument();
        expect(container.querySelector('.icon-archive-lock-outline')).not.toBeInTheDocument();
    });
});
