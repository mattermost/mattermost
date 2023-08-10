// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {trackEvent} from 'actions/telemetry_actions';

import LeaveChannelModal from 'components/leave_channel_modal';
import SharedChannelIndicator from 'components/shared_channel_indicator';
import SidebarChannelLink from 'components/sidebar/sidebar_channel/sidebar_channel_link';

import Constants, {ModalIdentifiers} from 'utils/constants';
import {localizeMessage} from 'utils/utils';

import type {PropsFromRedux} from './index';
import type {Channel} from '@mattermost/types/channels';

interface Props extends PropsFromRedux {
    channel: Channel;
    currentTeamName: string;
}

export default class SidebarBaseChannel extends React.PureComponent<Props> {
    handleLeavePublicChannel = (callback: () => void) => {
        this.props.actions.leaveChannel(this.props.channel.id);
        trackEvent('ui', 'ui_public_channel_x_button_clicked');
        callback();
    };

    handleLeavePrivateChannel = (callback: () => void) => {
        this.props.actions.openModal({modalId: ModalIdentifiers.LEAVE_PRIVATE_CHANNEL_MODAL, dialogType: LeaveChannelModal, dialogProps: {channel: this.props.channel}});
        trackEvent('ui', 'ui_private_channel_x_button_clicked');
        callback();
    };

    getChannelLeaveHandler = () => {
        const {channel} = this.props;

        if (channel.type === Constants.OPEN_CHANNEL && channel.name !== Constants.DEFAULT_CHANNEL) {
            return this.handleLeavePublicChannel;
        } else if (channel.type === Constants.PRIVATE_CHANNEL) {
            return this.handleLeavePrivateChannel;
        }

        return null;
    };

    getIcon = () => {
        const {channel} = this.props;

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

    render() {
        const {channel, currentTeamName} = this.props;

        let ariaLabelPrefix;
        if (channel.type === Constants.OPEN_CHANNEL) {
            ariaLabelPrefix = localizeMessage('accessibility.sidebar.types.public', 'public channel');
        } else if (channel.type === Constants.PRIVATE_CHANNEL) {
            ariaLabelPrefix = localizeMessage('accessibility.sidebar.types.private', 'private channel');
        }

        return (
            <SidebarChannelLink
                channel={channel}
                link={`/${currentTeamName}/channels/${channel.name}`}
                label={channel.display_name}
                ariaLabelPrefix={ariaLabelPrefix}
                channelLeaveHandler={this.getChannelLeaveHandler()!}
                icon={this.getIcon()!}
            />
        );
    }
}
