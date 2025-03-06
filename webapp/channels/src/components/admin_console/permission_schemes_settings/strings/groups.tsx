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
            defaultMessage: 'Manage Posts',
        },
        description: {
            id: 'admin.permissions.group.posts.description',
            defaultMessage: 'Write, edit and delete posts.',
        },
    }),
    create_post: defineMessages({
        name: {
            id: 'admin.permissions.permission.create_post.name',
            defaultMessage: 'Create Posts',
        },
        description: {
            id: 'admin.permissions.permission.create_post.description',
            defaultMessage: 'Allow users to create posts.',
        },
    }),
    private_channel: defineMessages({
        name: {
            id: 'admin.permissions.group.private_channel.name',
            defaultMessage: 'Manage Private Channels',
        },
        description: {
            id: 'admin.permissions.group.private_channel.description',
            defaultMessage: 'Create and archive channels, manage settings and members.',
        },
    }),
    public_channel: defineMessages({
        name: {
            id: 'admin.permissions.group.public_channel.name',
            defaultMessage: 'Manage Public Channels',
        },
        description: {
            id: 'admin.permissions.group.public_channel.description',
            defaultMessage: 'Join, create and archive channels, manage settings and members.',
        },
    }),
    reactions: defineMessages({
        name: {
            id: 'admin.permissions.group.reactions.name',
            defaultMessage: 'Post Reactions',
        },
        description: {
            id: 'admin.permissions.group.reactions.description',
            defaultMessage: 'Add and delete reactions on posts.',
        },
    }),
    send_invites: defineMessages({
        name: {
            id: 'admin.permissions.group.send_invites.name',
            defaultMessage: 'Add Team Members',
        },
        description: {
            id: 'admin.permissions.group.send_invites.description',
            defaultMessage: 'Add team members, send email invites and share team invite link.',
        },
    }),
    teams: defineMessages({
        name: {
            id: 'admin.permissions.group.teams.name',
            defaultMessage: 'Teams',
        },
        description: {
            id: 'admin.permissions.group.teams.description',
            defaultMessage: 'Create teams and manage members.',
        },
    }),
    edit_posts: defineMessages({
        name: {
            id: 'admin.permissions.group.edit_posts.name',
            defaultMessage: 'Edit Posts',
        },
        description: {
            id: 'admin.permissions.group.edit_posts.description',
            defaultMessage: 'Edit own and others\' posts.',
        },
    }),
    teams_team_scope: defineMessages({
        name: {
            id: 'admin.permissions.group.teams_team_scope.name',
            defaultMessage: 'Teams',
        },
        description: {
            id: 'admin.permissions.group.teams_team_scope.description',
            defaultMessage: 'Manage team members.',
        },
    }),
    guest_reactions: defineMessages({
        name: {
            id: 'admin.permissions.group.guest_reactions.name',
            defaultMessage: 'Post Reactions',
        },
        description: {
            id: 'admin.permissions.group.guest_reactions.description',
            defaultMessage: 'Add and delete reactions on posts.',
        },
    }),
    guest_create_post: defineMessages({
        name: {
            id: 'admin.permissions.group.guest_create_post.name',
            defaultMessage: 'Create Posts',
        },
        description: {
            id: 'admin.permissions.group.guest_create_post.description',
            defaultMessage: 'Allow users to create posts.',
        },
    }),
    guest_create_private_channel: defineMessages({
        name: {
            id: 'admin.permissions.group.guest_create_private_channel.name',
            defaultMessage: 'Create Channels',
        },
        description: {
            id: 'admin.permissions.group.guest_create_private_channel.description',
            defaultMessage: 'Create new private channels.',
        },
    }),
    guest_delete_post: defineMessages({
        name: {
            id: 'admin.permissions.group.guest_delete_post.name',
            defaultMessage: 'Delete Own Posts',
        },
        description: {
            id: 'admin.permissions.group.guest_delete_post.description',
            defaultMessage: 'Author\'s own posts can be deleted.',
        },
    }),
    guest_edit_post: defineMessages({
        name: {
            id: 'admin.permissions.group.guest_edit_post.name',
            defaultMessage: 'Edit Own Posts',
        },
        description: {
            id: 'admin.permissions.group.guest_edit_post.description',
            defaultMessage: '{editTimeLimitButton} after posting, allow users to edit their own posts.',
        },
    }),
    guest_use_channel_mentions: defineMessages({
        name: {
            id: 'admin.permissions.group.guest_use_channel_mentions.name',
            defaultMessage: 'Channel Mentions',
        },
        description: {
            id: 'admin.permissions.group.guest_use_channel_mentions.description',
            defaultMessage: 'Notify channel members with @all, @channel and @here',
        },
    }),
    guest_use_group_mentions: defineMessages({
        name: {
            id: 'admin.permissions.group.guest_use_group_mentions.name',
            defaultMessage: 'Group Mentions',
        },
        description: {
            id: 'admin.permissions.group.guest_use_group_mentions.description',
            defaultMessage: 'Notify group members with a group mention',
        },
    }),
    manage_private_channel_members_and_read_groups: defineMessages({
        name: {
            id: 'admin.permissions.group.manage_private_channel_members_and_read_groups.name',
            defaultMessage: 'Manage Channel Members',
        },
        description: {
            id: 'admin.permissions.group.manage_private_channel_members_and_read_groups.description',
            defaultMessage: 'Add and remove private channel members (including channel admins).',
        },
    }),
    manage_public_channel_members_and_read_groups: defineMessages({
        name: {
            id: 'admin.permissions.group.manage_public_channel_members_and_read_groups.name',
            defaultMessage: 'Manage Channel Members',
        },
        description: {
            id: 'admin.permissions.group.manage_public_channel_members_and_read_groups.description',
            defaultMessage: 'Add and remove public channel members (including channel admins).',
        },
    }),
    convert_public_channel_to_private: defineMessages({
        name: {
            id: 'admin.permissions.group.convert_public_channel_to_private.name',
            defaultMessage: 'Convert to private',
        },
        description: {
            id: 'admin.permissions.group.convert_public_channel_to_private.description',
            defaultMessage: 'Convert public channels to private',
        },
    }),
    convert_private_channel_to_public: defineMessages({
        name: {
            id: 'admin.permissions.group.convert_private_channel_to_public.name',
            defaultMessage: 'Convert to public',
        },
        description: {
            id: 'admin.permissions.group.convert_private_channel_to_public.description',
            defaultMessage: 'Convert private channels to public',
        },
    }),
    manage_shared_channels: defineMessages({
        name: {
            id: 'admin.permissions.group.manage_shared_channels.name',
            defaultMessage: 'Shared Channels',
        },
        description: {
            id: 'admin.permissions.group.manage_shared_channels.description',
            defaultMessage: 'Manage Shared Channels',
        },
    }),
    playbook_public: defineMessages({
        name: {
            id: 'admin.permissions.group.playbook_public.name',
            defaultMessage: 'Manage Public Playbooks',
        },
        description: {
            id: 'admin.permissions.group.playbook_public.description',
            defaultMessage: 'Manage public playbooks.',
        },
    }),
    playbook_private: defineMessages({
        name: {
            id: 'admin.permissions.group.playbook_private.name',
            defaultMessage: 'Manage Private Playbooks',
        },
        description: {
            id: 'admin.permissions.group.playbook_private.description',
            defaultMessage: 'Manage private playbooks.',
        },
    }),
    runs: defineMessages({
        name: {
            id: 'admin.permissions.group.runs.name',
            defaultMessage: 'Manage Runs',
        },
        description: {
            id: 'admin.permissions.group.runs.description',
            defaultMessage: 'Manage runs.',
        },
    }),
    custom_groups: defineMessages({
        name: {
            id: 'admin.permissions.group.custom_groups.name',
            defaultMessage: 'Custom Groups',
        },
        description: {
            id: 'admin.permissions.group.custom_groups.description',
            defaultMessage: 'Create, edit, delete and manage the members of custom groups.',
        },
    }),
    manage_public_channel_bookmarks: defineMessages({
        name: {
            id: 'admin.permissions.group.manage_public_channel_bookmarks.name',
            defaultMessage: 'Manage Bookmarks',
        },
        description: {
            id: 'admin.permissions.group.manage_public_channel_bookmarks.description',
            defaultMessage: 'Add, edit, delete and sort bookmarks',
        },
    }),
    manage_private_channel_bookmarks: defineMessages({
        name: {
            id: 'admin.permissions.group.manage_private_channel_bookmarks.name',
            defaultMessage: 'Manage Bookmarks',
        },
        description: {
            id: 'admin.permissions.group.manage_private_channel_bookmarks.description',
            defaultMessage: 'Add, edit, delete and sort bookmarks',
        },
    }),
};
