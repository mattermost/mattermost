// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ReactNode} from 'react';

import {DotsHorizontalIcon} from '@mattermost/compass-icons/components';

import * as Menu from 'components/menu';

export type RecapMenuAction = {
    id: string;
    icon: ReactNode;
    label: ReactNode;
    onClick: () => void;
    isDestructive?: boolean;
    disabled?: boolean;
};

interface RecapMenuProps {
    actions: RecapMenuAction[];
    buttonClassName?: string;
    ariaLabel?: string;
}

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
                children: <DotsHorizontalIcon size={16}/>,
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

