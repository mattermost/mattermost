// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {CloseIcon} from '@mattermost/compass-icons/components';
import IconProps from '@mattermost/compass-icons/components/props';
import {IconButton, SnackbarCloseReason} from '@mui/material';
import React from 'react';
import Snackbar, {SnackbarProps} from '@mui/material/Snackbar';

type Props = Omit<SnackbarProps, 'sx'> & {
    Icon?: React.FC<IconProps>;
    showCloseButton?: boolean;
};

const Toast = ({message, Icon, action, onClose, open, autoHideDuration, showCloseButton = false}: Props) => {
    const handleClose = (event: React.SyntheticEvent<any> | Event, reason?: SnackbarCloseReason) => {
        if (!reason) {
            onClose?.(event, 'escapeKeyDown');
        }
    };

    const toastActions = (
        <>
            {action}
            {(showCloseButton || !autoHideDuration) && (
                <IconButton
                    onClick={handleClose}
                    color={'inherit'}
                >
                    <CloseIcon size={18}/>
                </IconButton>
            )}
        </>
    );

    const toastMessage = (
        <>
            {Icon && <Icon size={24}/>}
            {message}
        </>
    );

    return (
        <Snackbar
            open={open}
            onClose={onClose}
            autoHideDuration={autoHideDuration}
            message={toastMessage}
            action={toastActions}
        />
    );
};

export default Toast;
