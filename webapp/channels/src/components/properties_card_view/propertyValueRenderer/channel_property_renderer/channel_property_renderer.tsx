// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyValue} from '@mattermost/types/properties';

import {useChannel} from 'components/common/hooks/useChannel';
import SidebarBaseChannelIcon from 'components/sidebar/sidebar_channel/sidebar_base_channel/sidebar_base_channel_icon';

import './channel_property_renderer.scss';

type Props = {
    value: PropertyValue<unknown>;
}

export default function ChannelPropertyRenderer({value}: Props) {
    const channelId = value.value as string;
    const channel = useChannel(channelId);

    if (!channel) {
        // TODO display a placeholder here in case of deleted channel
        return null;
    }

    return (
        <div className='ChannelPropertyRenderer'>
            <SidebarBaseChannelIcon
                channelType={channel.type}
            />
            {channel.display_name}
        </div>
    );
}
