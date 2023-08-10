// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Channel} from '@mattermost/types/channels';
import React, {useState} from 'react';
import {FormattedMessage} from 'react-intl';

import ConfirmModal from 'components/confirm_modal';

import Constants from 'utils/constants';

type Props = {
    channel: Channel;
    onExited: () => void;
    callback?: () => any;
    actions: {
        leaveChannel: (channelId: string) => any;
    };
}

const LeaveChannelModal = ({actions, channel, callback, onExited}: Props) => {
    const [show, setShow] = useState(true);

    const handleSubmit = () => {
        if (channel) {
            const channelId = channel.id;
            actions.leaveChannel(channelId).then((result: {data: boolean}) => {
                if (result.data) {
                    callback?.();
                    handleHide();
                }
            });
        }
    };

    const handleHide = () => setShow(false);

    let title;
    let message;
    if (channel && channel.display_name) {
        if (channel.type === Constants.PRIVATE_CHANNEL) {
            title = (
                <FormattedMessage
                    id='leave_private_channel_modal.title'
                    defaultMessage='Leave Private Channel {channel}'
                    values={{
                        channel: <b>{channel.display_name}</b>,
                    }}
                />
            );
        } else {
            title = (
                <FormattedMessage
                    id='leave_public_channel_modal.title'
                    defaultMessage='Leave Channel {channel}'
                    values={{
                        channel: <b>{channel.display_name}</b>,
                    }}
                />
            );
        }

        if (channel.type === Constants.PRIVATE_CHANNEL) {
            message = (
                <FormattedMessage
                    id='leave_private_channel_modal.message'
                    defaultMessage='Are you sure you wish to leave the private channel {channel}? You must be re-invited in order to re-join this channel in the future.'
                    values={{
                        channel: <b>{channel.display_name}</b>,
                    }}
                />
            );
        } else {
            message = (
                <FormattedMessage
                    id='leave_public_channel_modal.message'
                    defaultMessage='Are you sure you wish to leave the channel {channel}? You can re-join this channel in the future if you change your mind.'
                    values={{
                        channel: <b>{channel.display_name}</b>,
                    }}
                />
            );
        }
    }

    const buttonClass = 'btn btn-danger';
    const button = (
        <FormattedMessage
            id='leave_private_channel_modal.leave'
            defaultMessage='Yes, leave channel'
        />
    );

    return (
        <ConfirmModal
            show={show}
            title={title}
            message={message}
            confirmButtonClass={buttonClass}
            confirmButtonText={button}
            onConfirm={handleSubmit}
            onCancel={handleHide}
            onExited={onExited}
        />
    );
};

export default LeaveChannelModal;
