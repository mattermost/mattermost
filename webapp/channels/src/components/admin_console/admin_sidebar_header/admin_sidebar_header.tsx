// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useMemo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {ChevronDownIcon} from '@mattermost/compass-icons/components';
import type {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';

import AdminNavbarDropdown from 'components/admin_console/admin_navbar_dropdown';
import * as Menu from 'components/menu';
import Avatar from 'components/widgets/users/avatar';

type Props = {
    currentUser: UserProfile;
};

// Inset the menu 8px from the sidebar edge, matching the LHS filter field padding.
const anchorOrigin = {vertical: 'bottom', horizontal: 'left'} as const;
const transformOrigin = {vertical: 'top', horizontal: -8} as const;

const SidebarHeader = ({currentUser: me}: Props) => {
    const {formatMessage} = useIntl();

    const profilePicture = useMemo(() => {
        if (!me?.last_picture_update) {
            return null;
        }

        return (
            <Avatar
                username={me.username}
                url={Client4.getProfilePictureUrl(me.id, me.last_picture_update)}
                size='lg'
            />
        );
    }, [me]);

    if (!me) {
        return null;
    }

    return (
        <Menu.Container
            menuButton={{
                id: 'admin-sidebar-header',
                dataTestId: 'adminSidebarHeaderMenuButton',
                class: 'AdminSidebarHeader',
                'aria-label': formatMessage({id: 'admin.nav.menuAriaLabel', defaultMessage: 'Admin Console Menu'}),
                children: (
                    <>
                        {profilePicture}
                        <div
                            className='header__info'
                            data-testid='admin-sidebar-header-info'
                        >
                            <div className='team__name'>
                                <FormattedMessage
                                    id='admin.sidebarHeader.systemConsole'
                                    defaultMessage='System Console'
                                />
                                <ChevronDownIcon size={20}/>
                            </div>
                            <div className='user__name overflow--ellipsis whitespace--nowrap'>{'@' + me.username}</div>
                        </div>
                    </>
                ),
            }}
            menu={{
                id: 'adminConsoleMenu',
                'aria-label': formatMessage({id: 'admin.nav.menuAriaLabel', defaultMessage: 'Admin Console Menu'}),
                width: 'calc(var(--admin-sidebar-width) - 16px)',
            }}
            anchorOrigin={anchorOrigin}
            transformOrigin={transformOrigin}
        >
            <AdminNavbarDropdown/>
        </Menu.Container>
    );
};

export default memo(SidebarHeader);
