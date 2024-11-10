// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback} from 'react';
import {useIntl} from 'react-intl';

import type {Channel} from '@mattermost/types/channels';

import LeaveChannelModal from 'components/leave_channel_modal';
import Menu from 'components/widgets/menu/menu';

import {Constants, ModalIdentifiers} from 'utils/constants';

import type {PropsFromRedux} from './index';

type Props = PropsFromRedux & {

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
};

const LeaveChannel = ({
    isDefault = true,
    isGuestUser = false,
    channel,
    actions: {
        leaveChannel,
        openModal,
    },
    id,
}: Props) => {
    const intl = useIntl();

    const handleLeave = useCallback((e: Event) => {
        e.preventDefault();

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
    }, [channel, leaveChannel, openModal]);

    return (
        <Menu.ItemAction
            id={id}
            show={(!isDefault || isGuestUser) && channel.type !== Constants.DM_CHANNEL && channel.type !== Constants.GM_CHANNEL}
            onClick={handleLeave}
            text={intl.formatMessage({id: 'channel_header.leave', defaultMessage: 'Leave Channel'})}
            isDangerous={true}
        />
    );
};

export default memo(LeaveChannel);
