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

export default function DeleteIntegrationLink(props: Props) {
    const {
        confirmButtonText = (
            <FormattedMessage
                id='integrations.delete.confirm.button'
                defaultMessage='Yes, delete it'
            />
        ),
        linkText = (
            <FormattedMessage
                id='installed_integrations.delete'
                defaultMessage='Delete'
            />
        ),
        modalMessage,
        modalTitle = (
            <FormattedMessage
                id='integrations.delete.confirm.title'
                defaultMessage='Delete Integration'
            />
        ),
        onDelete,
        openModal,
    } = props;

    const onClick = useCallback(() => {
        openModal({
            modalId: ModalId,
            dialogProps: {
                confirmButtonText,
                confirmButtonClass: 'btn btn-danger',
                modalClass: 'integrations-backstage-modal',
                message: (
                    <>
                        {props.subtitleText && (
                            <p>
                                {props.subtitleText}
                            </p>
                        )}
                        <div className='alert alert-danger'>
                            <WarningIcon additionalClassName='mr-1'/>
                            <strong>
                                {props.modalMessage}
                            </strong>
                        </div>
                    </>
                ),
                onConfirm: onDelete,
                title: modalTitle,
            },
            dialogType: ConfirmModalRedux,
        });
    }, [confirmButtonText, modalMessage, modalTitle, onDelete, openModal]);

    return (
        <button
            className='color--link style--none'
            onClick={onClick}
        >
            {linkText}
        </button>
    );
}
