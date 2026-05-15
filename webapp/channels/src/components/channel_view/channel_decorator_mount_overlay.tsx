// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import ChannelDecoratorRenderer from 'components/channel_decorator_renderer/channel_decorator_renderer';

import {useChannelDecorators} from 'hooks/useChannelDecorators';

import type {GlobalState} from 'types/store';

export const ChannelDecoratorMountOverlay = ({channelId}: {channelId: string}) => {
    const matches = useChannelDecorators(channelId, 'mount_overlay');
    const channel = useSelector((state: GlobalState) => state.entities.channels.channels[channelId]);
    if (!matches.length || !channel) {
        return null;
    }
    return (
        <div className='channel-decorator-mount-overlay'>
            {matches.map((reg) => (
                <ChannelDecoratorRenderer
                    key={reg.id}
                    registration={reg}
                    channel={channel}
                />
            ))}
        </div>
    );
};
