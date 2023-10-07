// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {FC} from 'react';
import './menu_header.scss';

type Props = {
    divider?: React.ReactNode;
    children?: React.ReactNode;
    onClick?: () => void;
}

/**
 * @deprecated Use the "webapp/channels/src/components/menu" instead.
 */
const MenuHeader: React.FC<Props> = ({ children, onClick }) => {
    return (
        <li className='MenuHeader' onClick={onClick}>
            {children}
        </li>
    );
};

export default MenuHeader;
