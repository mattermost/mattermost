// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {useIntl} from 'react-intl';

import {GenericModal} from '@mattermost/components';

export type MarkAllThreadsAsReadModalProps = {
    onConfirm: () => void;
    onCancel: () => void;
}

function MarkAllThreadsAsReadModal({
    onConfirm,
    onCancel,
}: MarkAllThreadsAsReadModalProps) {
    const {formatMessage} = useIntl();
    const [show, setShow] = useState(true);

    const handleConfirm = useCallback(() => {
        onConfirm();
        setShow(false);
    }, [onConfirm]);

    const handleCancel = useCallback(() => {
        onCancel();
        setShow(false);
    }, [onCancel]);

    return (
        <GenericModal
            id='mark-all-threads-as-read-modal'
            className='MarkAllThreadsAsReadModal'
            modalHeaderText={formatMessage({
                id: 'mark_all_threads_as_read_modal.title',
                defaultMessage: 'Mark all your threads as read',
            })}
            show={show}
            onExited={onCancel}
            onHide={handleCancel}
            handleCancel={handleCancel}
            handleConfirm={handleConfirm}
            confirmButtonText={formatMessage({
                id: 'mark_all_threads_as_read_modal.confirm',
                defaultMessage: 'Mark all as read',
            })}
            compassDesign={true}
        >
            {formatMessage({
                id: 'mark_all_threads_as_read_modal.description',
                defaultMessage: 'All your threads will be marked as read, with unread and mention badges cleared. Do you want to continue?',
            })}
        </GenericModal>
    );
}

export default MarkAllThreadsAsReadModal;
