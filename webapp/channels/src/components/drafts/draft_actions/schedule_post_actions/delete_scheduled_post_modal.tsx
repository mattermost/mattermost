// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import noop from 'lodash/noop';
import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {GenericModal} from '@mattermost/components';

type Props = {
    channelDisplayName: string;
    onConfirm: () => void;
    onExited: () => void;
}

export default function DeleteScheduledPostModal({
    channelDisplayName,
    onExited,
    onConfirm,
}: Props) {
    const {formatMessage} = useIntl();

    const title = formatMessage({
        id: 'scheduled_post.delete_modal.title',
        defaultMessage: 'Delete scheduled post',
    });

    const confirmButtonText = formatMessage({
        id: 'drafts.confirm.delete.button',
        defaultMessage: 'Yes, delete',
    });

    const message = (
        <FormattedMessage
            id={'scheduled_post.delete_modal.body'}
            defaultMessage={'Are you sure you want to delete this scheduled post to <strong>{displayName}</strong>?'}
            values={{
                strong: (chunk: string) => <strong>{chunk}</strong>,
                displayName: channelDisplayName,
            }}
        />
    );

    return (
        <GenericModal
            confirmButtonText={confirmButtonText}
            handleCancel={noop}
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
