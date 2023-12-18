// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import ExternalLink from 'components/external_link';

import menuItem from './menu_item';

type Props = {
    url: string;
    text: React.ReactNode;
    onClick?: (event: React.MouseEvent<HTMLElement>) => void;
    iconClassName?: string;
}
export const MenuItemExternalLinkImpl: React.FC<Props> = ({url, text, iconClassName, onClick}: Props) => (
    <ExternalLink
        href={url}
        onClick={onClick}
        location='menu_item_external_link'
    >
        {iconClassName && <i className={`icon ${iconClassName}`}/>}
        <span className='MenuItem__primary-text'>
            {text}
        </span>
    </ExternalLink>
);

const MenuItemExternalLink = menuItem(MenuItemExternalLinkImpl);
MenuItemExternalLink.displayName = 'MenuItemExternalLink';
export default MenuItemExternalLink;
