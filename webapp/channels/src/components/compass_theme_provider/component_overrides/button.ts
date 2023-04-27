// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type { ComponentsOverrides } from '@mui/material/styles/overrides';
import type { DefaultTheme } from '@mui/private-theming/defaultTheme';

declare module '@mui/material/Button' {
    interface ButtonPropsVariantOverrides {
        // disable MUI variant names and instead ...
        text: false;
        contained: false;
        outlined: false;

        // ... use our own variant names
        primary: true;
        secondary: true;
        tertiary: true;
    }
}

const componentName = 'MuiButton';

const buttonStyleOverrides: ComponentsOverrides<DefaultTheme>[typeof componentName] = {
    root: {
        display: 'flex',
        placeItems: 'center',
        placeContent: 'center',
        padding: '10px 16px',

        color: 'var(--button-bg)',
        backgroundColor: 'transparent',
        border: 'none',
        borderRadius: 4,
        boxShadow: 'inset 0 0 0 1px var(--button-bg)',

        fontSize: 12,
        fontWeight: 600,
        lineHeight: '10px',
        textTransform: 'none',

        '&:hover': {
            backgroundColor: 'rgba(var(--button-bg-rgb), 0.08)',
        },

        '&:active': {
            backgroundColor: 'rgba(var(--button-bg-rgb), 0.16)',
        },

        '&:focus': {
            boxShadow: 'inset 0 0 0 2px var(--sidebar-text-active-border)',
        },

        '&:focus:not(:focus-visible)': {
            boxShadow: 'inset 0 0 0 1px var(--button-bg)',
        },

        '&:focus:focus-visible': {
            boxShadow: 'inset 0 0 0 2px var(--sidebar-text-active-border)',
        },

        svg: {
            fill: 'currentColor',
        },
    },
};

const buttonOverrides = {
    styleOverrides: buttonStyleOverrides,
};

export default buttonOverrides;