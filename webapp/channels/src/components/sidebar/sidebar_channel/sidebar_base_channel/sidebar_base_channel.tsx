// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import {useIntl} from 'react-intl';

import type {Channel} from '@mattermost/types/channels';

import {trackEvent} from 'actions/telemetry_actions';

import LeaveChannelModal from 'components/leave_channel_modal';
import SidebarChannelLink from 'components/sidebar/sidebar_channel/sidebar_channel_link';

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
    actions: {
        leaveChannel,
        openModal,
    },
}: Props) => {
    const intl = useIntl();

    const handleLeavePublicChannel = useCallback((callback: () => void) => {
        leaveChannel(channel.id);
        trackEvent('ui', 'ui_public_channel_x_button_clicked');
        callback();
    }, [leaveChannel, channel.id]);

    const handleLeavePrivateChannel = useCallback((callback: () => void) => {
        openModal({modalId: ModalIdentifiers.LEAVE_PRIVATE_CHANNEL_MODAL, dialogType: LeaveChannelModal, dialogProps: {channel}});
        trackEvent('ui', 'ui_private_channel_x_button_clicked');
        callback();
    }, [openModal, channel]);

    let channelLeaveHandler = null;
    if (channel.type === Constants.OPEN_CHANNEL && channel.name !== Constants.DEFAULT_CHANNEL) {
        channelLeaveHandler = handleLeavePublicChannel;
    } else if (channel.type === Constants.PRIVATE_CHANNEL) {
        channelLeaveHandler = handleLeavePrivateChannel;
    }

    const channelIcon = useMemo(() => (
        <SidebarBaseChannelIcon
            channelType={channel.type}
        />
    ), [channel.type]);

    let ariaLabelPrefix;
    if (channel.type === Constants.OPEN_CHANNEL) {
        ariaLabelPrefix = intl.formatMessage({id: 'accessibility.sidebar.types.public', defaultMessage: 'public channel'});
    } else if (channel.type === Constants.PRIVATE_CHANNEL) {
        ariaLabelPrefix = intl.formatMessage({id: 'accessibility.sidebar.types.private', defaultMessage: 'private channel'});
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

export default SidebarBaseChannel;
