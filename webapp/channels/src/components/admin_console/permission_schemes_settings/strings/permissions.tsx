// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MessageDescriptor} from 'react-intl';
import {defineMessages} from 'react-intl';

export const permissionRolesStrings: Record<string, Record<string, MessageDescriptor>> = {
    assign_system_admin_role: defineMessages({
        name: {
            id: 'admin.permissions.permission.assign_system_admin_role.name',
            defaultMessage: 'Assign system admin role',
        },
        description: {
            id: 'admin.permissions.permission.assign_system_admin_role.description',
            defaultMessage: 'Assign system admin role',
        },
    }),
    convert_public_channel_to_private: defineMessages({
        name: {
            id: 'admin.permissions.permission.convert_public_channel_to_private.name',
            defaultMessage: 'Convert to private',
        },
        description: {
            id: 'admin.permissions.permission.convert_public_channel_to_private.description',
            defaultMessage: 'Convert public channels to private',
        },
    }),
    convert_private_channel_to_public: defineMessages({
        name: {
            id: 'admin.permissions.permission.convert_private_channel_to_public.name',
            defaultMessage: 'Convert to public',
        },
        description: {
            id: 'admin.permissions.permission.convert_private_channel_to_public.description',
            defaultMessage: 'Convert private channels to public',
        },
    }),
    create_direct_channel: defineMessages({
        name: {
            id: 'admin.permissions.permission.create_direct_channel.name',
            defaultMessage: 'Create direct channel',
        },
        description: {
            id: 'admin.permissions.permission.create_direct_channel.description',
            defaultMessage: 'Create direct channel',
        },
    }),
    create_group_channel: defineMessages({
        name: {
            id: 'admin.permissions.permission.create_group_channel.name',
            defaultMessage: 'Create group channel',
        },
        description: {
            id: 'admin.permissions.permission.create_group_channel.description',
            defaultMessage: 'Create group channel',
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
    create_private_channel: defineMessages({
        name: {
            id: 'admin.permissions.permission.create_private_channel.name',
            defaultMessage: 'Create Channels',
        },
        description: {
            id: 'admin.permissions.permission.create_private_channel.description',
            defaultMessage: 'Create new private channels.',
        },
    }),
    create_public_channel: defineMessages({
        name: {
            id: 'admin.permissions.permission.create_public_channel.name',
            defaultMessage: 'Create Channels',
        },
        description: {
            id: 'admin.permissions.permission.create_public_channel.description',
            defaultMessage: 'Create new public channels.',
        },
    }),
    create_team: defineMessages({
        name: {
            id: 'admin.permissions.permission.create_team.name',
            defaultMessage: 'Create Teams',
        },
        description: {
            id: 'admin.permissions.permission.create_team.description',
            defaultMessage: 'Create new teams.',
        },
    }),
    create_user_access_token: defineMessages({
        name: {
            id: 'admin.permissions.permission.create_user_access_token.name',
            defaultMessage: 'Create user access token',
        },
        description: {
            id: 'admin.permissions.permission.create_user_access_token.description',
            defaultMessage: 'Create user access token',
        },
    }),
    delete_others_posts: defineMessages({
        name: {
            id: 'admin.permissions.permission.delete_others_posts.name',
            defaultMessage: 'Delete Others\' Posts',
        },
        description: {
            id: 'admin.permissions.permission.delete_others_posts.description',
            defaultMessage: 'Posts made by other users can be deleted.',
        },
    }),
    delete_post: defineMessages({
        name: {
            id: 'admin.permissions.permission.delete_post.name',
            defaultMessage: 'Delete Own Posts',
        },
        description: {
            id: 'admin.permissions.permission.delete_post.description',
            defaultMessage: 'Author\'s own posts can be deleted.',
        },
    }),
    delete_private_channel: defineMessages({
        name: {
            id: 'admin.permissions.permission.delete_private_channel.name',
            defaultMessage: 'Archive Channels',
        },
        description: {
            id: 'admin.permissions.permission.delete_private_channel.description',
            defaultMessage: 'Archive private channels.',
        },
    }),
    delete_public_channel: defineMessages({
        name: {
            id: 'admin.permissions.permission.delete_public_channel.name',
            defaultMessage: 'Archive Channels',
        },
        description: {
            id: 'admin.permissions.permission.delete_public_channel.description',
            defaultMessage: 'Archive public channels.',
        },
    }),
    edit_other_users: defineMessages({
        name: {
            id: 'admin.permissions.permission.edit_other_users.name',
            defaultMessage: 'Edit other users',
        },
        description: {
            id: 'admin.permissions.permission.edit_other_users.description',
            defaultMessage: 'Edit other users',
        },
    }),
    edit_post: defineMessages({
        name: {
            id: 'admin.permissions.permission.edit_post.name',
            defaultMessage: 'Edit Own Posts',
        },
        description: {
            id: 'admin.permissions.permission.edit_post.description',
            defaultMessage: '{editTimeLimitButton} after posting, allow users to edit their own posts.',
        },
    }),
    import_team: defineMessages({
        name: {
            id: 'admin.permissions.permission.import_team.name',
            defaultMessage: 'Import team',
        },
        description: {
            id: 'admin.permissions.permission.import_team.description',
            defaultMessage: 'Import team',
        },
    }),
    list_team_channels: defineMessages({
        name: {
            id: 'admin.permissions.permission.list_team_channels.name',
            defaultMessage: 'List team channels',
        },
        description: {
            id: 'admin.permissions.permission.list_team_channels.description',
            defaultMessage: 'List team channels',
        },
    }),
    list_users_without_team: defineMessages({
        name: {
            id: 'admin.permissions.permission.list_users_without_team.name',
            defaultMessage: 'List users without team',
        },
        description: {
            id: 'admin.permissions.permission.list_users_without_team.description',
            defaultMessage: 'List users without team',
        },
    }),
    manage_channel_roles: defineMessages({
        name: {
            id: 'admin.permissions.permission.manage_channel_roles.name',
            defaultMessage: 'Manage channel roles',
        },
        description: {
            id: 'admin.permissions.permission.manage_channel_roles.description',
            defaultMessage: 'Manage channel roles',
        },
    }),
    create_emojis: defineMessages({
        name: {
            id: 'admin.permissions.permission.create_emojis.name',
            defaultMessage: 'Create Custom Emoji',
        },
        description: {
            id: 'admin.permissions.permission.create_emojis.description',
            defaultMessage: 'Allow users to create custom emoji.',
        },
    }),
    delete_emojis: defineMessages({
        name: {
            id: 'admin.permissions.permission.delete_emojis.name',
            defaultMessage: 'Delete Own Custom Emoji',
        },
        description: {
            id: 'admin.permissions.permission.delete_emojis.description',
            defaultMessage: 'Allow users to delete custom emoji that they created.',
        },
    }),
    delete_others_emojis: defineMessages({
        name: {
            id: 'admin.permissions.permission.delete_others_emojis.name',
            defaultMessage: 'Delete Others\' Custom Emoji',
        },
        description: {
            id: 'admin.permissions.permission.delete_others_emojis.description',
            defaultMessage: 'Allow users to delete custom emoji that were created by other users.',
        },
    }),
    manage_jobs: defineMessages({
        name: {
            id: 'admin.permissions.permission.manage_jobs.name',
            defaultMessage: 'Manage jobs',
        },
        description: {
            id: 'admin.permissions.permission.manage_jobs.description',
            defaultMessage: 'Manage jobs',
        },
    }),
    manage_oauth: defineMessages({
        name: {
            id: 'admin.permissions.permission.manage_oauth.name',
            defaultMessage: 'Manage OAuth Applications',
        },
        description: {
            id: 'admin.permissions.permission.manage_oauth.description',
            defaultMessage: 'Create, edit and delete OAuth 2.0 application tokens.',
        },
    }),
    manage_private_channel_properties: defineMessages({
        name: {
            id: 'admin.permissions.permission.manage_private_channel_properties.name',
            defaultMessage: 'Manage Channel Settings',
        },
        description: {
            id: 'admin.permissions.permission.manage_private_channel_properties.description',
            defaultMessage: 'Update private channel names, headers and purposes.',
        },
    }),
    manage_public_channel_properties: defineMessages({
        name: {
            id: 'admin.permissions.permission.manage_public_channel_properties.name',
            defaultMessage: 'Manage Channel Settings',
        },
        description: {
            id: 'admin.permissions.permission.manage_public_channel_properties.description',
            defaultMessage: 'Update public channel names, headers and purposes.',
        },
    }),
    manage_roles: defineMessages({
        name: {
            id: 'admin.permissions.permission.manage_roles.name',
            defaultMessage: 'Manage roles',
        },
        description: {
            id: 'admin.permissions.permission.manage_roles.description',
            defaultMessage: 'Manage roles',
        },
    }),
    manage_slash_commands: defineMessages({
        name: {
            id: 'admin.permissions.permission.manage_slash_commands.name',
            defaultMessage: 'Manage Slash Commands',
        },
        description: {
            id: 'admin.permissions.permission.manage_slash_commands.description',
            defaultMessage: 'Create, edit and delete custom slash commands.',
        },
    }),
    manage_system: defineMessages({
        name: {
            id: 'admin.permissions.permission.manage_system.name',
            defaultMessage: 'Manage system',
        },
        description: {
            id: 'admin.permissions.permission.manage_system.description',
            defaultMessage: 'Manage system',
        },
    }),
    manage_team: defineMessages({
        name: {
            id: 'admin.permissions.permission.manage_team.name',
            defaultMessage: 'Manage team',
        },
        description: {
            id: 'admin.permissions.permission.manage_team.description',
            defaultMessage: 'Manage team',
        },
    }),
    manage_team_roles: defineMessages({
        name: {
            id: 'admin.permissions.permission.manage_team_roles.name',
            defaultMessage: 'Manage team roles',
        },
        description: {
            id: 'admin.permissions.permission.manage_team_roles.description',
            defaultMessage: 'Manage team roles',
        },
    }),
    manage_incoming_webhooks: defineMessages({
        name: {
            id: 'admin.permissions.permission.manage_incoming_webhooks.name',
            defaultMessage: 'Manage Incoming Webhooks',
        },
        description: {
            id: 'admin.permissions.permission.manage_incoming_webhooks.description',
            defaultMessage: 'Create, edit, and delete incoming webhooks.',
        },
    }),
    manage_outgoing_webhooks: defineMessages({
        name: {
            id: 'admin.permissions.permission.manage_outgoing_webhooks.name',
            defaultMessage: 'Manage Outgoing Webhooks',
        },
        description: {
            id: 'admin.permissions.permission.manage_outgoing_webhooks.description',
            defaultMessage: 'Create, edit, and delete outgoing webhooks.',
        },
    }),
    permanent_delete_user: defineMessages({
        name: {
            id: 'admin.permissions.permission.permanent_delete_user.name',
            defaultMessage: 'Permanent delete user',
        },
        description: {
            id: 'admin.permissions.permission.permanent_delete_user.description',
            defaultMessage: 'Permanent delete user',
        },
    }),
    read_channel: defineMessages({
        name: {
            id: 'admin.permissions.permission.read_channel.name',
            defaultMessage: 'Read channel',
        },
        description: {
            id: 'admin.permissions.permission.read_channel.description',
            defaultMessage: 'Read channel',
        },
    }),
    read_user_access_token: defineMessages({
        name: {
            id: 'admin.permissions.permission.read_user_access_token.name',
            defaultMessage: 'Read user access token',
        },
        description: {
            id: 'admin.permissions.permission.read_user_access_token.description',
            defaultMessage: 'Read user access token',
        },
    }),
    remove_user_from_team: defineMessages({
        name: {
            id: 'admin.permissions.permission.remove_user_from_team.name',
            defaultMessage: 'Remove user from team',
        },
        description: {
            id: 'admin.permissions.permission.remove_user_from_team.description',
            defaultMessage: 'Remove user from team',
        },
    }),
    revoke_user_access_token: defineMessages({
        name: {
            id: 'admin.permissions.permission.revoke_user_access_token.name',
            defaultMessage: 'Revoke user access token',
        },
        description: {
            id: 'admin.permissions.permission.revoke_user_access_token.description',
            defaultMessage: 'Revoke user access token',
        },
    }),
    upload_file: defineMessages({
        name: {
            id: 'admin.permissions.permission.upload_file.name',
            defaultMessage: 'Upload file',
        },
        description: {
            id: 'admin.permissions.permission.upload_file.description',
            defaultMessage: 'Upload file',
        },
    }),
    use_channel_mentions: defineMessages({
        name: {
            id: 'admin.permissions.permission.use_channel_mentions.name',
            defaultMessage: 'Channel Mentions',
        },
        description: {
            id: 'admin.permissions.permission.use_channel_mentions.description',
            defaultMessage: 'Notify channel members with @all, @channel and @here',
        },
    }),
    use_group_mentions: defineMessages({
        name: {
            id: 'admin.permissions.permission.use_group_mentions.name',
            defaultMessage: 'Group Mentions',
        },
        description: {
            id: 'admin.permissions.permission.use_group_mentions.description',
            defaultMessage: 'Notify group members with a group mention',
        },
    }),
    view_team: defineMessages({
        name: {
            id: 'admin.permissions.permission.view_team.name',
            defaultMessage: 'View team',
        },
        description: {
            id: 'admin.permissions.permission.view_team.description',
            defaultMessage: 'View team',
        },
    }),
    edit_others_posts: defineMessages({
        name: {
            id: 'admin.permissions.permission.edit_others_posts.name',
            defaultMessage: 'Edit Others\' Posts',
        },
        description: {
            id: 'admin.permissions.permission.edit_others_posts.description',
            defaultMessage: 'Allow users to edit others\' posts.',
        },
    }),
    invite_guest: defineMessages({
        name: {
            id: 'admin.permissions.permission.invite_guest.name',
            defaultMessage: 'Invite guests',
        },
        description: {
            id: 'admin.permissions.permission.invite_guest.description',
            defaultMessage: 'Invite guests to channels and send guest email invites.',
        },
    }),
    manage_shared_channels: defineMessages({
        name: {
            id: 'admin.permissions.permission.manage_shared_channels.name',
            defaultMessage: 'Manage Shared Channels',
        },
        description: {
            id: 'admin.permissions.permission.manage_shared_channels.description',
            defaultMessage: 'Share, unshare and invite another instance to sync with a shared channel',
        },
    }),
    manage_secure_connections: defineMessages({
        name: {
            id: 'admin.permissions.permission.manage_secure_connections.name',
            defaultMessage: 'Manage Secure Connections',
        },
        description: {
            id: 'admin.permissions.permission.manage_secure_connections.description',
            defaultMessage: 'Create, remove and view secure connections for shared channels',
        },
    }),
    playbook_public_create: defineMessages({
        name: {
            id: 'admin.permissions.permission.playbook_public_create.name',
            defaultMessage: 'Create Public Playbook',
        },
        description: {
            id: 'admin.permissions.permission.playbook_public_create.description',
            defaultMessage: 'Create new public playbooks.',
        },
    }),
    playbook_public_manage_properties: defineMessages({
        name: {
            id: 'admin.permissions.permission.playbook_public_manage_properties.name',
            defaultMessage: 'Manage Playbook Configurations',
        },
        description: {
            id: 'admin.permissions.permission.playbook_public_manage_properties.description',
            defaultMessage: 'Prescribe checklists, actions, and templates.',
        },
    }),
    playbook_public_manage_members: defineMessages({
        name: {
            id: 'admin.permissions.permission.playbook_public_manage_members.name',
            defaultMessage: 'Manage Playbook Members',
        },
        description: {
            id: 'admin.permissions.permission.playbook_public_manage_members.description',
            defaultMessage: 'Add and remove public playbook members (including playbook admins).',
        },
    }),
    playbook_public_make_private: defineMessages({
        name: {
            id: 'admin.permissions.permission.playbook_public_make_private.name',
            defaultMessage: 'Convert Playbooks',
        },
        description: {
            id: 'admin.permissions.permission.playbook_public_make_private.description',
            defaultMessage: 'Convert public playbooks to private.',
        },
    }),
    playbook_private_create: defineMessages({
        name: {
            id: 'admin.permissions.permission.playbook_private_create.name',
            defaultMessage: 'Create Private Playbook',
        },
        description: {
            id: 'admin.permissions.permission.playbook_private_create.description',
            defaultMessage: 'Create new private playbooks.',
        },
    }),
    playbook_private_manage_properties: defineMessages({
        name: {
            id: 'admin.permissions.permission.playbook_private_manage_properties.name',
            defaultMessage: 'Manage Playbook Configurations',
        },
        description: {
            id: 'admin.permissions.permission.playbook_private_manage_properties.description',
            defaultMessage: 'Prescribe checklists, actions, and templates.',
        },
    }),
    playbook_private_manage_members: defineMessages({
        name: {
            id: 'admin.permissions.permission.playbook_private_manage_members.name',
            defaultMessage: 'Manage Playbook Members',
        },
        description: {
            id: 'admin.permissions.permission.playbook_private_manage_members.description',
            defaultMessage: 'Add and remove private playbook members (including playbook admins).',
        },
    }),
    playbook_private_make_public: defineMessages({
        name: {
            id: 'admin.permissions.permission.playbook_private_make_public.name',
            defaultMessage: 'Convert Playbooks',
        },
        description: {
            id: 'admin.permissions.permission.playbook_private_make_public.description',
            defaultMessage: 'Convert private playbooks to public.',
        },
    }),
    run_create: defineMessages({
        name: {
            id: 'admin.permissions.permission.run_create.name',
            defaultMessage: 'Create Runs',
        },
        description: {
            id: 'admin.permissions.permission.run_create.description',
            defaultMessage: 'Run playbooks.',
        },
    }),
    create_custom_group: defineMessages({
        name: {
            id: 'admin.permissions.permission.create_custom_group.name',
            defaultMessage: 'Create',
        },
        description: {
            id: 'admin.permissions.permission.create_custom_group.description',
            defaultMessage: 'Create custom groups.',
        },
    }),
    manage_custom_group_members: defineMessages({
        name: {
            id: 'admin.permissions.permission.manage_custom_group_members.name',
            defaultMessage: 'Manage members',
        },
        description: {
            id: 'admin.permissions.permission.manage_custom_group_members.description',
            defaultMessage: 'Add and remove custom group members.',
        },
    }),
    delete_custom_group: defineMessages({
        name: {
            id: 'admin.permissions.permission.delete_custom_group.name',
            defaultMessage: 'Delete',
        },
        description: {
            id: 'admin.permissions.permission.delete_custom_group.description',
            defaultMessage: 'Delete custom groups.',
        },
    }),
    restore_custom_group: defineMessages({
        name: {
            id: 'admin.permissions.permission.restore_custom_group.name',
            defaultMessage: 'Restore',
        },
        description: {
            id: 'admin.permissions.permission.restore_custom_group.description',
            defaultMessage: 'Restore archived user groups.',
        },
    }),
    edit_custom_group: defineMessages({
        name: {
            id: 'admin.permissions.permission.edit_custom_group.name',
            defaultMessage: 'Edit',
        },
        description: {
            id: 'admin.permissions.permission.edit_custom_group.description',
            defaultMessage: 'Rename custom groups.',
        },
    }),
    manage_outgoing_oauth_connections: defineMessages({
        name: {
            id: 'admin.permissions.permission.manage_outgoing_oauth_connections.name',
            defaultMessage: 'Manage Outgoing OAuth Credentials',
        },
        description: {
            id: 'admin.permissions.permission.manage_outgoing_oauth_connections.description',
            defaultMessage: 'Create, edit, and delete outgoing OAuth credentials.',
        },
    }),
    manage_public_channel_banner: defineMessages({
        name: {
            id: 'admin.permissions.permission.manage_public_channel_banner.name',
            defaultMessage: 'Manage Channel Banner',
        },
        description: {
            id: 'admin.permissions.permission.manage_public_channel_banner.description',
            defaultMessage: 'Enable, disable and edit channel banner.',
        },
    }),
    manage_private_channel_banner: defineMessages({
        name: {
            id: 'admin.permissions.permission.manage_private_channel_banner.name',
            defaultMessage: 'Manage Channel Banner',
        },
        description: {
            id: 'admin.permissions.permission.manage_private_channel_banner.description',
            defaultMessage: 'Enable, disable and edit channel banner.',
        },
    }),
};
