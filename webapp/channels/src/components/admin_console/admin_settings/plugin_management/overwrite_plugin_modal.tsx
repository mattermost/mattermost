// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import ConfirmModal from 'components/confirm_modal';

const title = (
    <FormattedMessage
        id='admin.plugin.upload.overwrite_modal.title'
        defaultMessage='Overwrite existing plugin?'
    />
);

const message = (
    <FormattedMessage
        id='admin.plugin.upload.overwrite_modal.desc'
        defaultMessage='A plugin with this ID already exists. Would you like to overwrite it?'
    />
);

const overwriteButton = (
    <FormattedMessage
        id='admin.plugin.upload.overwrite_modal.overwrite'
        defaultMessage='Overwrite'
    />
);

const OverwritePluginModal = ({
    onCancel,
    onConfirm,
    show,
}: PluginSettingsModalProps) => {
    return (
        <ConfirmModal
            show={show}
            title={title}
            message={message}
            confirmButtonClass='btn btn-danger'
            confirmButtonText={overwriteButton}
            onConfirm={onConfirm}
            onCancel={onCancel}
        />
    );
};

export default OverwritePluginModal;
