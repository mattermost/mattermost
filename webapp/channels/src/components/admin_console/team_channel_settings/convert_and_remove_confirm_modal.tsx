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

    /*
     * Number of users to be removed
     */
    removeAmount: number;
};

const ConvertAndRemoveConfirmModal = ({show, onConfirm, onCancel, displayName, toPublic, removeAmount}: Props) => {
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
            values={{amount: removeAmount}}
        />
    );

    const message = (
        <div>
            <p>
                <FormattedMarkdownMessage
                    {...convertMessage}
                    values={{displayName}}
                />
            </p>
            <p>
                <FormattedMessage
                    id='admin.team_channel_settings.removeConfirmModal.messageChannel'
                    defaultMessage='{amount, number} {amount, plural, one {user} other {users}} will be removed. They are not in groups linked to this channel. Are you sure you wish to remove these users?'
                    values={{amount: removeAmount}}
                />
            </p>
        </div>
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
        defaultMessage: 'Yes, convert channel to private and remove {amount, number} {amount, plural, one {user} other {users}}',
    },
    toPrivateMessage: {
        id: 'admin.team_channel_settings.convertConfirmModal.toPrivateMessage',

        // This eslint-disable comment can be removed once this component no longer uses FormattedMarkdownMessage
        // eslint-disable-next-line formatjs/no-multiple-whitespaces
        defaultMessage: 'When you convert **{displayName}** to a private channel, history and membership are preserved. Publicly shared files remain accessible to anyone with the link. Membership in a private channel is by invitation only.  \n \nAre you sure you want to convert **{displayName}** to a private channel?',
    },
    toPrivateTitle: {
        id: 'admin.team_channel_settings.convertAndRemoveConfirmModal.toPrivateTitle',
        defaultMessage: 'Convert channel to private and remove {amount, number} {amount, plural, one {user} other {users}}?',
    },
    toPublicConfirm: {
        id: 'admin.team_channel_settings.convertAndRemoveConfirmModal.toPublicConfirm',
        defaultMessage: 'Yes, convert channel to public and remove {amount, number} {amount, plural, one {user} other {users}}',
    },
    toPublicMessage: {
        id: 'admin.team_channel_settings.convertConfirmModal.toPublicMessage',

        // This eslint-disable comment can be removed once this component no longer uses FormattedMarkdownMessage
        // eslint-disable-next-line formatjs/no-multiple-whitespaces
        defaultMessage: 'When you convert **{displayName}** to a public channel, history and membership are preserved. Public channels are discoverable and can by joined by users on the system without invitation.  \n \nAre you sure you want to convert **{displayName}** to a public channel?',
    },
    toPublicTitle: {
        id: 'admin.team_channel_settings.convertAndRemoveConfirmModal.toPublicTitle',
        defaultMessage: 'Convert channel to public and remove {amount, number} {amount, plural, one {user} other {users}}?',
    },
});

export default ConvertAndRemoveConfirmModal;
