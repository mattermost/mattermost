// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
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

import HeaderIconWrapper from './components/header_icon_wrapper';

type Props = {
    channel: Channel;
    teamId?: Team['id'];
    dmUser?: UserProfile;
    buttonClass?: string;
};

const addHeaderMessage = {
    id: 'channel_header.headerText.addNewButton',
    defaultMessage: 'Add a channel header',
};

export default function AddChannelHeaderButton({channel, teamId, dmUser, buttonClass}: Props) {
    const isArchivedChannel = channel.delete_at !== 0;
    const isDirectChannel = channel.type === Constants.DM_CHANNEL;
    const isGroupChannel = channel.type === Constants.GM_CHANNEL;
    const isBotDMChannel = isDirectChannel && (dmUser?.is_bot ?? false);
    const isPrivateChannel = channel.type === Constants.PRIVATE_CHANNEL;
    const hasHeaderText = (channel.header ?? '').trim().length > 0;

    if (hasHeaderText || isArchivedChannel || isBotDMChannel) {
        return null;
    }

    if (isDirectChannel || isGroupChannel) {
        return (
            <AddChannelHeaderButtonInner
                channel={channel}
                buttonClass={buttonClass}
            />
        );
    }

    return (
        <ChannelPermissionGate
            channelId={channel.id}
            teamId={teamId}
            permissions={[
                isPrivateChannel ? Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES : Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES,
            ]}
        >
            <AddChannelHeaderButtonInner
                channel={channel}
                buttonClass={buttonClass}
            />
        </ChannelPermissionGate>
    );
}

function AddChannelHeaderButtonInner({channel, buttonClass}: Pick<Props, 'channel' | 'buttonClass'>) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const tooltip = formatMessage(addHeaderMessage);

    function handleClick() {
        dispatch(openModal({
            modalId: ModalIdentifiers.EDIT_CHANNEL_HEADER,
            dialogType: EditChannelHeaderModal,
            dialogProps: {channel},
        }));
    }

    return (
        <HeaderIconWrapper
            buttonId='channelHeaderAddHeaderButton'
            buttonClass={buttonClass}
            onClick={handleClick}
            tooltip={tooltip}
        >
            <i
                className='icon icon-pencil-outline'
                aria-hidden={true}
            />
        </HeaderIconWrapper>
    );
}
