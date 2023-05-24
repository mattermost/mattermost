// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {alpha, ComponentsProps, emphasize, Theme} from '@mui/material';
import type {ComponentsVariants} from '@mui/material';
import type {ComponentsOverrides} from '@mui/material/styles/overrides';

const componentName = 'MuiIconButton';

declare module '@mui/material/IconButton' {
    interface IconButtonPropsSizeOverrides {
        'x-small': true;
    }
    interface IconButtonPropsOverrides {
        destructive: boolean;
        compact: boolean;
    }
}

const defaultProps: ComponentsProps[typeof componentName] = {
    disableRipple: true,
    disableTouchRipple: true,
    disableFocusRipple: true,
};

export const getFocusStyles = (color: string) => ({
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
    root: ({theme, ownerState}) => ({
        backgroundColor: 'transparent',
        color: ownerState.color === 'error' ? theme.palette.error.main : alpha(theme.palette.text.primary, 0.56),
        borderRadius: 4,
        margin: 0,

        '&:hover': {
            backgroundColor: alpha(ownerState.color === 'error' ? theme.palette.error.main : theme.palette.text.primary, 0.08),
            color: ownerState.color === 'error' ? theme.palette.error.main : alpha(theme.palette.text.primary, 0.72),
        },

        '&:active': {
            backgroundColor: alpha(ownerState.color === 'error' ? theme.palette.error.main : theme.palette.primary.main, 0.16),
            color: ownerState.color === 'error' ? theme.palette.error.main : theme.palette.primary.main,
        },

        svg: {
            margin: 0,
            fill: 'currentColor',
        },

        ...getFocusStyles(ownerState.color === 'error' ? theme.palette.error.main : theme.palette.primary.main),

        ...(ownerState.color !== 'error' && {
            '&.toggled:not(.inverted):not(.Mui-disabled)': {
                backgroundColor: theme.palette.primary.main,
                color: theme.palette.primary.contrastText,

                '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.92),
                    color: theme.palette.primary.contrastText,
                },

                '&:active': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.16),
                    color: theme.palette.primary.main,
                },
            },

            '&.inverted:not(.Mui-disabled)': {
                backgroundColor: 'transparent',
                color: alpha(theme.palette.text.primary, 0.56),

                '&:hover': {
                    backgroundColor: alpha(theme.palette.text.primary, 0.08),
                    color: theme.palette.text.primary,
                },

                '&:active': {
                    backgroundColor: alpha(theme.palette.text.primary, 0.16),
                    color: theme.palette.text.primary,
                },

                '&.toggled': {
                    backgroundColor: theme.palette.text.primary,
                    color: alpha(theme.palette.background.default, 0.56),

                    '&:hover': {
                        backgroundColor: alpha(theme.palette.text.primary, 0.92),
                        color: alpha(theme.palette.background.default, 0.56),
                    },

                    '&:active': {
                        backgroundColor: alpha(theme.palette.text.primary, 0.16),
                        color: theme.palette.text.primary,
                    },
                },
            },
        }),

        transition: theme.transitions.create(['background-color', 'color'], {duration: theme.transitions.duration.shorter}),
    }),
};

const variants: ComponentsVariants[typeof componentName] = [
    {
        props: {size: 'x-small'},
        style: ({theme}) => ({
            padding: theme.spacing(0.5),

            svg: {
                width: '12px',
                height: '12px',
            },

            ...theme.typography.b75,
            lineHeight: 0,
            fontWeight: 600,

            '.MuiGrid-container': {
                gap: theme.spacing(0.25),
                maxHeight: theme.spacing(1.5),
            },
        }),
    },
    {
        props: {size: 'small'},
        style: ({theme}) => ({
            padding: theme.spacing(0.75),

            svg: {
                width: '16px',
                height: '16px',
            },

            ...theme.typography.b100,
            lineHeight: 0,
            fontWeight: 600,

            '.MuiGrid-container': {
                gap: theme.spacing(0.5),
                maxHeight: theme.spacing(2),
            },
        }),
    },
    {
        props: {size: 'medium'},
        style: ({theme}) => ({
            padding: theme.spacing(1),

            svg: {
                width: '20px',
                height: '20px',
            },

            ...theme.typography.b200,
            lineHeight: 0,
            fontWeight: 600,

            '.MuiGrid-container': {
                gap: theme.spacing(0.75),
                maxHeight: theme.spacing(2.5),
            },
        }),
    },
    {
        props: {size: 'large'},
        style: ({theme}) => ({
            padding: theme.spacing(1),

            svg: {
                width: '28px',
                height: '28px',
            },

            ...theme.typography.b300,
            lineHeight: 0,
            fontWeight: 600,

            '.MuiGrid-container': {
                gap: theme.spacing(0.75),
                maxHeight: theme.spacing(3.5),
            },
        }),
    },
];

const overrides = {
    variants,
    defaultProps,
    styleOverrides,
};

export default overrides;
