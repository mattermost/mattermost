// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';
import styled from 'styled-components';

import {getChannel} from 'mattermost-redux/selectors/entities/channels';

import {getChannelIconComponent} from 'utils/channel_utils';

import type {GlobalState} from 'types/store';

const Mono = styled.code`
    font-size: 12px;
    word-break: break-all;
`;

const ChannelCellRoot = styled.span`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    vertical-align: middle;
`;

const ChannelName = styled.span`
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
`;

export function InvitationChannelCell({channelId}: {channelId: string}) {
    const channel = useSelector((state: GlobalState) => getChannel(state, channelId));
    const IconComponent = getChannelIconComponent(channel);

    if (!channel) {
        return <Mono>{channelId}</Mono>;
    }

    return (
        <ChannelCellRoot>
            <IconComponent size={16}/>
            <ChannelName>{channel.display_name}</ChannelName>
        </ChannelCellRoot>
    );
}
