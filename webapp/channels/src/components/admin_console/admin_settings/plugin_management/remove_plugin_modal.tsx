// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import ConfirmModal from 'components/confirm_modal';

const title = (
    <FormattedMessage
        id='admin.plugin.remove_modal.title'
        defaultMessage='Remove plugin?'
    />
);

const message = (
    <FormattedMessage
        id='admin.plugin.remove_modal.desc'
        defaultMessage='Are you sure you would like to remove the plugin?'
    />
);

const removeButton = (
    <FormattedMessage
        id='admin.plugin.remove_modal.overwrite'
        defaultMessage='Remove'
    />
);

const RemovePluginModal = ({
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
            confirmButtonText={removeButton}
            onConfirm={onConfirm}
            onCancel={onCancel}
        />
    );
};

export default RemovePluginModal;
