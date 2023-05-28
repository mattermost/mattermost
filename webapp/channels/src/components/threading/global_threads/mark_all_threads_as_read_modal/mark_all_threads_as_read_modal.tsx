// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as React from 'react';
import {useIntl} from 'react-intl';

import {LegacyGenericModal} from '@mattermost/components';

import './mark_all_threads_as_read_modal.scss';

export type MarkAllThreadsAsReadModalProps = {
    onConfirm: () => void;
    onCancel: () => void;
}

function MarkAllThreadsAsReadModal({
    onConfirm,
    onCancel,
}: MarkAllThreadsAsReadModalProps) {
    const {formatMessage} = useIntl();

    return (
        <LegacyGenericModal
            className='mark-all-threads-as-read'
            id='mark-all-threads-as-read-modal'
            compassDesign={true}
            modalHeaderText={formatMessage({
                id: 'mark_all_threads_as_read_modal.title',
                defaultMessage: 'Mark all your threads as read?',
            })}
            confirmButtonText={formatMessage({
                id: 'mark_all_threads_as_read_modal.confirm',
                defaultMessage: 'Mark all as read',
            })}
            cancelButtonText={formatMessage({
                id: 'mark_all_threads_as_read_modal.cancel',
                defaultMessage: 'Cancel',
            })}
            onExited={onCancel}
            handleCancel={onCancel}
            handleConfirm={onConfirm}
        >
            <div className='mark_all_threads_as_read_modal__body'>
                <span>
                    {formatMessage({
                        id: 'mark_all_threads_as_read_modal.description',
                        defaultMessage: 'This will clear the unread state and mention badges on all your threads. Are you sure?',
                    })}
                </span>
            </div>
        </LegacyGenericModal>
    );
}

export default MarkAllThreadsAsReadModal;
