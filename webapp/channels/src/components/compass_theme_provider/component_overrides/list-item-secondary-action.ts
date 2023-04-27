// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type { ComponentsOverrides } from '@mui/material/styles/overrides';
import type { DefaultTheme } from '@mui/private-theming';

const componentName = 'MuiListItemSecondaryAction';

const listItemSecondaryActionStyleOverrides: ComponentsOverrides<DefaultTheme>[typeof componentName] =
    {
        root: {
            right: 32,
        },
    };

const overrides = {
    styleOverrides: listItemSecondaryActionStyleOverrides,
};

export default overrides;