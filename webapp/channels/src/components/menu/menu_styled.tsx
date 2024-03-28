// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import MuiMenu from '@mui/material/Menu';
import type {MenuProps as MuiMenuProps} from '@mui/material/Menu';
import {styled} from '@mui/material/styles';

interface Props extends MuiMenuProps {
    asSubMenu?: boolean;
    width?: string;
}

/**
 * A styled version of the Material-UI Menu component with few overrides.
 * @warning This component is meant to be only used inside of the Menu component directory.
 */
export const MuiMenuStyled = styled(MuiMenu, {
    shouldForwardProp: (prop) => prop !== 'asSubMenu',
})<Props>(
    ({asSubMenu, width}) => ({
        '& .MuiPaper-root': {
            backgroundColor: 'var(--center-channel-bg)',
            boxShadow: `${
                asSubMenu ? 'var(--elevation-5)' : 'var(--elevation-4)'
            }, 0 0 0 1px rgba(var(--center-channel-color-rgb), 0.12) inset`,
            minWidth: '114px',
            maxWidth: '496px',
            maxHeight: '80vh',
            width,
        },
    }),
);
