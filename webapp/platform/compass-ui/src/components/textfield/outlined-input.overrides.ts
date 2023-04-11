// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {alpha, Theme} from '@mui/material';
import type {ComponentsOverrides} from '@mui/material/styles/overrides';

const componentName = 'MuiOutlinedInput';

const outlinedInputStyleOverrides: ComponentsOverrides<Theme>[typeof componentName] = {
    root: ({ownerState, theme}) => ({
        ...(ownerState.$inputSize === 'small' && theme.typography.b75),
        ...(ownerState.$inputSize === 'medium' && theme.typography.b100),
        ...(ownerState.$inputSize === 'large' && theme.typography.b200),

        margin: 0,

        '.MuiOutlinedInput-notchedOutline': {
            borderColor: alpha(theme.palette.text.primary, 0.16),
            ...(ownerState.$inputSize === 'small' && {
                paddingLeft: '7px',
            }),
            ...(ownerState.$inputSize === 'medium' && {
                paddingLeft: '9px',
            }),
            ...(ownerState.$inputSize === 'large' && {
                paddingLeft: '11px',
            }),
        },

        '&:hover:not(.Mui-focused) .MuiOutlinedInput-notchedOutline': {
            borderColor: alpha(theme.palette.text.primary, 0.48),
        },

        '&:active': {
            backgroundColor: alpha(theme.palette.primary.main, 0.04),

            '.MuiOutlinedInput-notchedOutline': {
                borderColor: theme.palette.primary.main,
            },
        },
    }),
    input: ({ownerState}) => ({
        ...(ownerState.$inputSize === 'small' && {
            padding: '0.8rem 1.2rem',
            height: '1.6rem',
        }),
        ...(ownerState.$inputSize === 'medium' && {
            padding: '1rem 1.5rem',
            height: '2rem',
        }),
        ...(ownerState.$inputSize === 'large' && {
            padding: '1.2rem 1.6rem',
            height: '2.4rem',
        }),
    }),
    focused: ({theme}) => ({
        '.MuiOutlinedInput-notchedOutline': {
            borderColor: alpha(theme.palette.text.primary, 0.16),
        },
    }),
    inputAdornedStart: {
        paddingLeft: 0,
    },
};

const overrides = {
    styleOverrides: outlinedInputStyleOverrides,
};

export default overrides;
