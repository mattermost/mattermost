// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';

import type {openModal as openModalAction} from 'actions/views/modals';

import ConfirmModalRedux from 'components/confirm_modal_redux';
import WarningIcon from 'components/widgets/icons/fa_warning_icon';

const ModalId = 'delete_integration_confirm';

type Props = {
    confirmButtonText?: React.ReactNode;
    linkText?: React.ReactNode;
    subtitleText?: React.ReactNode;
    modalMessage?: React.ReactNode;
    modalTitle?: React.ReactNode;
    onDelete: () => void;
    openModal: typeof openModalAction;
};

const defaultConfirmButtonText = (
    <FormattedMessage
        id='integrations.delete.confirm.button'
        defaultMessage='Yes, delete it'
    />
);

const defaultLinkText = (
    <FormattedMessage
        id='installed_integrations.delete'
        defaultMessage='Delete'
    />
);

const defaultModalTitle = (
    <FormattedMessage
        id='integrations.delete.confirm.title'
        defaultMessage='Delete Integration'
    />
);

export default function DeleteIntegrationLink({
    confirmButtonText = defaultConfirmButtonText,
    linkText = defaultLinkText,
    modalMessage,
    modalTitle = defaultModalTitle,
    onDelete,
    openModal,
    subtitleText,
}: Props) {
    const onClick = useCallback(() => {
        openModal({
            modalId: ModalId,
            dialogProps: {
                confirmButtonText,
                confirmButtonClass: 'btn btn-danger',
                modalClass: 'integrations-backstage-modal',
                message: (
                    <>
                        {subtitleText && (
                            <p>
                                {subtitleText}
                            </p>
                        )}
                        <div className='alert alert-danger'>
                            <WarningIcon additionalClassName='mr-1'/>
                            <strong>
                                {modalMessage}
                            </strong>
                        </div>
                    </>
                ),
                onConfirm: onDelete,
                title: modalTitle,
            },
            dialogType: ConfirmModalRedux,
        });
    }, [confirmButtonText, modalMessage, modalTitle, onDelete, openModal, subtitleText]);

    return (
        <button
            className='color--link style--none'
            onClick={onClick}
        >
            {linkText}
        </button>
    );
}
