// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {styled} from '@mui/material/styles';
import Dialog from '@mui/material/Dialog';
import MUIPaper, {PaperProps} from '@mui/material/Paper';
import Slide from '@mui/material/Slide';
import {TransitionProps} from '@mui/material/transitions';

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
}

const BaseModal = ({children, isOpen, onClose, dialogClassName = '', dialogId = ''}: ModalProps) => (
    <Dialog
        open={isOpen}
        TransitionComponent={Transition}
        PaperComponent={Paper}
        keepMounted={true}
        onClose={onClose}
        aria-describedby='alert-dialog-slide-description'
        role='dialog'
        className={dialogClassName}
        id={dialogId}
    >{children}
    </Dialog>
);

export default BaseModal;
