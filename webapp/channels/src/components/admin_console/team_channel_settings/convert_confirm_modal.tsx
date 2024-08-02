// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, defineMessages} from 'react-intl';

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
    let titleMessage;
    let convertMessage;
    let confirmMessage;
    if (toPublic) {
        titleMessage = messages.toPublicTitle;
        convertMessage = messages.toPublicMessage;
        confirmMessage = messages.toPublicConfirm;
    } else {
        titleMessage = messages.toPrivateTitle;
        convertMessage = messages.toPrivateMessage;
        confirmMessage = messages.toPrivateConfirm;
    }

    const title = (
        <FormattedMessage
            {...titleMessage}
            values={{displayName}}
        />
    );

    const message = (
        <FormattedMarkdownMessage
            {...convertMessage}
            values={{displayName}}
        />
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
        id: 'admin.team_channel_settings.convertConfirmModal.toPrivateMessage',

        // This eslint-disable comment can be removed once this component no longer uses FormattedMarkdownMessage
        // eslint-disable-next-line formatjs/no-multiple-whitespaces
        defaultMessage: 'When you convert **{displayName}** to a private channel, history and membership are preserved. Publicly shared files remain accessible to anyone with the link. Membership in a private channel is by invitation only.  \n \nAre you sure you want to convert **{displayName}** to a private channel?',
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
        id: 'admin.team_channel_settings.convertConfirmModal.toPublicMessage',

        // This eslint-disable comment can be removed once this component no longer uses FormattedMarkdownMessage
        // eslint-disable-next-line formatjs/no-multiple-whitespaces
        defaultMessage: 'When you convert **{displayName}** to a public channel, history and membership are preserved. Public channels are discoverable and can by joined by users on the system without invitation.  \n \nAre you sure you want to convert **{displayName}** to a public channel?',
    },
    toPublicTitle: {
        id: 'admin.team_channel_settings.convertConfirmModal.toPublicTitle',
        defaultMessage: 'Convert {displayName} to a public channel?',
    },
});

export default ConvertConfirmModal;
