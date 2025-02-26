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
};

const ConvertConfirmModal = ({show, onConfirm, onCancel, displayName, toPublic}: Props) => {
    let titleMessage;
    let convertMessage;
    let confirmMessage;
    let convertConfirmationMessage;
    if (toPublic) {
        titleMessage = messages.toPublicTitle;
        convertMessage = messages.toPublicMessage;
        confirmMessage = messages.toPublicConfirm;
        convertConfirmationMessage = messages.toPublicMessageConfirmation;
    } else {
        titleMessage = messages.toPrivateTitle;
        convertMessage = messages.toPrivateMessage;
        confirmMessage = messages.toPrivateConfirm;
        convertConfirmationMessage = messages.toPrivateMessageConfirmation;
    }

    const title = (
        <FormattedMessage
            {...titleMessage}
            values={{displayName}}
        />
    );

    const message = (
        <>
            <p>
                <FormattedMessage
                    {...convertMessage}
                    values={{displayName: <strong>{displayName}</strong>}}
                />
            </p>
            <p>
                <FormattedMessage
                    {...convertConfirmationMessage}
                    values={{displayName: <strong>{displayName}</strong>}}
                />
            </p>
        </>
    );

    const confirmButton = (
        <FormattedMessage
            {...confirmMessage}
        />
    );

    const cancelButton = (
        <FormattedMessage
            id='admin.team_channel_settings.convertConfirmModal.cancel'
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
        id: 'admin.team_channel_settings.convertConfirmModal.toPrivateConfirm',
        defaultMessage: 'Yes, convert to private channel',
    },
    toPrivateMessage: {
        id: 'admin.team_channel_settings.convertConfirmModal.toPrivateMessageFirstLine',
        defaultMessage: 'When you convert {displayName} to a private channel, history and membership are preserved. Publicly shared files remain accessible to anyone with the link. Membership in a private channel is by invitation only.',
    },
    toPrivateMessageConfirmation: {
        id: 'admin.team_channel_settings.convertConfirmModal.toPrivateMessageSecondLine',
        defaultMessage: 'Are you sure you want to convert {displayName} to a private channel?',
    },
    toPrivateTitle: {
        id: 'admin.team_channel_settings.convertConfirmModal.toPrivateTitle',
        defaultMessage: 'Convert {displayName} to a private channel?',
    },
    toPublicConfirm: {
        id: 'admin.team_channel_settings.convertConfirmModal.toPublicConfirm',
        defaultMessage: 'Yes, convert to public channel',
    },
    toPublicMessage: {
        id: 'admin.team_channel_settings.convertConfirmModal.toPublicMessageFirstLine',
        defaultMessage: 'When you convert {displayName} to a public channel, history and membership are preserved. Public channels are discoverable and can be joined by users on the system without invitation.',
    },
    toPublicMessageConfirmation: {
        id: 'admin.team_channel_settings.convertConfirmModal.toPublicMessageSecondLine',
        defaultMessage: 'Are you sure you want to convert {displayName} to a public channel?',
    },
    toPublicTitle: {
        id: 'admin.team_channel_settings.convertConfirmModal.toPublicTitle',
        defaultMessage: 'Convert {displayName} to a public channel?',
    },
});

export default ConvertConfirmModal;
