// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import noop from 'lodash/noop';
import React, {useCallback, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {GenericModal} from '@mattermost/components';

type Props = {
    channelDisplayName?: string;
    onConfirm: () => Promise<{error?: string}>;
    onExited: () => void;
}

export default function DeleteScheduledPostModal({
    channelDisplayName,
    onExited,
    onConfirm,
}: Props) {
    const {formatMessage} = useIntl();
    const [errorMessage, setErrorMessage] = useState<string>();

    const title = formatMessage({
        id: 'scheduled_post.delete_modal.title',
        defaultMessage: 'Delete scheduled post',
    });

    const confirmButtonText = formatMessage({
        id: 'drafts.confirm.delete.button',
        defaultMessage: 'Yes, delete',
    });

    const handleOnConfirm = useCallback(async () => {
        const response = await onConfirm();
        if (response.error) {
            setErrorMessage(response.error);
        } else {
            onExited();
        }
    }, [onConfirm, onExited]);

    return (
        <GenericModal
            className='delete_scheduled_post_modal'
            confirmButtonText={confirmButtonText}
            handleCancel={noop}
            handleConfirm={handleOnConfirm}
            modalHeaderText={title}
            onExited={onExited}
            compassDesign={true}
            isDeleteModal={true}
            autoFocusConfirmButton={true}
            autoCloseOnConfirmButton={false}
            errorText={errorMessage}
        >
            {
                channelDisplayName &&
                <FormattedMessage
                    id={'scheduled_post.delete_modal.body'}
                    defaultMessage={'Are you sure you want to delete this scheduled post to <strong>{displayName}</strong>?'}
                    values={{
                        strong: (chunk: string) => <strong>{chunk}</strong>,
                        displayName: channelDisplayName,
                    }}
                />
            }

            {
                !channelDisplayName &&
                <FormattedMessage
                    id={'scheduled_post.delete_modal.body_no_channel'}
                    defaultMessage={'Are you sure you want to delete this scheduled post?'}
                />
            }
        </GenericModal>
    );
}
