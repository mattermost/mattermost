// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {Permissions} from 'mattermost-redux/constants';

import {openModal} from 'actions/views/modals';

import EditChannelHeaderModal from 'components/edit_channel_header_modal';
import ChannelPermissionGate from 'components/permissions_gates/channel_permission_gate';

import {
    Constants,
    ModalIdentifiers,
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

    // If it has a channel then show the channel irrespective of the channel type/state etc
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

    // If doesn't have a header text then we need to check based on below
    // conditions if we need to show button to add or not

    if (isArchivedChannel) {
        return null;
    }

    if (isBotDMChannel) {
        return null;
    }

    if (isDirectChannel || isGroupChannel) {
        return <AddChannelHeaderTextButton channel={props.channel}/>;
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
            <AddChannelHeaderTextButton channel={props.channel}/>
        </ChannelPermissionGate>
    );
}

function AddChannelHeaderTextButton({channel}: {channel: Channel}) {
    const dispatch = useDispatch();

    function handleClick() {
        dispatch(openModal({
            modalId: ModalIdentifiers.EDIT_CHANNEL_HEADER,
            dialogType: EditChannelHeaderModal,
            dialogProps: {channel},
        }));
    }

    return (
        <button
            className='header-placeholder style--none'
            onClick={handleClick}
        >
            <FormattedMessage
                id='channel_header.headerText.addNewButton'
                defaultMessage='Add a channel header'
            />
            <i
                className='icon icon-pencil-outline edit-icon'
                aria-hidden={true}
            />
        </button>
    );
}
