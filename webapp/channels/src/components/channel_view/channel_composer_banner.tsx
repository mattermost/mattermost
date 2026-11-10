// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import {getChannel} from 'mattermost-redux/selectors/entities/channels';

import Pluggable from 'plugins/pluggable';

import type {GlobalState} from 'types/store';

export const ChannelComposerBanner = ({channelId}: {channelId: string}) => {
    const channel = useSelector((s: GlobalState) => getChannel(s, channelId));
    if (!channel) {
        return null;
    }
    return (
        <Pluggable
            pluggableName='ChannelComposerBanner'
            channel={channel}
        />
    );
};
