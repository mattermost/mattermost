// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineMessages} from 'react-intl';
import type {MessageDescriptor} from 'react-intl';

import {BOT_ROLE_KEY} from '../access_control/bot_scope';

export interface RoleDefinition {
    value: string;
    label: MessageDescriptor;
    description: MessageDescriptor;
}

export const roleMessages = defineMessages({
    guestLabel: {id: 'admin.permission_policies.role.system_guest.label', defaultMessage: 'Guest users'},
    guestDescription: {id: 'admin.permission_policies.role.system_guest.description', defaultMessage: 'Applies only to guest users'},
    memberLabel: {id: 'admin.permission_policies.role.system_user.label', defaultMessage: 'Members'},
    memberDescription: {id: 'admin.permission_policies.role.system_user.description', defaultMessage: 'Applies to regular members. System administrators also fall back to this rule if no admin-specific policy with the same permissions exists.'},
    adminLabel: {id: 'admin.permission_policies.role.system_admin.label', defaultMessage: 'System administrators'},
    adminDescription: {id: 'admin.permission_policies.role.system_admin.description', defaultMessage: 'Applies only to system administrators'},
    botLabel: {id: 'admin.permission_policies.role.bot.label', defaultMessage: 'Bot accounts'},
    botDescription: {id: 'admin.permission_policies.role.bot.description', defaultMessage: 'Applies only to bot accounts'},
    selectRole: {id: 'admin.permission_policies.role.select', defaultMessage: 'Select a role'},
});

export const AVAILABLE_ROLES: RoleDefinition[] = [
    {value: 'system_guest', label: roleMessages.guestLabel, description: roleMessages.guestDescription},
    {value: 'system_user', label: roleMessages.memberLabel, description: roleMessages.memberDescription},
    {value: 'system_admin', label: roleMessages.adminLabel, description: roleMessages.adminDescription},
    {value: BOT_ROLE_KEY, label: roleMessages.botLabel, description: roleMessages.botDescription},
];
