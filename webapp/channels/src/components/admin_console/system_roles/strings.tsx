// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineMessages, type MessageDescriptor} from 'react-intl';

export const rolesStrings: Record<string, Record<string, MessageDescriptor>> = {
    system_admin: defineMessages({
        name: {
            id: 'admin.permissions.roles.system_admin.name',
            defaultMessage: 'System Admin',
        },
        description: {
            id: 'admin.permissions.roles.system_admin.description',
            defaultMessage: 'Access to modifying everything.',
        },
        type: {
            id: 'admin.permissions.roles.system_admin.type',
            defaultMessage: 'System Role',
        },
    }),
    system_user_manager: defineMessages({
        name: {
            id: 'admin.permissions.roles.system_user_manager.name',
            defaultMessage: 'User Manager',
        },
        description: {
            id: 'admin.permissions.roles.system_user_manager.description',
            defaultMessage: 'Enough access to help with user management.',
        },
        type: {
            id: 'admin.permissions.roles.system_user_manager.type',
            defaultMessage: 'System Role',
        },
    }),
    system_manager: defineMessages({
        name: {
            id: 'admin.permissions.roles.system_manager.name',
            defaultMessage: 'System Manager',
        },
        description: {
            id: 'admin.permissions.roles.system_manager.description',
            defaultMessage: 'Slightly less access than system admin.',
        },
        type: {
            id: 'admin.permissions.roles.system_manager.type',
            defaultMessage: 'System Role',
        },
    }),
    system_read_only_admin: defineMessages({
        name: {
            id: 'admin.permissions.roles.system_read_only_admin.name',
            defaultMessage: 'Viewer',
        },
        description: {
            id: 'admin.permissions.roles.system_read_only_admin.description',
            defaultMessage: 'Read only access for oversight.',
        },
        type: {
            id: 'admin.permissions.roles.system_read_only_admin.type',
            defaultMessage: 'System Role',
        },
    }),
    system_custom_group_admin: defineMessages({
        name: {
            id: 'admin.permissions.roles.system_custom_group_admin.name',
            defaultMessage: 'Custom Group Manager',
        },
        description: {
            id: 'admin.permissions.roles.system_custom_group_admin.description',
            defaultMessage: 'Administers all Custom Groups across the system.',
        },
        type: {
            id: 'admin.permissions.roles.system_custom_group_admin.type',
            defaultMessage: 'System Role',
        },
    }),
    system_shared_channel_manager: defineMessages({
        name: {
            id: 'admin.permissions.roles.system_shared_channel_manager.name',
            defaultMessage: 'Shared Channel Manager',
        },
        description: {
            id: 'admin.permissions.roles.system_shared_channel_manager.description',
            defaultMessage: 'Can browse available connections and share or unshare channels with remote servers.',
        },
        type: {
            id: 'admin.permissions.roles.system_shared_channel_manager.type',
            defaultMessage: 'System Role',
        },
    }),
    system_secure_connection_manager: defineMessages({
        name: {
            id: 'admin.permissions.roles.system_secure_connection_manager.name',
            defaultMessage: 'Secure Connection Manager',
        },
        description: {
            id: 'admin.permissions.roles.system_secure_connection_manager.description',
            defaultMessage: 'Can create, manage, and remove secure connections to remote servers.',
        },
        type: {
            id: 'admin.permissions.roles.system_secure_connection_manager.type',
            defaultMessage: 'System Role',
        },
    }),
};
