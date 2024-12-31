// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {ExitToAppIcon} from '@mattermost/compass-icons/components';

import {emitUserLoggedOutEvent} from 'actions/global_actions';

import * as Menu from 'components/menu';

export default function UserAccountLogoutMenuItem() {
    function handleClick() {
        emitUserLoggedOutEvent();
    }

    return (
        <Menu.Item
            leadingElement={
                <ExitToAppIcon
                    size={18}
                    aria-hidden='true'
                />
            }
            labels={
                <FormattedMessage
                    id='userAccountMenu.logoutMenuItem.label'
                    defaultMessage='Log out'
                />
            }
            onClick={handleClick}
        />
    );
}
