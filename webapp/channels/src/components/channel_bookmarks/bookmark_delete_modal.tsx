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

function BookmarkDeleteModal({
    displayName,
    onExited,
    onCancel,
    onConfirm,
}: Props) {
    const {formatMessage} = useIntl();

    const title = formatMessage({
        id: 'channel_bookmarks.confirm.delete.title',
        defaultMessage: 'Delete bookmark',
    });

    const confirmButtonText = formatMessage({
        id: 'channel_bookmarks.confirm.delete.button',
        defaultMessage: 'Yes, delete',
    });

    const message = (
        <FormattedMessage
            id={'channel_bookmarks.confirm.delete.text'}
            defaultMessage={'Are you sure you want to delete the bookmark <strong>{displayName}</strong>?'}
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

export default BookmarkDeleteModal;
