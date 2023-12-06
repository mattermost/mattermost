// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import ConfirmModal from 'components/confirm_modal';

import {t} from 'utils/i18n';

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
     * Indicates if the message is for removal from channel or team
     */
    inChannel: boolean;

    /*
     * Number of users to be removed
     */
    amount: number;
};

const RemoveConfirmModal = ({show, onConfirm, onCancel, inChannel, amount}: Props) => {
    const title = (
        <FormattedMessage
            id='admin.team_channel_settings.removeConfirmModal.title'
            defaultMessage='Save and remove {amount, number} {amount, plural, one {user} other {users}}?'
            values={{amount}}
        />
    );

    const messageId = inChannel ? t('admin.team_channel_settings.removeConfirmModal.messageChannel') : t('admin.team_channel_settings.removeConfirmModal.messageTeam');
    const messageChannel = '{amount, number} {amount, plural, one {user} other {users}} will be removed. They are not in groups linked to this channel. Are you sure you wish to remove {amount, plural, one {this user} other {these users}}?';
    const messageTeam = '{amount, number} {amount, plural, one {user} other {users}} will be removed. They are not in groups linked to this team. Are you sure you wish to remove {amount, plural, one {this user} other {these users}}?';

    const message = (
        <FormattedMessage
            id={messageId}
            defaultMessage={inChannel ? messageChannel : messageTeam}
            values={{amount}}
        />
    );

    const buttonClass = 'btn btn-primary';
    const button = (
        <FormattedMessage
            id='admin.team_channel_settings.removeConfirmModal.remove'
            defaultMessage='Save and remove {amount, plural, one {user} other {users}}'
            values={{amount}}
        />
    );

    const modalClass = 'discard-changes-modal';

    return (
        <ConfirmModal
            show={show}
            title={title}
            message={message}
            modalClass={modalClass}
            confirmButtonClass={buttonClass}
            confirmButtonText={button}
            onConfirm={onConfirm}
            onCancel={onCancel}
        />
    );
};

export default RemoveConfirmModal;
