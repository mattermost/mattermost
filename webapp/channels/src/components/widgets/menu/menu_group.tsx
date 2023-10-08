// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import './menu_group.scss';

type Props = {
    divider?: React.ReactNode;
    children?: React.ReactNode;
}

/**
 * @deprecated Use the "webapp/channels/src/components/menu" instead.
 */
const MenuGroup = ({ divider, children }: Props) => {
    const handleDividerClick = (e: React.MouseEvent): void => {
        e.preventDefault();
        e.stopPropagation();
    };

    return (
        <>
            {divider || (
                <li
                    className='MenuGroup menu-divider'
                    onClick={handleDividerClick}
                />
            )}
            {children}
        </>
    );
};

export default React.memo(MenuGroup);
