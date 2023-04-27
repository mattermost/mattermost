// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type { ComponentsOverrides } from '@mui/material/styles/overrides';
import type { DefaultTheme } from '@mui/private-theming';

const componentName = 'MuiListItemButton';

const listItemButtonStyleOverrides: ComponentsOverrides<DefaultTheme>[typeof componentName] = {
    dense: {
        paddingTop: 0,
        paddingBottom: 0,
    },
};

const overrides = {
    styleOverrides: listItemButtonStyleOverrides,
};

export default overrides;