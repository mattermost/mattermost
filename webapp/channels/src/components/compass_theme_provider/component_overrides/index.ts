// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ThemeOptions} from '@mui/material/styles/createTheme';

import MuiButtonOverrides from './button';
import MuiButtonBaseOverrides from './button-base';
import MuiIconButtonOverrides from './icon-button';
import MuiListItemOverrides from './list-item';
import MuiListItemTextOverrides from './list-item-text';
import MuiListItemIconOverrides from './list-item-icon';
import MuiListItemButtonOverrides from './list-item-button';
import MuiListItemSecondaryActionOverrides from './list-item-secondary-action';
import MuiMenuOverrides from './menu';
import MuiMenuItemOverrides from './menu-item';
import MuiSelectOverrides from './select';
import MuiInputOverrides from './input';
import MuiInputLabelOverrides from './input-label';
import MuiOutlinedInputOverrides from './outlined-input';

const componentOverrides: ThemeOptions['components'] = {
    MuiInput: MuiInputOverrides,
    MuiInputLabel: MuiInputLabelOverrides,
    MuiOutlinedInput: MuiOutlinedInputOverrides,
    MuiSelect: MuiSelectOverrides,
    MuiMenu: MuiMenuOverrides,
    MuiMenuItem: MuiMenuItemOverrides,
    MuiListItem: MuiListItemOverrides,
    MuiListItemText: MuiListItemTextOverrides,
    MuiListItemIcon: MuiListItemIconOverrides,
    MuiListItemButton: MuiListItemButtonOverrides,
    MuiButton: MuiButtonOverrides,
    MuiButtonBase: MuiButtonBaseOverrides,
    MuiIconButton: MuiIconButtonOverrides,
    MuiListItemSecondaryAction: MuiListItemSecondaryActionOverrides,
};

export default componentOverrides;