// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {alpha, ComponentsProps, ComponentsVariants, emphasize, Theme} from '@mui/material';
import {ComponentsOverrides} from '@mui/material/styles/overrides';

import {blend} from '../../utils/color';

const componentName = 'MuiButton';

declare module '@mui/material/Button' {
    interface ButtonPropsSizeOverrides {
        'x-small': true;
    }

    interface ButtonPropsVariantOverrides {
        quaternary: true;
    }
}

const defaultProps: ComponentsProps[typeof componentName] = {
    disableElevation: true,
    disableRipple: true,
    disableTouchRipple: true,
    disableFocusRipple: true,
};

const getFocusStyles = (color: string) => ({
    '&:not(.Mui-disabled)': {
        '&:focus': {
            boxShadow: `inset 0 0 0 2px ${emphasize(color, 0.05)}`,
        },

        '&:focus:not(:focus-visible)': {
            boxShadow: 'none',
        },

        '&:focus:focus-visible': {
            boxShadow: `inset 0 0 0 2px ${emphasize(color, 0.05)}`,
        },
    },
});

const styleOverrides: ComponentsOverrides<Theme>[typeof componentName] = {
    containedPrimary: ({theme, ownerState}) => ({
        backgroundColor: ownerState.inverted ? theme.palette.text.primary : theme.palette.primary.main,
        color: ownerState.inverted ? theme.palette.primary.main : theme.palette.primary.contrastText,

        '&:hover': {
            backgroundColor: ownerState.inverted ? blend(theme.palette.text.primary, alpha(theme.palette.primary.main, 0.08)) : emphasize(theme.palette.primary.main, 0.1),
        },
        '&:active': {
            backgroundColor: ownerState.inverted ? blend(theme.palette.text.primary, alpha(theme.palette.primary.main, 0.16)) : emphasize(theme.palette.primary.main, 0.2),
        },

        ...getFocusStyles(theme.palette.primary.main),
    }),
    containedError: ({theme}) => ({
        '&:hover': {
            backgroundColor: emphasize(theme.palette.error.dark, 0.1),
        },
        '&:active': {
            backgroundColor: emphasize(theme.palette.error.dark, 0.2),
        },

        ...getFocusStyles(theme.palette.error.main),
    }),
    outlinedPrimary: ({theme}) => ({
        backgroundColor: alpha(theme.palette.primary.main, 0),

        '&:hover': {
            backgroundColor: alpha(theme.palette.primary.main, 0.08),
        },

        '&:active': {
            backgroundColor: alpha(theme.palette.primary.main, 0.16),
        },

        ...getFocusStyles(theme.palette.primary.main),
    }),
    outlinedError: ({theme}) => ({
        backgroundColor: alpha(theme.palette.error.main, 0),

        '&:hover': {
            backgroundColor: alpha(theme.palette.error.main, 0.08),
        },

        '&:active': {
            backgroundColor: alpha(theme.palette.error.main, 0.16),
        },

        ...getFocusStyles(theme.palette.error.main),
    }),
    textPrimary: ({theme}) => ({
        backgroundColor: alpha(theme.palette.primary.main, 0.08),

        '&:hover': {
            backgroundColor: alpha(theme.palette.primary.main, 0.12),
        },

        '&:active': {
            backgroundColor: alpha(theme.palette.primary.main, 0.16),
        },

        ...getFocusStyles(theme.palette.primary.main),
    }),
    textError: ({theme, ownerState}) => ({
        backgroundColor: ownerState.disabled ? theme.palette.action.disabledBackground : alpha(theme.palette.error.main, 0.12),

        '&:hover': {
            backgroundColor: alpha(theme.palette.error.main, 0.12),
        },

        '&:active': {
            backgroundColor: alpha(theme.palette.error.main, 0.16),
        },

        ...getFocusStyles(theme.palette.error.main),
    }),
};

const variants: ComponentsVariants[typeof componentName] = [
    {
        props: {size: 'x-small'},
        style: ({theme}) => ({
            padding: '0.4rem 1rem',
            ...theme.typography.b50,
            margin: 0,
            textTransform: 'none',
        }),
    },
    {
        props: {size: 'small'},
        style: ({theme}) => ({
            padding: '0.8rem 1.6rem',
            ...theme.typography.b75,
            margin: 0,
            textTransform: 'none',
        }),
    },
    {
        props: {size: 'medium'},
        style: ({theme}) => ({
            padding: '1rem 2rem',
            ...theme.typography.b100,
            margin: 0,
            textTransform: 'none',
        }),
    },
    {
        props: {size: 'large'},
        style: ({theme}) => ({
            padding: '1.2rem 2.4rem',
            ...theme.typography.b200,
            margin: 0,
            textTransform: 'none',
        }),
    },
    {
        props: {variant: 'quaternary'},
        style: () => ({
            backgroundColor: 'red',
        }),
    },
];

const buttonOverrides = {
    variants,
    defaultProps,
    styleOverrides,
};

export default buttonOverrides;
