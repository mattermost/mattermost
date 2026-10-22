// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';

import {SectionNotice} from '@mattermost/compass-ui/components/section-notice';

import type {openModal as openModalAction} from 'actions/views/modals';

import ConfirmModalRedux from 'components/confirm_modal_redux';

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
        subtitleText,
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
                confirmButtonVariant: 'destructive',
                modalClass: 'integrations-backstage-modal',
                message: (
                    <>
                        {subtitleText && (
                            <p>
                                {subtitleText}
                            </p>
                        )}
                        {modalMessage && (
                            <SectionNotice
                                className='integration-delete-notice'
                                title={modalMessage}
                                type='danger'
                            />
                        )}
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
