// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MessageDescriptor} from 'react-intl';
import {defineMessages} from 'react-intl';

export const rolesRolesStrings: Record<string, MessageDescriptor> = defineMessages({
    all_users: {
        id: 'admin.permissions.roles.all_users.name',
        defaultMessage: 'All Members',
    },
    channel_admin: {
        id: 'admin.permissions.roles.channel_admin.name',
        defaultMessage: 'Channel Admin',
    },
    channel_user: {
        id: 'admin.permissions.roles.channel_user.name',
        defaultMessage: 'Channel User',
    },
    system_admin: {
        id: 'admin.permissions.roles.system_admin.name',
        defaultMessage: 'System Admin',
    },
    system_user: {
        id: 'admin.permissions.roles.system_user.name',
        defaultMessage: 'System User',
    },
    team_admin: {
        id: 'admin.permissions.roles.team_admin.name',
        defaultMessage: 'Team Admin',
    },
    team_user: {
        id: 'admin.permissions.roles.team_user.name',
        defaultMessage: 'Team User',
    },
});
