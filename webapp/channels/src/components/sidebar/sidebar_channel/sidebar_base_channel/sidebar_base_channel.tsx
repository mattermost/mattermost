// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import type {Channel} from '@mattermost/types/channels';

import {trackEvent} from 'actions/telemetry_actions';

import LeaveChannelModal from 'components/leave_channel_modal';
import SharedChannelIndicator from 'components/shared_channel_indicator';
import SidebarChannelLink from 'components/sidebar/sidebar_channel/sidebar_channel_link';

import Constants, {ModalIdentifiers} from 'utils/constants';

import type {PropsFromRedux} from './index';

export interface Props extends PropsFromRedux {
    channel: Channel;
    currentTeamName: string;
}

const SidebarBaseChannel = ({channel, currentTeamName, actions}: Props) => {
    const intl = useIntl();

    const handleLeavePublicChannel = (callback: () => void) => {
        actions.leaveChannel(channel.id);
        trackEvent('ui', 'ui_public_channel_x_button_clicked');
        callback();
    };

    const handleLeavePrivateChannel = (callback: () => void) => {
        actions.openModal({modalId: ModalIdentifiers.LEAVE_PRIVATE_CHANNEL_MODAL, dialogType: LeaveChannelModal, dialogProps: {channel}});
        trackEvent('ui', 'ui_private_channel_x_button_clicked');
        callback();
    };

    const getChannelLeaveHandler = () => {
        if (channel.type === Constants.OPEN_CHANNEL && channel.name !== Constants.DEFAULT_CHANNEL) {
            return handleLeavePublicChannel;
        } else if (channel.type === Constants.PRIVATE_CHANNEL) {
            return handleLeavePrivateChannel;
        }

        return null;
    };

    const getIcon = () => {
        if (channel.shared) {
            return (
                <SharedChannelIndicator
                    className='icon'
                    channelType={channel.type}
                    withTooltip={true}
                />
            );
        } else if (channel.type === Constants.OPEN_CHANNEL) {
            return (
                <i className='icon icon-globe'/>
            );
        } else if (channel.type === Constants.PRIVATE_CHANNEL) {
            return (
                <i className='icon icon-lock-outline'/>
            );
        }

        return null;
    };

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
            channelLeaveHandler={getChannelLeaveHandler()!}
            icon={getIcon()!}
        />
    );
};

export default SidebarBaseChannel;