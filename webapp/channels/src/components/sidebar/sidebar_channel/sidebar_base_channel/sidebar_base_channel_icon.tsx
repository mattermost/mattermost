// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';

import SharedChannelIndicator from 'components/shared_channel_indicator';

import Constants from 'utils/constants';

type Props = {
    isSharedChannel: boolean;
    channelType: ChannelType;
}

const SidebarBaseChannelIcon = ({
    isSharedChannel,
    channelType,
}: Props) => {
    if (isSharedChannel) {
        return (
            <SharedChannelIndicator
                className='icon'
                channelType={channelType}
                withTooltip={true}
            />
        );
    }
    if (channelType === Constants.OPEN_CHANNEL) {
        return (
            <i className='icon icon-globe'/>
        );
    }
    if (channelType === Constants.PRIVATE_CHANNEL) {
        return (
            <i className='icon icon-lock-outline'/>
        );
    }
    return null;
};

export default SidebarBaseChannelIcon;
