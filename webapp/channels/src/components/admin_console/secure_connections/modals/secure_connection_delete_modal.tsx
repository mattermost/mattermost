// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {GenericModal} from '@mattermost/components';

type Props = {
    displayName: string;
    onConfirm: () => void;
    onCancel?: () => void;
    onExited: () => void;
}

const noop = () => {};

function SecureConnectionDeleteModal({
    displayName,
    onExited,
    onCancel,
    onConfirm,
}: Props) {
    const {formatMessage} = useIntl();

    const title = formatMessage({
        id: 'admin.secure_connections.confirm.delete.title',
        defaultMessage: 'Delete secure connection',
    });

    const confirmButtonText = formatMessage({
        id: 'admin.secure_connections.confirm.delete.button',
        defaultMessage: 'Yes, delete',
    });

    const message = (
        <FormattedMessage
            id={'admin.secure_connections.confirm.delete.text'}
            defaultMessage={'Are you sure you want to delete the secure connection <strong>{displayName}</strong>?'}
            values={{
                strong: (chunk: string) => <strong>{chunk}</strong>,
                displayName,
            }}
        />
    );

    return (
        <GenericModal
            confirmButtonText={confirmButtonText}
            handleCancel={onCancel ?? noop}
            handleConfirm={onConfirm}
            modalHeaderText={title}
            onExited={onExited}
            compassDesign={true}
            isDeleteModal={true}
        >
            {message}
        </GenericModal>
    );
}

export default SecureConnectionDeleteModal;
