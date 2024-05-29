// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import './menu_header.scss';

type Props = {
    children?: React.ReactNode;
    onClick?: () => void;
}

/**
 * @deprecated Use the "webapp/channels/src/components/menu" instead.
 */
const MenuHeader = ({children, onClick}: Props) => {
    return (
        <li
            className='MenuHeader'
            onClick={onClick}
        >
            {children}
        </li>
    );
};

export default React.memo(MenuHeader);
