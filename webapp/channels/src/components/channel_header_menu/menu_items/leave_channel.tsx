// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import {LogoutVariantIcon} from '@mattermost/compass-icons/components';
import type {Channel} from '@mattermost/types/channels';

import {leaveChannel} from 'actions/views/channel';
import {openModal} from 'actions/views/modals';

import LeaveChannelModal from 'components/leave_channel_modal';
import * as Menu from 'components/menu';

import {Constants, ModalIdentifiers} from 'utils/constants';

// import type {PropsFromRedux} from './index';

type Props = {
    channel: Channel;
    id?: string;
}

const LeaveChannel = ({
    channel,
    id,
}: Props) => {
    const dispatch = useDispatch();
    const handleLeave = () => {
        if (channel.type === Constants.PRIVATE_CHANNEL) {
            dispatch(
                openModal({
                    modalId: ModalIdentifiers.LEAVE_PRIVATE_CHANNEL_MODAL,
                    dialogType: LeaveChannelModal,
                    dialogProps: {
                        channel,
                    },
                }),
            );
        } else {
            dispatch(leaveChannel(channel.id));
        }
    };

    return (
        <Menu.Item
            id={id}
            leadingElement={<LogoutVariantIcon size='18px'/>}
            onClick={handleLeave}
            labels={
                <FormattedMessage
                    id='channel_header.leave'
                    defaultMessage='Leave Channel'
                />
            }
            isDestructive={true}
        />
    );
};

export default memo(LeaveChannel);
