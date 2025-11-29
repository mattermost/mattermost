// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';

import ConfirmModal from 'components/confirm_modal';

interface Props {
    show: boolean;
    onConfirm: (skipConfirmation: boolean) => void;
    onCancel: () => void;
    loading?: boolean;
    showCheckbox?: boolean;
    isSenderDelete?: boolean;
}

const BurnOnReadConfirmationModal = ({show, onConfirm, onCancel, loading = false, showCheckbox = false, isSenderDelete = false}: Props) => {
    const {formatMessage} = useIntl();

    const handleConfirm = useCallback((checked: boolean) => {
        if (!loading) {
            onConfirm(checked);
        }
    }, [onConfirm, loading]);

    const handleCancel = useCallback(() => {
        if (!loading) {
            onCancel();
        }
    }, [onCancel, loading]);

    const title = formatMessage({
        id: 'post.burn_on_read.confirmation_modal.title',
        defaultMessage: 'Delete Message Now?',
    });

    const message = isSenderDelete ?
        formatMessage({
            id: 'post.burn_on_read.confirmation_modal.body_sender',
            defaultMessage: 'This message will be permanently deleted for all recipients right away. This action can\'t be undone. Are you sure you want to delete this message?',
        }) :
        formatMessage({
            id: 'post.burn_on_read.confirmation_modal.body_receiver',
            defaultMessage: 'This message will be permanently deleted for you right away and can\'t be undone.',
        });

    const confirmButtonText = loading ?
        formatMessage({
            id: 'post.burn_on_read.confirmation_modal.deleting',
            defaultMessage: 'Deleting...',
        }) :
        formatMessage({
            id: 'post.burn_on_read.confirmation_modal.confirm',
            defaultMessage: 'Delete Now',
        });

    const cancelButtonText = formatMessage({
        id: 'post.burn_on_read.confirmation_modal.cancel',
        defaultMessage: 'Cancel',
    });

    const checkboxText = formatMessage({
        id: 'post.burn_on_read.confirmation_modal.checkbox',
        defaultMessage: 'Do not ask me again',
    });

    return (
        <ConfirmModal
            id='burnOnReadConfirmationModal'
            show={show}
            title={title}
            message={message}
            confirmButtonClass='btn btn-danger'
            confirmButtonText={confirmButtonText}
            cancelButtonText={cancelButtonText}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
            confirmDisabled={loading}
            showCheckbox={showCheckbox}
            checkboxText={checkboxText}
            checkboxInFooter={true}
        />
    );
};

export default BurnOnReadConfirmationModal;
