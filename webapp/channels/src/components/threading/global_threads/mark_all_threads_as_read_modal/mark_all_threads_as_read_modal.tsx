// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {useIntl} from 'react-intl';

import ConfirmModal from 'components/confirm_modal';

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
        <ConfirmModal
            id='mark-all-threads-as-read-modal'
            show={show}
            title={formatMessage({
                id: 'mark_all_threads_as_read_modal.title',
                defaultMessage: 'Mark all your threads as read?',
            })}
            message={formatMessage({
                id: 'mark_all_threads_as_read_modal.description',
                defaultMessage: 'This will clear the unread state and mention badges on all your threads. Are you sure?',
            })}
            confirmButtonText={formatMessage({
                id: 'mark_all_threads_as_read_modal.confirm',
                defaultMessage: 'Mark all as read',
            })}
            confirmButtonClass='btn btn-primary'
            onConfirm={handleConfirm}
            onCancel={handleCancel}
            onExited={onCancel}
        />
    );
}

export default MarkAllThreadsAsReadModal;
