// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type { ComponentsOverrides } from '@mui/material/styles/overrides';
import type { DefaultTheme } from '@mui/private-theming';

const componentName = 'MuiSelect';

const selectStyleOverrides: ComponentsOverrides<DefaultTheme>[typeof componentName] = {
    standard: ({ ownerState }) => ({
        backgroundColor: ownerState?.open ? 'rgba(var(--button-bg-rgb), 0.08)' : 'transparent',
        color: 'var(--button-bg)',
        borderRadius: 4,
        margin: '4px 0',
        padding: '8px 12px',
        fontSize: '1.2rem',
        lineHeight: '1.6rem',
        minHeight: '1.6rem',

        '&:hover': {
            backgroundColor: 'rgba(var(--center-channel-text-rgb), 0.08)',
        },
        '&:active': {
            backgroundColor: 'rgba(var(--button-bg-rgb), 0.08)',
        },
        '&.Mui-focused': {
            backgroundColor: 'rgba(var(--button-bg-rgb), 0.12)',
        },
        '&.Mui-focused:not(.Mui-focusVisible)': {
            backgroundColor: 'transparent',
        },
        '&.Mui-focused.Mui-focusVisible': {
            backgroundColor: 'rgba(var(--button-bg-rgb), 0.12)',
        },
    }),
    icon: {
        width: 18,
        height: 18,
        color: 'var(--button-bg)',
        fill: 'currentColor',
        top: 'calc(50% - 9px)',
        right: 2,
    },
};

const overrides = {
    styleOverrides: selectStyleOverrides,
};

export default overrides;