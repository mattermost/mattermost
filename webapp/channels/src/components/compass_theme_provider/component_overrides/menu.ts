// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type { ComponentsOverrides } from '@mui/material/styles/overrides';
import type { DefaultTheme } from '@mui/private-theming';

const componentName = 'MuiMenu';

const menuStyleOverrides: ComponentsOverrides<DefaultTheme>[typeof componentName] = {
    list: {
        minWidth: 100,
    },
};

const overrides = {
    styleOverrides: menuStyleOverrides,
};

export default overrides;