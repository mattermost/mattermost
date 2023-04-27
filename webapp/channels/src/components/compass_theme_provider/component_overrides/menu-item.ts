// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type { ComponentsOverrides } from '@mui/material/styles/overrides';
import type { DefaultTheme } from '@mui/private-theming';

const componentName = 'MuiMenuItem';

const menuItemStyleOverrides: ComponentsOverrides<DefaultTheme>[typeof componentName] = {
    root: {
        background: 'transparent',

        '&:hover': {
            background: 'rgba(var(--center-channel-text-rgb), 0.08)',
        },
        '&:active': {
            background: 'rgba(var(--button-bg-rgb), 0.08)',
        },
        '&.Mui-focused': {
            backgroundColor: 'transparent',
            boxShadow: 'inset 0 0 0 2px var(--sidebar-active-border)',
        },
        '&.Mui-focused:not(.Mui-focusVisible)': {
            backgroundColor: 'transparent',
        },
        '&.Mui-focused.Mui-focusVisible': {
            backgroundColor: 'transparent',
            boxShadow: 'inset 0 0 0 2px var(--sidebar-active-border)',
        },

        '.MuiListItemIcon-root': {
            minWidth: 'unset',
        },
    },
};

const overrides = {
    styleOverrides: menuItemStyleOverrides,
};

export default overrides;