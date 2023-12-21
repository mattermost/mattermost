// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MessageDescriptor} from 'react-intl';
import {defineMessages} from 'react-intl';

export const rolesRolesStrings: Record<string, MessageDescriptor> = defineMessages({
    all_users: {
        id: 'admin.permissions.roles.all_users.name',
        defaultMessage: '',
    },
    channel_admin: {
        id: 'admin.permissions.roles.channel_admin.name',
        defaultMessage: '',
    },
    channel_user: {
        id: 'admin.permissions.roles.channel_user.name',
        defaultMessage: '',
    },
    system_admin: {
        id: 'admin.permissions.roles.system_admin.name',
        defaultMessage: '',
    },
    system_user: {
        id: 'admin.permissions.roles.system_user.name',
        defaultMessage: '',
    },
    team_admin: {
        id: 'admin.permissions.roles.team_admin.name',
        defaultMessage: '',
    },
    team_user: {
        id: 'admin.permissions.roles.team_user.name',
        defaultMessage: '',
    },
});
