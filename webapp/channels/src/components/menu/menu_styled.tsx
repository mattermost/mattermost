// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import MuiMenu from '@mui/material/Menu';
import type {MenuProps as MuiMenuProps} from '@mui/material/Menu';
import MuiPopover from '@mui/material/Popover';
import type {PopoverProps as MuiPopoverProps} from '@mui/material/Popover';
import {styled} from '@mui/material/styles';

interface PopoverProps extends MuiPopoverProps {
    width?: string;
}

interface MenuProps extends MuiMenuProps {
    width?: string;
}

/**
 * A styled version of the Material-UI Popover component with few overrides.
 * @warning This component is meant to be only used inside of the SubMenu component directory.
 */
export const MuiPopoverStyled = styled(MuiPopover)<PopoverProps>(
    ({width}) => ({
        '& .MuiPaper-root': {
            paddingTop: '4px',
            paddingBottom: '4px',
            backgroundColor: 'var(--center-channel-bg)',
            boxShadow: 'var(--elevation - 5), 0 0 0 1px rgba(var(--center-channel-color-rgb), 0.12) inset',
            minWidth: '114px',
            maxWidth: '496px',
            maxHeight: '80vh',
            width,
        },
    }),
);

export const MuiMenuStyled = styled(MuiMenu)<MenuProps>(
    ({width}) => ({
        '& .MuiPaper-root': {
            backgroundColor: 'var(--center-channel-bg)',
            boxShadow: 'var(--elevation-4), 0 0 0 1px rgba(var(--center-channel-color-rgb), 0.12) inset',
            minWidth: '114px',
            maxWidth: '496px',
            maxHeight: '80vh',
            width,
        },
    }),
);
