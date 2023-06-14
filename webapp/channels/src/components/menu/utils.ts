// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Children, ReactNode, cloneElement, isValidElement} from 'react';

import {MENU_ITEM_KEY_PREFIX, Props as MenuItemProps} from './menu_item';
import {SUB_MENU_ITEM_KEY_PREFIX} from './sub_menu';

export function injectPropsInMenuItems(children: ReactNode[], forceCloseMenu?: MenuItemProps['forceCloseMenu'], forceCloseSubMenu?: MenuItemProps['forceCloseSubMenu']) {
    const modifiedChildren = Children.map(children, (child) => {
        if (!isValidElement(child)) {
            return null;
        }

        if (
            child.props &&
            child.props.id &&
            (child.props.id.startsWith(MENU_ITEM_KEY_PREFIX) || child.props.id.startsWith(SUB_MENU_ITEM_KEY_PREFIX))
        ) {
            return cloneElement(child, {
                forceCloseMenu,
                forceCloseSubMenu,
            } as MenuItemProps);
        }

        return child;
    });

    return modifiedChildren;
}

export function createMenusUniqueId(prefix: string, menuItemName: string, ...uniqueValues: string[]) {
    const uniqueValuesJoined = uniqueValues.join('-');
    return `${prefix}__${menuItemName}__${uniqueValuesJoined}`;
}
