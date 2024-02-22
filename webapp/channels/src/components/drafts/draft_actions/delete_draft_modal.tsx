// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {GenericModal} from '@mattermost/components';

type Props = {
    displayName: string;
    onConfirm: () => void;
    onExited: () => void;
}

function DeleteDraftModal({
    displayName,
    onExited,
    onConfirm,
}: Props) {
    const {formatMessage} = useIntl();

    const title = formatMessage({
        id: 'drafts.confirm.delete.title',
        defaultMessage: 'Delete draft',
    });

    const confirmButtonText = formatMessage({
        id: 'drafts.confirm.delete.button',
        defaultMessage: 'Yes, delete',
    });

    const message = (
        <FormattedMessage
            id={'drafts.confirm.delete.text'}
            defaultMessage={'Are you sure you want to delete this draft to <strong>{displayName}</strong>?'}
            values={{
                strong: (chunk: string) => <strong>{chunk}</strong>,
                displayName,
            }}
        />
    );

    return (
        <GenericModal
            confirmButtonText={confirmButtonText}
            handleCancel={() => {}}
            handleConfirm={onConfirm}
            modalHeaderText={title}
            onExited={onExited}
            compassDesign={true}
            isDeleteModal={true}
            autoFocusConfirmButton={true}
        >
            {message}
        </GenericModal>
    );
}

export default DeleteDraftModal;
