// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type { ComponentsOverrides } from '@mui/material/styles/overrides';
import type { DefaultTheme } from '@mui/private-theming';

const componentName = 'MuiInputLabel';

const inputLabelStyleOverrides: ComponentsOverrides<DefaultTheme>[typeof componentName] = {
    root: {
        fontSize: '1.6rem',
        top: 6,
    },
    shrink: ({ ownerState }) => ({
        ...(ownerState.shrink && {
            top: 2,
        }),
    }),
};

const overrides = {
    styleOverrides: inputLabelStyleOverrides,
};

export default overrides;