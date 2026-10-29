// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {defineMessage, useIntl} from 'react-intl';

import type {Channel} from '@mattermost/types/channels';

import LeaveChannelModal from 'components/leave_channel_modal';
import SidebarChannelLink from 'components/sidebar/sidebar_channel/sidebar_channel_link';

import {useChannelKind} from 'hooks/useChannelKind';
import type {KindMessages} from 'utils/channel_kind';
import Constants, {ModalIdentifiers} from 'utils/constants';

import SidebarBaseChannelIcon from './sidebar_base_channel_icon';

import type {PropsFromRedux} from './index';

export interface Props extends PropsFromRedux {
    channel: Channel;
    currentTeamName: string;
}

const SidebarBaseChannel = ({
    channel,
    currentTeamName,
    actions,
}: Props) => {
    const intl = useIntl();
    const channelKind = useChannelKind(channel);

    const handleLeavePublicChannel = useCallback((callback: () => void) => {
        actions.leaveChannel(channel.id);
        callback();
    }, [channel.id, actions.leaveChannel]);

    const handleLeaveWithConfirmation = useCallback((callback: () => void) => {
        actions.openModal({modalId: ModalIdentifiers.LEAVE_PRIVATE_CHANNEL_MODAL, dialogType: LeaveChannelModal, dialogProps: {channel}});
        callback();
    }, [channel, actions.openModal]);

    let channelLeaveHandler = null;
    if (channel.type === Constants.OPEN_CHANNEL && channel.name !== Constants.DEFAULT_CHANNEL) {
        channelLeaveHandler = channel.policy_enforced ? handleLeaveWithConfirmation : handleLeavePublicChannel;
    } else if (channel.type === Constants.PRIVATE_CHANNEL) {
        channelLeaveHandler = handleLeaveWithConfirmation;
    }

    const channelIcon = (
        <SidebarBaseChannelIcon
            channel={channel}
        />
    );

    let ariaLabelPrefix;
    if (channel.type === Constants.OPEN_CHANNEL) {
        ariaLabelPrefix = intl.formatMessage(messages.publicType[channelKind]);
    } else if (channel.type === Constants.PRIVATE_CHANNEL) {
        ariaLabelPrefix = intl.formatMessage(messages.privateType[channelKind]);
    }

    return (
        <SidebarChannelLink
            channel={channel}
            link={`/${currentTeamName}/channels/${channel.name}`}
            label={channel.display_name}
            ariaLabelPrefix={ariaLabelPrefix}
            channelLeaveHandler={channelLeaveHandler!}
            icon={channelIcon}
            isSharedChannel={channel.shared}
        />
    );
};

const messages = {
    publicType: {
        channel: defineMessage({
            id: 'accessibility.sidebar.types.public',
            defaultMessage: 'public channel',
        }),
        board: defineMessage({
            id: 'accessibility.sidebar.types.public.board',
            defaultMessage: 'public board',
        }),
    },
    privateType: {
        channel: defineMessage({
            id: 'accessibility.sidebar.types.private',
            defaultMessage: 'private channel',
        }),
        board: defineMessage({
            id: 'accessibility.sidebar.types.private.board',
            defaultMessage: 'private board',
        }),
    },
} satisfies Record<string, KindMessages>;

export default SidebarBaseChannel;
