// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {Link} from 'react-router-dom';

import menuItem from './menu_item';

type Props = {
    to: string;
    text: React.ReactNode;
    className?: string;
    disabled?: boolean;
    sibling?: React.ReactNode;
    onLinkClick?: () => void;
}

export const MenuItemLinkImpl = ({to, text, className, disabled, sibling, onLinkClick}: Props) => (
    <>
        <Link
            to={to}
            className={classNames(className, {'MenuItem__with-sibling': sibling, disabled})}
            disabled={disabled}
            onClick={onLinkClick}
        >
            <span className='MenuItem__primary-text'>{text}</span>
        </Link>
        {sibling}
    </>
);

const MenuItemLink = menuItem(MenuItemLinkImpl);
MenuItemLink.displayName = 'MenuItemLink';

export default MenuItemLink;
