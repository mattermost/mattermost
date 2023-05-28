// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {styled} from '@mui/material/styles';
import Button from '@mui/material/Button';
import MUIPaper, {PaperProps} from '@mui/material/Paper';
import DialogActions from '@mui/material/DialogActions';
import Slide from '@mui/material/Slide';
import {TransitionProps} from '@mui/material/transitions';
import BaseModal from "../base_modal/base_modal";

const Transition = React.forwardRef((
    {children, ...props}: TransitionProps & {
        children: React.ReactElement<any, any>;
    },
    ref: React.Ref<unknown>,
) => {
    return (
        <Slide
            direction='up'
            ref={ref}
            {...props}
        >
            {children}
        </Slide>
    );
});

const Paper = styled(MUIPaper)<PaperProps>(() => ({
    border: '1px solid rgba(var(--center-channel-color-rgb), 0.16)',
    borderRadius: 12,
    backgroundColor: 'var(--center-channel-bg)',
    boxShadow: '0 20px 32px 0 rgba(0, 0, 0, 0.12)',
    minWidth: 600,
}));

type ModalProps = {
    children: React.ReactNode | React.ReactNodeArray;
    isOpen: boolean;
    dialogClassName?: string;
    dialogId?: string;
    onClose?: () => void;
    onConfirm?: () => void;
    onCancel?: () => void;
}

const GenericModal = ({children, isOpen, onClose, onConfirm, onCancel, dialogClassName = '', dialogId = ''}: ModalProps) => {
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
                {children}
                {hasActions && (
                    <DialogActions>
                        {onCancel && <Button onClick={handleCancelAction}>{'Cancel'}</Button>}
                        {onConfirm && <Button onClick={handleConfirmAction}>{'Confirm'}</Button>}
                    </DialogActions>
                )}
            </BaseModal>
    );
};

export default memo(GenericModal);
