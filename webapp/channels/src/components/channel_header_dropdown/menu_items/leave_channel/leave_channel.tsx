// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Channel} from '@mattermost/types/channels';
import React from 'react';

import LeaveChannelModal from 'components/leave_channel_modal';
import Menu from 'components/widgets/menu/menu';

import {Constants, ModalIdentifiers} from 'utils/constants';
import {localizeMessage} from 'utils/utils';

import type {PropsFromRedux} from './index';

interface Props extends PropsFromRedux {

    /**
     * Object with info about user
     */
    channel: Channel;

    /**
     * Boolean whether the channel is default
     */
    isDefault: boolean;

    /**
     * Boolean whether the user is a guest or no
     */
    isGuestUser: boolean;

    /**
     * Use for test selector
     */
    id?: string;
}

export default class LeaveChannel extends React.PureComponent<Props> {
    static defaultProps = {
        isDefault: true,
        isGuestUser: false,
    };

    handleLeave = (e: Event) => {
        e.preventDefault();

        const {
            channel,
            actions: {
                leaveChannel,
                openModal,
            },
        } = this.props;

        if (channel.type === Constants.PRIVATE_CHANNEL) {
            openModal({
                modalId: ModalIdentifiers.LEAVE_PRIVATE_CHANNEL_MODAL,
                dialogType: LeaveChannelModal,
                dialogProps: {
                    channel,
                },
            });
        } else {
            leaveChannel(channel.id);
        }
    };

    render() {
        const {channel, isDefault, isGuestUser, id} = this.props;

        return (
            <Menu.ItemAction
                id={id}
                show={(!isDefault || isGuestUser) && channel.type !== Constants.DM_CHANNEL && channel.type !== Constants.GM_CHANNEL}
                onClick={this.handleLeave}
                text={localizeMessage('channel_header.leave', 'Leave Channel')}
                isDangerous={true}
            />
        );
    }
}
