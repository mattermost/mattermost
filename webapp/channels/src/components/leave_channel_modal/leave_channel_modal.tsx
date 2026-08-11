// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {FormattedMessage} from 'react-intl';

import {GenericModal} from '@mattermost/components';
import type {Channel} from '@mattermost/types/channels';

import ConfirmModal from 'components/confirm_modal';

import Constants from 'utils/constants';

type Props = {
    channel: Channel;
    currentUserId?: string;
    isMuted?: boolean;
    onExited: () => void;
    callback?: () => any;
    actions: {
        leaveChannel: (channelId: string) => any;
        muteChannel?: (userId: string, channelId: string) => any;
    };
};

const LeaveChannelModal = ({actions, channel, callback, currentUserId, isMuted, onExited}: Props) => {
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

    const handleMuteInstead = async () => {
        if (!channel || !currentUserId || !actions.muteChannel) {
            handleHide();
            return;
        }

        // Keep the modal open on failure so the user can retry or choose to leave instead.
        try {
            const result = await actions.muteChannel(currentUserId, channel.id);
            if (result?.data) {
                handleHide();
            }
        } catch {
            // Intentionally left empty: keep the modal open on errors.
        }
    };

    const isPolicyEnforcedPublicChannel =
        channel?.type === Constants.OPEN_CHANNEL && Boolean(channel.policy_enforced);

    if (isPolicyEnforcedPublicChannel && channel?.display_name) {
        const title = (
            <FormattedMessage
                id='leave_policy_channel_modal.title'
                defaultMessage='Leave {channel} channel'
                values={{
                    channel: channel.display_name,
                }}
            />
        );

        const muteSentence = !isMuted && (
            <FormattedMessage
                id='leave_policy_channel_modal.mute_hint'
                defaultMessage='To stay a member without notifications, you can mute this channel instead.'
            />
        );

        const leaveButton = (
            <button
                type='button'
                className='btn btn-danger'
                onClick={handleSubmit}
                id='confirmModalButton'
            >
                <FormattedMessage
                    id='leave_policy_channel_modal.leave'
                    defaultMessage='Leave channel'
                />
            </button>
        );

        // Default focus goes to the non-destructive option so pressing Enter
        // does not immediately confirm leaving the channel.
        let secondaryButton;
        if (!isMuted && currentUserId && actions.muteChannel) {
            secondaryButton = (
                <button
                    type='button'
                    className='btn btn-tertiary'
                    onClick={handleMuteInstead}
                    id='leavePolicyChannelMuteButton'
                    autoFocus={true}
                >
                    <FormattedMessage
                        id='leave_policy_channel_modal.mute_instead'
                        defaultMessage='Mute instead'
                    />
                </button>
            );
        } else {
            secondaryButton = (
                <button
                    type='button'
                    className='btn btn-tertiary'
                    onClick={handleHide}
                    id='cancelModalButton'
                    autoFocus={true}
                >
                    <FormattedMessage
                        id='confirm_modal.cancel'
                        defaultMessage='Cancel'
                    />
                </button>
            );
        }

        return (
            <GenericModal
                id='leavePolicyChannelModal'
                className='LeavePolicyChannelModal a11y__modal'
                show={show}
                onHide={handleHide}
                onExited={onExited}
                ariaLabelledby='leavePolicyChannelModalLabel'
                compassDesign={true}
                modalHeaderText={title}
                footerContent={
                    <>
                        {secondaryButton}
                        {leaveButton}
                    </>
                }
            >
                <div className='LeavePolicyChannelModal__body'>
                    <p>
                        <FormattedMessage
                            id='leave_policy_channel_modal.message'
                            defaultMessage="You're part of this channel's membership policy. If you leave, you will not be automatically re-added."
                        />
                    </p>
                    {muteSentence && <p>{muteSentence}</p>}
                </div>
            </GenericModal>
        );
    }

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
            confirmButtonVariant='destructive'
            confirmButtonText={button}
            onConfirm={handleSubmit}
            onCancel={handleHide}
            onExited={onExited}
        />
    );
};

export default LeaveChannelModal;
