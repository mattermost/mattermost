// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import ConfirmModal from 'components/confirm_modal';

type Props = {
    show: boolean;
    onConfirm: (checked: boolean) => void;
    onCancel: (checked: boolean) => void;
}

const DiscardChangesModal = ({
    show,
    onConfirm,
    onCancel,
}: Props) => {
    const title = (
        <FormattedMessage
            id='discard_changes_modal.title'
            defaultMessage='Discard Changes?'
        />
    );

    const message = (
        <FormattedMessage
            id='discard_changes_modal.message'
            defaultMessage='You have unsaved changes, are you sure you want to discard them?'
        />
    );

    const buttonClass = 'btn btn-primary';
    const button = (
        <FormattedMessage
            id='discard_changes_modal.leave'
            defaultMessage='Yes, Discard'
        />
    );

    const modalClass = 'discard-changes-modal';

    return (
        <ConfirmModal
            show={show}
            title={title}
            message={message}
            modalClass={modalClass}
            confirmButtonClass={buttonClass}
            confirmButtonText={button}
            onConfirm={onConfirm}
            onCancel={onCancel}
        />
    );
};

export default React.memo(DiscardChangesModal);
