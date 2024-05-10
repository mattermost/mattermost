// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import ConfirmModal from 'components/confirm_modal';
import FormattedMarkdownMessage from 'components/formatted_markdown_message';

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
    let title;
    if (toPublic) {
        title = (
            <FormattedMessage
                id='admin.team_channel_settings.convertConfirmModal.toPublicTitle'
                defaultMessage='Convert {displayName} to a public channel?'
                values={{displayName}}
            />
        );
    } else {
        title = (
            <FormattedMessage
                id='admin.team_channel_settings.convertConfirmModal.toPrivateTitle'
                defaultMessage='Convert {displayName} to a private channel?'
                values={{displayName}}
            />
        );
    }

    let message;
    if (toPublic) {
        message = (
            <FormattedMarkdownMessage
                id='admin.team_channel_settings.convertConfirmModal.toPublicMessage'
                defaultMessage='When you convert **{displayName}** to a public channel, history and membership are preserved. Public channels are discoverable and can by joined by users on the system without invitation.  \n \nAre you sure you want to convert **{displayName}** to a public channel?'
                values={{displayName}}
            />
        );
    } else {
        message = (
            <FormattedMarkdownMessage
                id='admin.team_channel_settings.convertConfirmModal.toPrivateMessage'
                defaultMessage='When you convert **{displayName}** to a private channel, history and membership are preserved. Publicly shared files remain accessible to anyone with the link. Membership in a private channel is by invitation only.  \n \nAre you sure you want to convert **{displayName}** to a private channel?'
                values={{displayName}}
            />
        );
    }

    let confirmButton;
    if (toPublic) {
        confirmButton = (
            <FormattedMessage
                id='admin.team_channel_settings.convertConfirmModal.toPublicConfirm'
                defaultMessage='Yes, convert to public channel'
            />
        );
    } else {
        confirmButton = (
            <FormattedMessage
                id='admin.team_channel_settings.convertConfirmModal.toPrivateConfirm'
                defaultMessage='Yes, convert to private channel'
            />
        );
    }

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

export default ConvertConfirmModal;
