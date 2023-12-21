// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineMessage, type MessageDescriptor} from 'react-intl';

export const rolesStrings: Record<string, Record<string, MessageDescriptor>> = {
    system_admin: defineMessage({
        name: {
            id: 'admin.permissions.roles.system_admin.name',
            defaultMessage: '',
        },
        description: {
            id: 'admin.permissions.roles.system_admin.description',
            defaultMessage: '',
        },
        type: {
            id: 'admin.permissions.roles.system_admin.type',
            defaultMessage: '',
        },
    }),
    system_user_manager: defineMessage({
        name: {
            id: 'admin.permissions.roles.system_user_manager.name',
            defaultMessage: '',
        },
        description: {
            id: 'admin.permissions.roles.system_user_manager.description',
            defaultMessage: '',
        },
        type: {
            id: 'admin.permissions.roles.system_user_manager.type',
            defaultMessage: '',
        },
    }),
    system_manager: defineMessage({
        name: {
            id: 'admin.permissions.roles.system_manager.name',
            defaultMessage: '',
        },
        description: {
            id: 'admin.permissions.roles.system_manager.description',
            defaultMessage: '',
        },
        type: {
            id: 'admin.permissions.roles.system_manager.type',
            defaultMessage: '',
        },
    }),
    system_read_only_admin: defineMessage({
        name: {
            id: 'admin.permissions.roles.system_read_only_admin.name',
            defaultMessage: '',
        },
        description: {
            id: 'admin.permissions.roles.system_read_only_admin.description',
            defaultMessage: '',
        },
        type: {
            id: 'admin.permissions.roles.system_read_only_admin.type',
            defaultMessage: '',
        },
    }),
    system_custom_group_admin: defineMessage({
        name: {
            id: 'admin.permissions.roles.system_custom_group_admin.name',
            defaultMessage: '',
        },
        description: {
            id: 'admin.permissions.roles.system_custom_group_admin.description',
            defaultMessage: '',
        },
        type: {
            id: 'admin.permissions.roles.system_custom_group_admin.type',
            defaultMessage: '',
        },
    }),
};
