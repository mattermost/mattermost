// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, defineMessages} from 'react-intl';

import ConfirmModal from 'components/confirm_modal';

type Props = {

    /*
     * Bool whether the modal is shown
     */
    show: boolean;

    /*
     * Action to call on confirm
     */
    onConfirm: (checked: boolean) => void;

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
};

const ConvertAndRemoveConfirmModal = ({
    show,
    onConfirm,
    onCancel,
    displayName,
    toPublic,
    removeAmount,
}: Props) => {
    const titleMessage = toPublic ?
        messages.toPublicTitle :
        messages.toPrivateTitle;

    const convertMessage = toPublic ?
        messages.toPublicMessage :
        messages.toPrivateMessage;

    const convertMessageSecondLine = toPublic ?
        messages.toPublicMessageSecondLine :
        messages.toPrivateMessageSecondLine;

    const confirmMessage = toPublic ?
        messages.toPublicConfirm :
        messages.toPrivateConfirm;

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
            confirmButtonClass={'btn btn-primary'}
            confirmButtonText={confirmButton}
            cancelButtonText={cancelButton}
            onConfirm={onConfirm}
            onCancel={onCancel}
        />
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
