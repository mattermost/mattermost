// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type { ComponentsOverrides } from '@mui/material/styles/overrides';
import type { DefaultTheme } from '@mui/private-theming';

const componentName = 'MuiListItem';

const listItemStyleOverrides: ComponentsOverrides<DefaultTheme>[typeof componentName] = {
    root: {
        padding: '18px 64px 18px 32px',
    },
};

const overrides = {
    styleOverrides: listItemStyleOverrides,
};

export default overrides;