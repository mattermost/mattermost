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
};

const ConvertConfirmModal = ({show, onConfirm, onCancel, displayName, toPublic}: Props) => {
    const toPublicMsg = 'When you convert **{displayName}** to a public channel, history and membership are preserved. Public channels are discoverable and can by joined by users on the system without invitation.  \n \nAre you sure you want to convert **{displayName}** to a public channel?';
    const toPrivateMsg = 'When you convert **{displayName}** to a private channel, history and membership are preserved. Publicly shared files remain accessible to anyone with the link. Membership in a private channel is by invitation only.  \n \nAre you sure you want to convert **{displayName}** to a private channel?';
    const messageId = toPublic ? t('admin.team_channel_settings.convertConfirmModal.toPublicMessage') :
        t('admin.team_channel_settings.convertConfirmModal.toPrivateMessage');

    const toPublicTitle = 'Convert {displayName} to a public channel?';
    const toPrivateTitle = 'Convert {displayName} to a private channel?';
    const titleId = toPublic ? t('admin.team_channel_settings.convertConfirmModal.toPublicTitle') :
        t('admin.team_channel_settings.convertConfirmModal.toPrivateTitle');

    const toPublicConfirmMsg = 'Yes, convert to public channel';
    const toPrivateConfirmMsg = 'Yes, convert to private channel';
    const confirmMsgId = toPublic ? t('admin.team_channel_settings.convertConfirmModal.toPublicConfirm') :
        t('admin.team_channel_settings.convertConfirmModal.toPrivateConfirm');

    const title = (
        <FormattedMessage
            id={titleId}
            defaultMessage={toPublic ? toPublicTitle : toPrivateTitle}
            values={{displayName}}
        />
    );

    const message = (
        <FormattedMarkdownMessage
            id={messageId}
            defaultMessage={toPublic ? toPublicMsg : toPrivateMsg}
            values={{displayName}}
        />
    );

    const confirmButton = (
        <FormattedMessage
            id={confirmMsgId}
            defaultMessage={toPublic ? toPublicConfirmMsg : toPrivateConfirmMsg}
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

export default ConvertConfirmModal;
