// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MessageDescriptor} from 'react-intl';
import {defineMessages} from 'react-intl';

export const groupRolesStrings: Record<string, Record<string, MessageDescriptor>> = {
    delete_posts: defineMessages({
        name: {
            id: 'admin.permissions.group.delete_posts.name',
            defaultMessage: 'Delete Posts',
        },
        description: {
            id: 'admin.permissions.group.delete_posts.description',
            defaultMessage: 'Delete own and others\' posts.',
        },
    }),
    integrations: defineMessages({
        name: {
            id: 'admin.permissions.group.integrations.name',
            defaultMessage: 'Integrations & Customizations',
        },
        description: {
            id: 'admin.permissions.group.integrations.description',
            defaultMessage: 'Manage OAuth 2.0, slash commands, webhooks and emoji.',
        },
    }),
    posts: defineMessages({
        name: {
            id: 'admin.permissions.group.posts.name',
            defaultMessage: '',
        },
        description: {
            id: 'admin.permissions.group.posts.description',
            defaultMessage: '',
        },
    }),
    private_channel: defineMessages({
        name: {
            id: 'admin.permissions.group.private_channel.name',
            defaultMessage: '',
        },
        description: {
            id: 'admin.permissions.group.private_channel.description',
            defaultMessage: '',
        },
    }),
    public_channel: defineMessages({
        name: {
            id: 'admin.permissions.group.public_channel.name',
            defaultMessage: '',
        },
        description: {
            id: 'admin.permissions.group.public_channel.description',
            defaultMessage: '',
        },
    }),
    reactions: defineMessages({
        name: {
            id: 'admin.permissions.group.reactions.name',
            defaultMessage: '',
        },
        description: {
            id: 'admin.permissions.group.reactions.description',
            defaultMessage: '',
        },
    }),
    send_invites: defineMessages({
        name: {
            id: 'admin.permissions.group.send_invites.name',
            defaultMessage: '',
        },
        description: {
            id: 'admin.permissions.group.send_invites.description',
            defaultMessage: '',
        },
    }),
    teams: defineMessages({
        name: {
            id: 'admin.permissions.group.teams.name',
            defaultMessage: '',
        },
        description: {
            id: 'admin.permissions.group.teams.description',
            defaultMessage: '',
        },
    }),
    edit_posts: defineMessages({
        name: {
            id: 'admin.permissions.group.edit_posts.name',
            defaultMessage: '',
        },
        description: {
            id: 'admin.permissions.group.edit_posts.description',
            defaultMessage: '',
        },
    }),
    teams_team_scope: defineMessages({
        name: {
            id: 'admin.permissions.group.teams_team_scope.name',
            defaultMessage: '',
        },
        description: {
            id: 'admin.permissions.group.teams_team_scope.description',
            defaultMessage: '',
        },
    }),
    guest_reactions: defineMessages({
        name: {
            id: 'admin.permissions.group.guest_reactions.name',
            defaultMessage: '',
        },
        description: {
            id: 'admin.permissions.group.guest_reactions.description',
            defaultMessage: '',
        },
    }),
    guest_create_post: defineMessages({
        name: {
            id: 'admin.permissions.group.guest_create_post.name',
            defaultMessage: '',
        },
        description: {
            id: 'admin.permissions.group.guest_create_post.description',
            defaultMessage: '',
        },
    }),
    guest_create_private_channel: defineMessages({
        name: {
            id: 'admin.permissions.group.guest_create_private_channel.name',
            defaultMessage: '',
        },
        description: {
            id: 'admin.permissions.group.guest_create_private_channel.description',
            defaultMessage: '',
        },
    }),
    guest_delete_post: defineMessages({
        name: {
            id: 'admin.permissions.group.guest_delete_post.name',
            defaultMessage: '',
        },
        description: {
            id: 'admin.permissions.group.guest_delete_post.description',
            defaultMessage: '',
        },
    }),
    guest_edit_post: defineMessages({
        name: {
            id: 'admin.permissions.group.guest_edit_post.name',
            defaultMessage: '',
        },
        description: {
            id: 'admin.permissions.group.guest_edit_post.description',
            defaultMessage: '',
        },
    }),
    guest_use_channel_mentions: defineMessages({
        name: {
            id: 'admin.permissions.group.guest_use_channel_mentions.name',
            defaultMessage: '',
        },
        description: {
            id: 'admin.permissions.group.guest_use_channel_mentions.description',
            defaultMessage: '',
        },
    }),
    guest_use_group_mentions: defineMessages({
        name: {
            id: 'admin.permissions.group.guest_use_group_mentions.name',
            defaultMessage: '',
        },
        description: {
            id: 'admin.permissions.group.guest_use_group_mentions.description',
            defaultMessage: '',
        },
    }),
    manage_private_channel_members_and_read_groups: defineMessages({
        name: {
            id: 'admin.permissions.group.manage_private_channel_members_and_read_groups.name',
            defaultMessage: '',
        },
        description: {
            id: 'admin.permissions.group.manage_private_channel_members_and_read_groups.description',
            defaultMessage: '',
        },
    }),
    manage_public_channel_members_and_read_groups: defineMessages({
        name: {
            id: 'admin.permissions.group.manage_public_channel_members_and_read_groups.name',
            defaultMessage: '',
        },
        description: {
            id: 'admin.permissions.group.manage_public_channel_members_and_read_groups.description',
            defaultMessage: '',
        },
    }),
    convert_public_channel_to_private: defineMessages({
        name: {
            id: 'admin.permissions.group.convert_public_channel_to_private.name',
            defaultMessage: '',
        },
        description: {
            id: 'admin.permissions.group.convert_public_channel_to_private.description',
            defaultMessage: '',
        },
    }),
    manage_shared_channels: defineMessages({
        name: {
            id: 'admin.permissions.group.manage_shared_channels.name',
            defaultMessage: '',
        },
        description: {
            id: 'admin.permissions.group.manage_shared_channels.description',
            defaultMessage: '',
        },
    }),
    playbook_public: defineMessages({
        name: {
            id: 'admin.permissions.group.playbook_public.name',
            defaultMessage: '',
        },
        description: {
            id: 'admin.permissions.group.playbook_public.description',
            defaultMessage: '',
        },
    }),
    playbook_private: defineMessages({
        name: {
            id: 'admin.permissions.group.playbook_private.name',
            defaultMessage: '',
        },
        description: {
            id: 'admin.permissions.group.playbook_private.description',
            defaultMessage: '',
        },
    }),
    runs: defineMessages({
        name: {
            id: 'admin.permissions.group.runs.name',
            defaultMessage: '',
        },
        description: {
            id: 'admin.permissions.group.runs.description',
            defaultMessage: '',
        },
    }),
    custom_groups: defineMessages({
        name: {
            id: 'admin.permissions.group.custom_groups.name',
            defaultMessage: '',
        },
        description: {
            id: 'admin.permissions.group.custom_groups.description',
            defaultMessage: '',
        },
    }),
};
