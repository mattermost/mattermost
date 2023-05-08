// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import Button from '@mui/material/Button';
import DialogActions from '@mui/material/DialogActions';
import BaseModal from './base_modal';
import ModalHeader from './modal_header';
import {FormattedMessage} from "react-intl";

type ModalProps = {
    title: string | React.ReactNode;
    children: React.ReactNode | React.ReactNodeArray;
    isOpen: boolean;
    dialogClassName?: string;
    dialogId?: string;
    onClose?: () => void;
    onConfirm?: () => void;
    onCancel?: () => void;
    cancelButtonText?: React.ReactNode;
    confirmButtonText?: React.ReactNode;
}

const GenericModal = ({title, children, isOpen, onClose, confirmButtonText, cancelButtonText, onConfirm, onCancel, dialogClassName = '', dialogId = ''}: ModalProps) => {
    const hasActions = Boolean(onConfirm || onCancel);

    const handleConfirmAction = () => {
        onConfirm?.();
        onClose?.();
    };

    const handleCancelAction = () => {
        onCancel?.();
        onClose?.();
    };

    return (
            <BaseModal
                isOpen={isOpen}
                onClose={onClose}
                aria-describedby='alert-dialog-slide-description'
                dialogClassName={dialogClassName}
                dialogId={dialogId}
            >
                <ModalHeader
                    title={title}
                    onClose={onClose}
                />
                {children}
                {hasActions && (
                    <DialogActions>
                        {onCancel && <Button onClick={handleCancelAction}>
                            {cancelButtonText
                             || <FormattedMessage
                                id='generic_modal.cancel'
                                defaultMessage='Cancel'
                            />}
                        </Button>}
                        {onConfirm && <Button variant='contained' onClick={handleConfirmAction}>
                            {confirmButtonText ||
                                <FormattedMessage
                                id='generic_modal.confirm'
                                defaultMessage='Confirm'
                            />}
                        </Button>}
                    </DialogActions>
                )}
            </BaseModal>
    );
};

export default GenericModal;

// TODO:Find some solution for translations, right now we are using the t function in webapp/channels/src/components/generic_modal.tsx.
// https://mattermost.atlassian.net/browse/MM-52680
