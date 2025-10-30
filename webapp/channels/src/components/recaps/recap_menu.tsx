// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ReactNode} from 'react';

import * as Menu from 'components/menu';

export type RecapMenuAction = {
    /**
     * Unique identifier for the action
     */
    id: string;

    /**
     * Icon element to display before the label (typically a compass icon)
     */
    icon: ReactNode;

    /**
     * Label text or element to display for the action
     */
    label: ReactNode;

    /**
     * Handler function to call when the action is clicked
     */
    onClick: () => void;

    /**
     * Whether this is a destructive action (will be styled differently)
     */
    isDestructive?: boolean;

    /**
     * Whether the action is disabled
     */
    disabled?: boolean;
};

interface RecapMenuProps {
    /**
     * Array of action objects to display in the menu
     */
    actions: RecapMenuAction[];

    /**
     * Additional CSS class for the menu button
     */
    buttonClassName?: string;

    /**
     * Aria label for the menu button
     */
    ariaLabel?: string;
}

/**
 * Reusable menu component for recap-related actions.
 * Accepts an array of action objects that define the icon, label, and behavior of each menu item.
 * This makes it flexible and reusable across different contexts in the recaps feature.
 *
 * @example
 * <RecapMenu
 *   actions={[
 *     {
 *       id: 'remove-channel',
 *       icon: <i className='icon icon-close'/>,
 *       label: 'Remove channel from recap',
 *       onClick: () => handleRemoveChannel(),
 *     },
 *     {
 *       id: 'open-channel',
 *       icon: <i className='icon icon-arrow-expand'/>,
 *       label: 'Open channel',
 *       onClick: () => navigateToChannel(),
 *     },
 *   ]}
 *   ariaLabel='Channel options'
 * />
 */
export const RecapMenu: React.FC<RecapMenuProps> = ({
    actions,
    buttonClassName = 'recap-icon-button',
    ariaLabel = 'Recap options',
}) => {
    const menuId = `recap-menu-${Math.random().toString(36).substr(2, 9)}`;
    const buttonId = `${menuId}-button`;

    return (
        <Menu.Container
            menuButton={{
                id: buttonId,
                class: buttonClassName,
                'aria-label': ariaLabel,
                children: <i className='icon icon-dots-horizontal'/>,
            }}
            menu={{
                id: menuId,
                'aria-label': ariaLabel,
            }}
            anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
            }}
            transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
            }}
        >
            {actions.map((action) => (
                <Menu.Item
                    key={action.id}
                    leadingElement={action.icon}
                    labels={<span>{action.label}</span>}
                    onClick={action.onClick}
                    isDestructive={action.isDestructive}
                    disabled={action.disabled}
                />
            ))}
        </Menu.Container>
    );
};

export default RecapMenu;

