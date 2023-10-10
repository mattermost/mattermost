// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import './menu_header.scss';

type Props = {
    divider?: React.ReactNode;
    children?: React.ReactNode;
    onClick?: () => void;
}

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

/**
 * @deprecated Use the "webapp/channels/src/components/menu" instead.
 */

export default React.memo(MenuHeader);
