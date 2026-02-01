// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';

import Constants from 'utils/constants';

type Props = {
    channelType: ChannelType;
    customIcon?: string;
}

const SidebarBaseChannelIcon = ({
    channelType,
    customIcon,
}: Props) => {
    if (customIcon) {
        return (
            <i className={`icon icon-${customIcon}`}/>
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
