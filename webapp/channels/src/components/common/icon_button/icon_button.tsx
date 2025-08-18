// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Icon} from './icon';
import {iconButtonDefinitions, IconButtonRoot} from './icon_button_root';

import './icon_button.scss';

type IconButtonProps = React.HTMLAttributes<HTMLButtonElement> & {
    icon: string;
    label?: string;
    size?: 'xs' | 'sm' | 'md' | 'lg';

    compact?: boolean;
    inverted?: boolean;
    active?: boolean;
    disabled?: boolean;
    destructive?: boolean;
    toggled?: boolean;
};

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(({
    icon = 'mg',
    label,
    size = 'md',
    destructive,
    toggled,
    ...otherProps
}, ref) => {
    // eslint-disable-next-line no-process-env
    if (process.env.NODE_ENV !== 'production') {
        if (destructive && toggled) {
            // eslint-disable-next-line no-console
            console.warn('IconButton: component was used with both `destructive` and `toggled` properties set to true. Please use only one of the options');
        }
    }

    return (
        <IconButtonRoot
            ref={ref}
            size={size}
            destructive={destructive}
            toggled={toggled}
            {...otherProps}
        >
            <Icon
                glyph={icon}
                size={iconButtonDefinitions[size].iconSize}
            />
            {label && <span>{label}</span>}
        </IconButtonRoot>
    );
});
IconButton.displayName = 'IconButton';
export default IconButton;
