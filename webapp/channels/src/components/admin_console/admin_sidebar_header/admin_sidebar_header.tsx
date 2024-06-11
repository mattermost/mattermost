// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';

import AdminNavbarDropdown from 'components/admin_console/admin_navbar_dropdown';
import MenuIcon from 'components/widgets/icons/menu_icon';
import MenuWrapper from 'components/widgets/menu/menu_wrapper';
import Avatar from 'components/widgets/users/avatar';

type Props = {
    currentUser: UserProfile;
}

const SidebarHeader = ({currentUser: me}: Props) => {
    const intl = useIntl();
    let profilePicture = null;

    if (!me) {
        return null;
    }

    if (me.last_picture_update) {
        profilePicture = (
            <Avatar
                username={me.username}
                url={Client4.getProfilePictureUrl(me.id, me.last_picture_update)}
                size='lg'
            />
        );
    }

    return (
        <MenuWrapper className='AdminSidebarHeader'>
            <div>
                {profilePicture}
                <div className='header__info'>
                    <div className='team__name'>
                        <FormattedMessage
                            id='admin.sidebarHeader.systemConsole'
                            defaultMessage='System Console'
                        />
                    </div>
                    <div className='user__name overflow--ellipsis whitespace--nowrap'>{'@' + me.username}</div>
                </div>
                <button
                    type='button'
                    className='style--none'
                    aria-label={intl.formatMessage({id: 'generic_icons.menu', defaultMessage: 'Menu Icon'})}
                >
                    <MenuIcon className='menu-icon'/>
                </button>
            </div>
            <AdminNavbarDropdown/>
        </MenuWrapper>
    );
};

export default memo(SidebarHeader);
