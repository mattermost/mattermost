// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {Constants} from 'utils/constants';
import {isChannelNamesMap} from 'utils/text_formatting';

import {previewChannelHeaderText} from './channel_header_preview';
import {ChannelHeaderTextPopover} from './channel_header_text_popover';

interface Props {
    teamId?: Team['id'];
    channel: Channel;
    dmUser?: UserProfile;
}

function resolveHeaderText(props: Props): string {
    const isBotDMChannel =
        props.channel.type === Constants.DM_CHANNEL && (props.dmUser?.is_bot ?? false);

    if (isBotDMChannel) {
        return props.dmUser?.bot_description ?? '';
    }

    return props.channel?.header ?? '';
}

export default function ChannelHeaderText(props: Props) {
    const headerText = resolveHeaderText(props);
    const hasHeaderText = headerText.trim().length > 0;

    if (!hasHeaderText) {
        return null;
    }

    const previewText = previewChannelHeaderText(headerText);

    return (
        <ChannelHeaderTextPopover
            text={headerText}
            headerMessage={previewText}
            channelMentionsNameMap={
                isChannelNamesMap(props.channel?.props?.channel_mentions)
                    ? props.channel.props.channel_mentions
                    : undefined
            }
        />
    );
}
