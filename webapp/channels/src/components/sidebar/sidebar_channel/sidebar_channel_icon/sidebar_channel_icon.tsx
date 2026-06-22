// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import ChannelTypeIcon from 'components/channel_type_icon';

type Props = {
    channel: Channel;
    icon: JSX.Element | null;
};

function SidebarChannelIcon({channel, icon}: Props) {
    if (channel.delete_at !== 0) {
        return <ChannelTypeIcon channel={channel}/>;
    }
    return icon;
}

export default SidebarChannelIcon;
