// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type { ComponentsOverrides } from '@mui/material/styles/overrides';
import type { DefaultTheme } from '@mui/private-theming';

const componentName = 'MuiListItemIcon';

const listItemIconStyleOverrides: ComponentsOverrides<DefaultTheme>[typeof componentName] = {
    root: {
        minWidth: 0,
        color: 'currentColor',
    },
};

const overrides = {
    styleOverrides: listItemIconStyleOverrides,
};

export default overrides;
