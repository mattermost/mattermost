// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {t} from 'utils/i18n';
import FormattedMarkdownMessage from 'components/formatted_markdown_message';
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
    const toPublicMsg = 'When you convert **{displayName}** to a public channel, history and membership are preserved. Public channels are discoverable and can by joined by users on the system without invitation.  \n \nAre you sure you want to convert **{displayName}** to a public channel?';
    const toPrivateMsg = 'When you convert **{displayName}** to a private channel, history and membership are preserved. Publicly shared files remain accessible to anyone with the link. Membership in a private channel is by invitation only.  \n \nAre you sure you want to convert **{displayName}** to a private channel?';
    const convertMessageId = toPublic ? t('admin.team_channel_settings.convertConfirmModal.toPublicMessage') : t('admin.team_channel_settings.convertConfirmModal.toPrivateMessage');

    const toPublicTitle = 'Convert channel to public and remove {amount, number} {amount, plural, one {user} other {users}}?';
    const toPrivateTitle = 'Convert channel to private and remove {amount, number} {amount, plural, one {user} other {users}}?';
    const titleId = toPublic ? t('admin.team_channel_settings.convertAndRemoveConfirmModal.toPublicTitle') : t('admin.team_channel_settings.convertAndRemoveConfirmModal.toPrivateTitle');

    const toPublicConfirmMsg = 'Yes, convert channel to public and remove {amount, number} {amount, plural, one {user} other {users}}';
    const toPrivateConfirmMsg = 'Yes, convert channel to private and remove {amount, number} {amount, plural, one {user} other {users}}';
    const confirmMsgId = toPublic ? t('admin.team_channel_settings.convertAndRemoveConfirmModal.toPublicConfirm') : t('admin.team_channel_settings.convertAndRemoveConfirmModal.toPrivateConfirm');

    const title = (
        <FormattedMessage
            id={titleId}
            defaultMessage={toPublic ? toPublicTitle : toPrivateTitle}
            values={{displayName, amount: removeAmount}}
        />
    );

    const message = (
        <div>
            <p>
                <FormattedMarkdownMessage
                    id={convertMessageId}
                    defaultMessage={toPublic ? toPublicMsg : toPrivateMsg}
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
            id={confirmMsgId}
            defaultMessage={toPublic ? toPublicConfirmMsg : toPrivateConfirmMsg}
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

export default ConvertAndRemoveConfirmModal;
