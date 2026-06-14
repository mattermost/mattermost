// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import ChannelTypeIcon from 'components/channel_type_icon';

import Constants from 'utils/constants';

type Props = {
    channel: Channel;
};

const SidebarBaseChannelIcon = ({channel}: Props) => {
    if (channel.type !== Constants.OPEN_CHANNEL && channel.type !== Constants.PRIVATE_CHANNEL) {
        return null;
    }
    return <ChannelTypeIcon channel={channel}/>;
};

export default SidebarBaseChannelIcon;
