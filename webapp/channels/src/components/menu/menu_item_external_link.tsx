// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {OpenInNewIcon} from '@mattermost/compass-icons/components';

import ExternalLink from 'components/external_link';

import type {Props as MenuItemProps} from './menu_item';
import {MenuItem} from './menu_item';

type Props = Omit<MenuItemProps, 'onClick' | 'href' | 'location'> & {
    href: string;
    location?: string;
    showOpenInNewIcon?: boolean;
};

export function MenuItemExternalLink({
    href,
    location = 'menu_item_external_link',
    showOpenInNewIcon = false,
    trailingElements,
    ...otherProps
}: Props) {
    const openInNewIcon = showOpenInNewIcon ? (
        <OpenInNewIcon
            size={16}
            aria-hidden={true}
        />
    ) : undefined;

    return (
        <MenuItem
            {...otherProps}
            component={ExternalLink}
            href={href}
            location={location}
            trailingElements={trailingElements ?? openInNewIcon}
        />
    );
}
