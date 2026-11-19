// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Divider} from '@mui/material';
import type {DividerProps} from '@mui/material';
import type {ElementType} from 'react';
import React, {useContext} from 'react';

import {PopoverMenuDivider} from '@mattermost/compass-ui/components/popover-menu';

import {MenuContext} from './menu_context';

/**
 * A horizontal separator for use in menus.
 * @example
 * <Menu.Container>
 *   <Menu.Item>
 *   <Menu.Separator />
 * </Menu.Container>
 */
export function MenuItemSeparator(props: DividerProps & {component?: ElementType}) {
    const menuContext = useContext(MenuContext);
    if (menuContext.compass) {
        return <PopoverMenuDivider/>;
    }

    return (
        <Divider
            aria-orientation='vertical'
            {...props}
        />
    );
}
