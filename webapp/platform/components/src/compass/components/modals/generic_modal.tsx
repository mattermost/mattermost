// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import Button from '@mui/material/Button';
import DialogActions from '@mui/material/DialogActions';
import BaseModal from "./base_modal";
import ModalHeader from "./modal_header";

type ModalProps = {
    title: string | React.ReactNode;
    children: React.ReactNode | React.ReactNodeArray;
    isOpen: boolean;
    dialogClassName?: string;
    dialogId?: string;
    onClose?: () => void;
    onConfirm?: () => void;
    onCancel?: () => void;
}

const GenericModal = ({title, children, isOpen, onClose, onConfirm, onCancel, dialogClassName = '', dialogId = ''}: ModalProps) => {
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
                        {onCancel && <Button onClick={handleCancelAction}>{'Cancel'}</Button>}
                        {onConfirm && <Button variant='contained' onClick={handleConfirmAction}>{'Confirm'}</Button>}
                    </DialogActions>
                )}
            </BaseModal>
    );
};

export default GenericModal;
