// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * HeaderIconButton is kept as a thin wrapper around the Compass IconButton.
 * The SCSS import below must stay — switch_product_menu uses the
 * `.HeaderIconButton` class name for styling its menu trigger.
 *
 * New callers should use IconButton from '@mattermost/compass-ui/components/icon-button' directly.
 */

import React from 'react';

import {IconButton} from '@mattermost/compass-ui/components/icon-button';
import type {IconButtonProps} from '@mattermost/compass-ui/components/icon-button';

import './header_icon_button.scss';

type HeaderIconButtonProps = Omit<IconButtonProps, 'icon'> & {
    icon: string;
};

const HeaderIconButton = React.forwardRef<HTMLButtonElement, HeaderIconButtonProps>(({
    icon = 'mattermost',
    ...otherProps
}, ref) => {
    return (
        <IconButton
            ref={ref}
            style='inverted'
            size='medium'
            icon={<i className={`icon icon-${icon}`} aria-hidden='true'/>}
            {...otherProps}
        />
    );
});
HeaderIconButton.displayName = 'HeaderIconButton';
export default HeaderIconButton;
