// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Divider} from '@mui/material';
import React from 'react';

/**
 * A horizontal separator for use in menus.
 * @example
 * <Menu.Container>
 *   <Menu.Item>
 *   <Menu.Separator />
 * </Menu.Container>
 */
export function MenuItemSeparator() {
    return (
        <Divider
            component='li'
            aria-orientation='vertical'
        />
    );
}
