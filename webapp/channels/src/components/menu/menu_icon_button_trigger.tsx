// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import type {ComponentType} from 'react';

import {IconButton} from '@mattermost/compass-ui/components/icon-button';
import type {IconButtonPadding, IconButtonSize, IconButtonStyle} from '@mattermost/compass-ui/components/icon-button';

import type {MenuButtonComponentProps} from './menu';

export type MenuIconButtonTriggerOptions = {
    size?: IconButtonSize;
    style?: IconButtonStyle;
    padding?: IconButtonPadding;
    rounded?: boolean;
    destructive?: boolean;
    className?: string;
};

/**
 * Builds a Compass IconButton trigger for `Menu.Container`'s `menuButton.as`.
 * Call at module scope so the component identity stays stable across renders.
 * Pass the icon as `menuButton.children` (e.g. `<Icon glyph={<DotsVerticalIcon/>}/>`).
 * Icon-only triggers must also set `menuButton['aria-label']` and `menuButtonTooltip.text`.
 *
 * @example
 * const SidebarMenuTrigger = createMenuIconButtonTrigger({size: 'small', padding: 'compact', style: 'inverted'});
 * <Menu.Container menuButton={{id, as: SidebarMenuTrigger, 'aria-label': label, children: <Icon glyph={<DotsVerticalIcon/>}/>}} .../>
 */
export function createMenuIconButtonTrigger(options: MenuIconButtonTriggerOptions = {}): ComponentType<MenuButtonComponentProps> {
    function MenuIconButtonTrigger({children, className, ...props}: MenuButtonComponentProps) {
        const expanded = props['aria-expanded'] === true || props['aria-expanded'] === 'true';

        return (
            <IconButton
                {...props}
                className={classNames(options.className, className) || undefined}
                size={options.size}
                style={options.style}
                padding={options.padding}
                rounded={options.rounded}
                destructive={options.destructive}
                active={expanded}
                icon={children}
            />
        );
    }

    return MenuIconButtonTrigger;
}
