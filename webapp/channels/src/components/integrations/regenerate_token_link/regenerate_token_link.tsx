// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';

import type {openModal as openModalAction} from 'actions/views/modals';

import ConfirmModalRedux from 'components/confirm_modal_redux';
import WarningIcon from 'components/widgets/icons/fa_warning_icon';

const ModalId = 'regenerate_token_confirm';

type Props = {
    confirmButtonText?: React.ReactNode;
    linkContent?: React.ReactNode;
    modalMessage?: React.ReactNode;
    modalTitle?: React.ReactNode;
    onRegenerate: () => void;
    openModal: typeof openModalAction;
};

export default function RegenerateTokenLink(props: Props) {
    const {
        confirmButtonText = (
            <FormattedMessage
                id='integrations.regenerate.confirm.button'
                defaultMessage='Yes, regenerate'
            />
        ),
        linkContent = (
            <i className='icon icon-refresh'/>
        ),
        modalMessage = (
            <FormattedMessage
                id='integrations.regenerate.confirm.message'
                defaultMessage='This will invalidate the current token and generate a new one. Any integrations using the old token will break. Are you sure you want to regenerate it?'
            />
        ),
        modalTitle = (
            <FormattedMessage
                id='integrations.regenerate.confirm.title'
                defaultMessage='Regenerate Token'
            />
        ),
        onRegenerate,
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
                    <div className='alert alert-warning'>
                        <WarningIcon additionalClassName='mr-1'/>
                        <strong>
                            {modalMessage}
                        </strong>
                    </div>
                ),
                onConfirm: onRegenerate,
                title: modalTitle,
            },
            dialogType: ConfirmModalRedux,
        });
    }, [confirmButtonText, modalMessage, modalTitle, onRegenerate, openModal]);

    return (
        <button
            className='color--link style--none'
            onClick={onClick}
            title='Regenerate Token'
            style={{padding: 0, marginLeft: '4px'}}
        >
            {linkContent}
        </button>
    );
}
