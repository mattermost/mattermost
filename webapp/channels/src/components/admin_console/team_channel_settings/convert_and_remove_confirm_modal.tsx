// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, defineMessages} from 'react-intl';

import type {ChannelPropertyValuePatchItems} from '@mattermost/types/channels';

import ConfirmModal from 'components/confirm_modal';

import ConvertRequiredAttributes from './convert_required_attributes';
import type {PendingChannelAttributeValues} from './convert_required_attributes';

type Props = {

    /*
     * Bool whether the modal is shown
     */
    show: boolean;

    /*
     * Action to call on confirm
     */
    onConfirm: (values?: ChannelPropertyValuePatchItems) => void;

    /*
     * Action to call on cancel
     */
    onCancel: (checked: boolean) => void;

    /*
     * Channel display name
     */
    displayName: string;

    /*
     * Channel privacy setting
     */
    toPublic: boolean;

    /*
     * Number of users to be removed
     */
    removeAmount: number;

    /*
     * The channel being converted. Without it, no required attributes are asked for
     */
    channelId?: string;

    /*
     * Attribute values the caller is already saving alongside the conversion
     */
    pendingValues?: PendingChannelAttributeValues;
};

type ContentProps = Omit<Props, 'channelId' | 'pendingValues'> & {
    extraContent?: React.ReactNode;
    confirmDisabled?: boolean;
};

const ConvertAndRemoveConfirmModalContent = ({
    show,
    onConfirm,
    onCancel,
    displayName,
    toPublic,
    removeAmount,
    extraContent,
    confirmDisabled,
}: ContentProps) => {
    const titleMessage = toPublic ? messages.toPublicTitle : messages.toPrivateTitle;

    const convertMessage = toPublic ? messages.toPublicMessage : messages.toPrivateMessage;

    const convertMessageSecondLine = toPublic ? messages.toPublicMessageSecondLine : messages.toPrivateMessageSecondLine;

    const confirmMessage = toPublic ? messages.toPublicConfirm : messages.toPrivateConfirm;

    const title = (
        <FormattedMessage
            {...titleMessage}
            values={{amount: removeAmount}}
        />
    );

    const message = (
        <>
            <p>
                <FormattedMessage
                    {...convertMessage}
                    values={{
                        displayName: <strong>{displayName}</strong>,
                    }}
                />
            </p>
            <p>
                <FormattedMessage
                    {...convertMessageSecondLine}
                    values={{
                        displayName: <strong>{displayName}</strong>,
                    }}
                />
            </p>
            <p>
                <FormattedMessage
                    id='admin.team_channel_settings.removeConfirmModal.messageChannelFirstLine'
                    defaultMessage='{amount, number} {amount, plural, one {user} other {users}} will be removed. They are not in groups linked to this channel.'
                    values={{amount: removeAmount}}
                />
            </p>
            <p>
                <FormattedMessage
                    id='admin.team_channel_settings.removeConfirmModal.messageChannelSecondLine'
                    defaultMessage='Are you sure you wish to remove these users?'
                />
            </p>
            {extraContent}
        </>
    );

    const confirmButton = (
        <FormattedMessage
            {...confirmMessage}
            values={{amount: removeAmount}}
        />
    );

    const cancelButton = (
        <FormattedMessage
            id='admin.team_channel_settings.convertAndRemoveConfirmModal.cancel'
            defaultMessage='No, cancel'
        />
    );

    const modalClass = 'discard-changes-modal';

    return (
        <ConfirmModal
            show={show}
            title={title}
            message={message}
            modalClass={modalClass}
            confirmButtonText={confirmButton}
            cancelButtonText={cancelButton}
            onConfirm={() => onConfirm()}
            onCancel={onCancel}
            {...(confirmDisabled ? {confirmDisabled} : {})}
        />
    );
};

// One tree whether or not attributes are asked, so opening and closing never
// remounts the dialog.
const ConvertAndRemoveConfirmModal = ({channelId, pendingValues, ...props}: Props) => {
    return (
        <ConvertRequiredAttributes
            channelId={channelId ?? ''}
            active={props.show && !props.toPublic && Boolean(channelId)}
            pendingValues={pendingValues}
        >
            {({content, confirmDisabled, values}) => (
                <ConvertAndRemoveConfirmModalContent
                    {...props}
                    onConfirm={() => props.onConfirm(values)}
                    extraContent={content}
                    confirmDisabled={confirmDisabled}
                />
            )}
        </ConvertRequiredAttributes>
    );
};

const messages = defineMessages({
    toPrivateConfirm: {
        id: 'admin.team_channel_settings.convertAndRemoveConfirmModal.toPrivateConfirm',
        defaultMessage:
            'Yes, convert channel to private and remove {amount, number} {amount, plural, one {user} other {users}}',
    },
    toPrivateMessage: {
        id: 'admin.team_channel_settings.convertConfirmModal.toPrivateMessageFirstLine',
        defaultMessage:
            'When you convert {displayName} to a private channel, history and membership are preserved. Publicly shared files remain accessible to anyone with the link. Membership in a private channel is by invitation only.',
    },
    toPrivateMessageSecondLine: {
        id: 'admin.team_channel_settings.convertConfirmModal.toPrivateMessageSecondLine',
        defaultMessage:
            'Are you sure you want to convert {displayName} to a private channel?',
    },
    toPrivateTitle: {
        id: 'admin.team_channel_settings.convertAndRemoveConfirmModal.toPrivateTitle',
        defaultMessage:
            'Convert channel to private and remove {amount, number} {amount, plural, one {user} other {users}}?',
    },
    toPublicConfirm: {
        id: 'admin.team_channel_settings.convertAndRemoveConfirmModal.toPublicConfirm',
        defaultMessage:
            'Yes, convert channel to public and remove {amount, number} {amount, plural, one {user} other {users}}',
    },
    toPublicMessage: {
        id: 'admin.team_channel_settings.convertConfirmModal.toPublicMessageFirstLine',
        defaultMessage:
            'When you convert {displayName} to a public channel, history and membership are preserved. Public channels are discoverable and can be joined by users on the system without invitation.',
    },
    toPublicMessageSecondLine: {
        id: 'admin.team_channel_settings.convertConfirmModal.toPublicMessageSecondLine',
        defaultMessage:
            'Are you sure you want to convert {displayName} to a public channel?',
    },
    toPublicTitle: {
        id: 'admin.team_channel_settings.convertAndRemoveConfirmModal.toPublicTitle',
        defaultMessage:
            'Convert channel to public and remove {amount, number} {amount, plural, one {user} other {users}}?',
    },
});

export default ConvertAndRemoveConfirmModal;
