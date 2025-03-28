// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useHistory} from 'react-router-dom';

import type {Props as MenuItemProps} from './menu_item';
import {MenuItem} from './menu_item';

type Props = MenuItemProps & {
    href: string;
}

export function MenuItemLink({
    href,
    ...otherProps
}: Props) {
    const history = useHistory();

    const handleClick = () => {
        history.push(href);
    };

    return (
        <MenuItem
            onClick={handleClick}
            {...otherProps}
        />
    );
}
