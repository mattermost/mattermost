// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import UserAccountMenu from 'components/user_account_menu';

import './user_section.scss';

/**
 * UserSection renders the user avatar with status badge at the bottom of ProductSidebar.
 * Wraps UserAccountMenu with sidebar-appropriate styling and positioning.
 */
export const UserSection = (): JSX.Element => {
    return (
        <div className='UserSection'>
            <UserAccountMenu
                anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
                transformOrigin={{vertical: 'bottom', horizontal: 'left'}}
            />
        </div>
    );
};

export default UserSection;
