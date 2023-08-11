// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Link} from 'react-router-dom';

import classNames from 'classnames';

import menuItem from './menu_item';

type Props = {
    to: string;
    text: React.ReactNode;
    className?: string;
    disabled?: boolean;
    sibling?: React.ReactNode;
}

export const MenuItemLinkImpl = ({to, text, className, disabled, sibling}: Props) => (
    <>
        <Link
            to={to}
            className={classNames(className, {'MenuItem__with-sibling': sibling, disabled})}
            disabled={disabled}
        >
            <span className='MenuItem__primary-text'>{text}</span>
        </Link>
        {sibling}
    </>
);

const MenuItemLink = menuItem(MenuItemLinkImpl);
MenuItemLink.displayName = 'MenuItemLink';

export default MenuItemLink;
