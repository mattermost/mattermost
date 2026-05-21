// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {Constants} from 'utils/constants';
import {isChannelNamesMap} from 'utils/text_formatting';

import {ChannelHeaderTextPopover} from './channel_header_text_popover';

interface Props {
    teamId?: Team['id'];
    channel: Channel;
    dmUser?: UserProfile;
}

export default function ChannelHeaderText(props: Props) {
    const isBotDMChannel = props.channel.type === Constants.DM_CHANNEL && (props.dmUser?.is_bot ?? false);
    const headerText = isBotDMChannel ? props.dmUser?.bot_description ?? '' : props.channel?.header ?? '';
    const hasHeaderText = headerText.trim().length > 0;

    if (!hasHeaderText) {
        return null;
    }

    return (
        <ChannelHeaderTextPopover
            text={headerText}
            channelMentionsNameMap={
                isChannelNamesMap(props.channel?.props?.channel_mentions) ? props.channel.props.channel_mentions : undefined
            }
        />
    );
}
