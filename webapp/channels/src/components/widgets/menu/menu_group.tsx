// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import './menu_group.scss';

type Props = {
    divider?: React.ReactNode;
    children?: React.ReactNode;
};

/**
 * @deprecated Use the "webapp/channels/src/components/menu" instead.
 */
const MenuGroup = (props: Props) => {
    const handleDividerClick = (e: React.MouseEvent): void => {
        e.preventDefault();
        e.stopPropagation();
    };

    const divider = props.divider ?? (
        <li
            className='MenuGroup menu-divider'
            onClick={handleDividerClick}
            role='separator'
        />
    );

    return (
        <>
            {divider}
            {props.children}
        </>
    );
};

export default React.memo(MenuGroup);
