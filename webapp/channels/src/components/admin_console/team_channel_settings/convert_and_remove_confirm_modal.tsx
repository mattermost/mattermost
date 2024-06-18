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

const ConvertAndRemoveConfirmModal = ({show, onConfirm, onCancel, displayName, toPublic, removeAmount}: Props) => {
    let titleMessage;
    let convertMessage1;
    let convertMessage2;
    let confirmMessage;
    if (toPublic) {
        titleMessage = messages.toPublicTitle;
        convertMessage1 = messages.toPublicMessage1;
        convertMessage2 = messages.toPublicMessage2;
        confirmMessage = messages.toPublicConfirm;
    } else {
        titleMessage = messages.toPrivateTitle;
        convertMessage1 = messages.toPrivateMessage1;
        convertMessage2 = messages.toPrivateMessage2;
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
                <FormattedMessage
                    {...convertMessage1}
                    values={{displayName}}
                />
            </p>
            <p>
                <FormattedMessage
                    {...convertMessage2}
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
    toPrivateMessage1: {
        id: 'admin.team_channel_settings.convertConfirmModal.toPrivateMessage1',
        defaultMessage: 'When you convert <strong>{displayName}</strong> to a private channel, history and membership are preserved. Publicly shared files remain accessible to anyone with the link. Membership in a private channel is by invitation only.',
    },
    toPrivateMessage2: {
        id: 'admin.team_channel_settings.convertConfirmModal.toPrivateMessage2',
        defaultMessage: 'Are you sure you want to convert <strong>{displayName}</strong> to a private channel?',
    },
    toPrivateTitle: {
        id: 'admin.team_channel_settings.convertAndRemoveConfirmModal.toPrivateTitle',
        defaultMessage: 'Convert channel to private and remove {amount, number} {amount, plural, one {user} other {users}}?',
    },
    toPublicConfirm: {
        id: 'admin.team_channel_settings.convertAndRemoveConfirmModal.toPublicConfirm',
        defaultMessage: 'Yes, convert channel to public and remove {amount, number} {amount, plural, one {user} other {users}}',
    },
    toPublicMessage1: {
        id: 'admin.team_channel_settings.convertConfirmModal.toPublicMessage1',
        defaultMessage: 'When you convert <strong>{displayName}</strong> to a public channel, history and membership are preserved. Public channels are discoverable and can by joined by users on the system without invitation.',
    },
    toPublicMessage2: {
        id: 'admin.team_channel_settings.convertConfirmModal.toPublicMessage2',
        defaultMessage: 'Are you sure you want to convert <strong>{displayName}</strong> to a public channel?',
    },
    toPublicTitle: {
        id: 'admin.team_channel_settings.convertAndRemoveConfirmModal.toPublicTitle',
        defaultMessage: 'Convert channel to public and remove {amount, number} {amount, plural, one {user} other {users}}?',
    },
});

export default ConvertAndRemoveConfirmModal;
