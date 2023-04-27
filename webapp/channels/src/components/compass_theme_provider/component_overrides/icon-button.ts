// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type { ComponentsVariants } from '@mui/material';
import type { ComponentsOverrides } from '@mui/material/styles/overrides';
import type { DefaultTheme } from '@mui/private-theming';

const componentName = 'MuiIconButton';

declare module '@mui/material/IconButton' {
    interface IconButtonPropsSizeOverrides {
        'x-small': true;
    }
}

const iconButtonStyleOverrides: ComponentsOverrides<DefaultTheme>[typeof componentName] = {
    root: {
        borderRadius: 4,
        color: 'rgba(var(--center-channel-text-rgb), 0.56)',

        '&:hover': {
            backgroundColor: 'rgba(var(--center-channel-text-rgb), 0.08)',
        },

        '&:active': {
            color: 'var(--button-bg)',
            backgroundColor: 'rgba(var(--button-bg-rgb), 0.08)',
        },

        '&:focus': {
            boxShadow: 'inset 0 0 0 2px var(--sidebar-text-active-border)',
        },

        '&:focus:not(:focus-visible)': {
            boxShadow: 'none',
        },

        '&:focus:focus-visible': {
            boxShadow: 'inset 0 0 0 2px var(--sidebar-text-active-border)',
        },

        svg: {
            margin: 2,
            fill: 'currentColor',
        },
    },
};

const iconButtonVariantsOverride: ComponentsVariants[typeof componentName] = [
    {
        props: { size: 'x-small' },
        style: {
            padding: 4,

            svg: {
                width: 14,
                height: 14,
            },
        },
    },
    {
        props: { size: 'small' },
        style: {
            padding: 6,

            svg: {
                width: 18,
                height: 18,
            },
        },
    },
    {
        props: { size: 'medium' },
        style: {
            padding: 8,

            svg: {
                width: 24,
                height: 24,
            },
        },
    },
    {
        props: { size: 'large' },
        style: {
            padding: 8,

            svg: {
                width: 32,
                height: 32,
            },
        },
    },
];

const overrides = {
    variants: iconButtonVariantsOverride,
    styleOverrides: iconButtonStyleOverrides,
};

export default overrides;