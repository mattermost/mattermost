// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import ChannelDecoratorRenderer from 'components/channel_decorator_renderer/channel_decorator_renderer';
import ChannelIntroMessage from 'components/post_view/channel_intro_message';

import {useChannelDecorators} from 'hooks/useChannelDecorators';

import type {GlobalState} from 'types/store';

type Props = {channelId: string};

const ChannelDecoratorIntroSlot = ({channelId}: Props) => {
    const matches = useChannelDecorators(channelId, 'intro');
    const firstMatch = matches[0] ?? null;
    const channel = useSelector((state: GlobalState) => state.entities.channels.channels[channelId]);

    if (firstMatch && channel) {
        return (
            <ChannelDecoratorRenderer
                registration={firstMatch}
                channel={channel}
            />
        );
    }
    return <ChannelIntroMessage/>;
};

export default ChannelDecoratorIntroSlot;
