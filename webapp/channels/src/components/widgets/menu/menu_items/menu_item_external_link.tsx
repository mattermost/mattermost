// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import menuItem from './menu_item';

type Props = {
    url: string;
    text: React.ReactNode;
    onClick?: (event: React.MouseEvent<HTMLElement>) => void;
}
export const MenuItemExternalLinkImpl: React.FC<Props> = ({url, text, onClick}: Props) => (
    <a
        target='_blank'
        rel='noopener noreferrer'
        href={url}
        onClick={onClick}
    >
        <span className='MenuItem__primary-text'>
            {text}
        </span>
    </a>
);

const MenuItemExternalLink = menuItem(MenuItemExternalLinkImpl);
MenuItemExternalLink.displayName = 'MenuItemExternalLink';
export default MenuItemExternalLink;
