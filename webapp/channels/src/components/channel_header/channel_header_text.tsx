// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {Channel} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {Permissions} from 'mattermost-redux/constants';

import ChannelPermissionGate from 'components/permissions_gates/channel_permission_gate';

import {
    Constants,
} from 'utils/constants';
import {isChannelNamesMap} from 'utils/text_formatting';

import {ChannelHeaderTextPopover} from './channel_header_text_popover';

interface Props {
    teamId: Team['id'];
    channel: Channel;
    dmUser?: UserProfile;
}

export default function ChannelHeaderText(props: Props) {
    const isArchivedChannel = props.channel.delete_at !== 0;
    const isDirectChannel = props.channel.type === Constants.DM_CHANNEL;
    const isGroupChannel = props.channel.type === Constants.GM_CHANNEL;
    const isBotDMChannel = isDirectChannel && (props.dmUser?.is_bot ?? false);
    const isPrivateChannel = props.channel.type === Constants.PRIVATE_CHANNEL;
    const headerText = isBotDMChannel ? props.dmUser?.bot_description ?? '' : props.channel?.header ?? '';
    const hasHeaderText = headerText.trim().length > 0;

    if (hasHeaderText) {
        return (
            <ChannelHeaderTextPopover
                text={headerText}
                channelMentionsNameMap={
                    isChannelNamesMap(props.channel?.props?.channel_mentions) ? props.channel.props.channel_mentions : undefined
                }
            />
        );
    }

    if (isArchivedChannel) {
        return null;
    }

    if (isBotDMChannel) {
        return null;
    }

    if (isDirectChannel || isGroupChannel) {
        return <AddChannelHeaderTextButton/>;
    }

    // should show option to add channel header text for any channel
    // other than a DM or a GM or a Bot DM based on user's permission
    return (
        <ChannelPermissionGate
            channelId={props.channel.id}
            teamId={props.teamId}
            permissions={[
                isPrivateChannel ? Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES : Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES,
            ]}
        >
            <AddChannelHeaderTextButton/>
        </ChannelPermissionGate>
    );
}

function AddChannelHeaderTextButton() {
    return (
        <button>
            <FormattedMessage
                id='channel_header.headerText.addNewButton'
                defaultMessage='Add a channel header'
            />
        </button>
    );
}
