// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {FormattedMessage, defineMessage} from 'react-intl';

import {Button} from '@mattermost/compass-ui/components/button';
import {GenericModal} from '@mattermost/components';
import type {Channel} from '@mattermost/types/channels';

import ConfirmModal from 'components/confirm_modal';

import {useChannelKind} from 'hooks/useChannelKind';
import type {KindMessages} from 'utils/channel_kind';
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
    const channelKind = useChannelKind(channel);

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
                {...messages.policyTitle[channelKind]}
                values={{
                    channel: channel.display_name,
                }}
            />
        );

        const muteSentence = !isMuted && (
            <FormattedMessage {...messages.policyMuteHint[channelKind]}/>
        );

        const leaveButton = (
            <Button
                type='button'
                emphasis='primary'
                destructive={true}
                onClick={handleSubmit}
                id='confirmModalButton'
            >
                <FormattedMessage {...messages.policyLeave[channelKind]}/>
            </Button>
        );

        // Default focus goes to the non-destructive option so pressing Enter
        // does not immediately confirm leaving the channel.
        let secondaryButton;
        if (!isMuted && currentUserId && actions.muteChannel) {
            secondaryButton = (
                <Button
                    type='button'
                    emphasis='tertiary'
                    onClick={handleMuteInstead}
                    id='leavePolicyChannelMuteButton'
                    autoFocus={true}
                >
                    <FormattedMessage
                        id='leave_policy_channel_modal.mute_instead'
                        defaultMessage='Mute instead'
                    />
                </Button>
            );
        } else {
            secondaryButton = (
                <Button
                    type='button'
                    emphasis='tertiary'
                    onClick={handleHide}
                    id='cancelModalButton'
                    autoFocus={true}
                >
                    <FormattedMessage
                        id='confirm_modal.cancel'
                        defaultMessage='Cancel'
                    />
                </Button>
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
                        <FormattedMessage {...messages.policyMessage[channelKind]}/>
                    </p>
                    {muteSentence && <p>{muteSentence}</p>}
                </div>
            </GenericModal>
        );
    }

    let title;
    let message;
    if (channel && channel.display_name) {
        const isPrivate = channel.type === Constants.PRIVATE_CHANNEL;
        const values = {
            channel: <b>{channel.display_name}</b>,
        };
        title = (
            <FormattedMessage
                {...(isPrivate ? messages.privateTitle : messages.publicTitle)[channelKind]}
                values={values}
            />
        );
        message = (
            <FormattedMessage
                {...(isPrivate ? messages.privateMessage : messages.publicMessage)[channelKind]}
                values={values}
            />
        );
    }

    const button = <FormattedMessage {...messages.confirmLeave[channelKind]}/>;

    return (
        <ConfirmModal
            show={show}
            title={title}
            message={message}
            destructive={true}
            confirmButtonText={button}
            onConfirm={handleSubmit}
            onCancel={handleHide}
            onExited={onExited}
        />
    );
};

/* eslint-disable formatjs/enforce-placeholders -- values are passed where each message is rendered */
const messages = {
    policyTitle: {
        channel: defineMessage({
            id: 'leave_policy_channel_modal.title',
            defaultMessage: 'Leave {channel} channel',
        }),
        board: defineMessage({
            id: 'leave_policy_channel_modal.title.board',
            defaultMessage: 'Leave {channel} board',
        }),
    },
    policyMuteHint: {
        channel: defineMessage({
            id: 'leave_policy_channel_modal.mute_hint',
            defaultMessage: 'To stay a member without notifications, you can mute this channel instead.',
        }),
        board: defineMessage({
            id: 'leave_policy_channel_modal.mute_hint.board',
            defaultMessage: 'To stay a member without notifications, you can mute this board instead.',
        }),
    },
    policyLeave: {
        channel: defineMessage({
            id: 'leave_policy_channel_modal.leave',
            defaultMessage: 'Leave channel',
        }),
        board: defineMessage({
            id: 'leave_policy_channel_modal.leave.board',
            defaultMessage: 'Leave board',
        }),
    },
    policyMessage: {
        channel: defineMessage({
            id: 'leave_policy_channel_modal.message',
            defaultMessage: "You're part of this channel's membership policy. If you leave, you will not be automatically re-added.",
        }),
        board: defineMessage({
            id: 'leave_policy_channel_modal.message.board',
            defaultMessage: "You're part of this board's membership policy. If you leave, you will not be automatically re-added.",
        }),
    },
    privateTitle: {
        channel: defineMessage({
            id: 'leave_private_channel_modal.title',
            defaultMessage: 'Leave Private Channel {channel}',
        }),
        board: defineMessage({
            id: 'leave_private_channel_modal.title.board',
            defaultMessage: 'Leave Private Board {channel}',
        }),
    },
    privateMessage: {
        channel: defineMessage({
            id: 'leave_private_channel_modal.message',
            defaultMessage: 'Are you sure you wish to leave the private channel {channel}? You must be re-invited in order to re-join this channel in the future.',
        }),
        board: defineMessage({
            id: 'leave_private_channel_modal.message.board',
            defaultMessage: 'Are you sure you wish to leave the private board {channel}? You must be re-invited in order to re-join this board in the future.',
        }),
    },
    publicTitle: {
        channel: defineMessage({
            id: 'leave_public_channel_modal.title',
            defaultMessage: 'Leave Channel {channel}',
        }),
        board: defineMessage({
            id: 'leave_public_channel_modal.title.board',
            defaultMessage: 'Leave Board {channel}',
        }),
    },
    publicMessage: {
        channel: defineMessage({
            id: 'leave_public_channel_modal.message',
            defaultMessage: 'Are you sure you wish to leave the channel {channel}? You can re-join this channel in the future if you change your mind.',
        }),
        board: defineMessage({
            id: 'leave_public_channel_modal.message.board',
            defaultMessage: 'Are you sure you wish to leave the board {channel}? You can re-join this board in the future if you change your mind.',
        }),
    },
    confirmLeave: {
        channel: defineMessage({
            id: 'leave_private_channel_modal.leave',
            defaultMessage: 'Yes, leave channel',
        }),
        board: defineMessage({
            id: 'leave_private_channel_modal.leave.board',
            defaultMessage: 'Yes, leave board',
        }),
    },
} satisfies Record<string, KindMessages>;
/* eslint-enable formatjs/enforce-placeholders */

export default LeaveChannelModal;
