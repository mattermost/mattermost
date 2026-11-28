// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const checkboxesTitleToIdMap = {
    ALL_USERS_MANAGE_PUBLIC_CHANNEL_MEMBERS: '[data-testid="admin.permissions.role:all_users--group"] [data-testid="admin.permissions.group:manage_public_channel_members_and_read_groups--checkbox"] [data-testid="admin.permissions.group.checkbox"]',
    ALL_USERS_MANAGE_PRIVATE_CHANNEL_MEMBERS: '[data-testid="admin.permissions.role:all_users--group"] [data-testid="admin.permissions.group:manage_private_channel_members_and_read_groups--checkbox"] [data-testid="admin.permissions.group.checkbox"]',
    ALL_USERS_MANAGE_OAUTH_APPLICATIONS: '[data-testid="admin.permissions.role:all_users--group"] [data-testid="admin.permissions.group.row:manage_oauth--checkbox"] [data-testid="admin.permissions.group.row.checkbox"]',
    CREATE_POSTS_GUESTS: '[data-testid="admin.channel.moderation.permission:create_post"] [data-testid="admin.channel.moderation.permission.guests--checkbox"]',
    CREATE_POSTS_MEMBERS: '[data-testid="admin.channel.moderation.permission:create_post"] [data-testid="admin.channel.moderation.permission.members--checkbox"]',
    POST_REACTIONS_GUESTS: '[data-testid="admin.channel.moderation.permission:create_reactions"] [data-testid="admin.channel.moderation.permission.guests--checkbox"]',
    POST_REACTIONS_MEMBERS: '[data-testid="admin.channel.moderation.permission:create_reactions"] [data-testid="admin.channel.moderation.permission.members--checkbox"]',
    MANAGE_MEMBERS_GUESTS: '[data-testid="admin.channel.moderation.permission:manage_members"] [data-testid="admin.channel.moderation.permission.guests--checkbox"]',
    MANAGE_MEMBERS_MEMBERS: '[data-testid="admin.channel.moderation.permission:manage_members"] [data-testid="admin.channel.moderation.permission.members--checkbox"]',
    CHANNEL_MENTIONS_MEMBERS: '[data-testid="admin.channel.moderation.permission:use_channel_mentions"] [data-testid="admin.channel.moderation.permission.members--checkbox"]',
    CHANNEL_MENTIONS_GUESTS: '[data-testid="admin.channel.moderation.permission:use_channel_mentions"] [data-testid="admin.channel.moderation.permission.guests--checkbox"]',
};

export const checkBoxes = [
    checkboxesTitleToIdMap.CREATE_POSTS_GUESTS,
    checkboxesTitleToIdMap.CREATE_POSTS_MEMBERS,
    checkboxesTitleToIdMap.POST_REACTIONS_GUESTS,
    checkboxesTitleToIdMap.POST_REACTIONS_MEMBERS,
    checkboxesTitleToIdMap.MANAGE_MEMBERS_MEMBERS,
    checkboxesTitleToIdMap.CHANNEL_MENTIONS_GUESTS,
    checkboxesTitleToIdMap.CHANNEL_MENTIONS_MEMBERS,
];
