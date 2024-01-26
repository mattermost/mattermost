// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export enum ColumnNames {
    username = 'usernameColumn',
    displayName = 'displayNameColumn',
    email = 'emailColumn',
    createAt = 'createAtColumn',
    lastLoginAt = 'lastLoginColumn',
    lastStatusAt = 'lastStatusAtColumn',
    lastPostDate = 'lastPostDateColumn',
    daysActive = 'daysActiveColumn',
    totalPosts = 'totalPostsColumn',
    actions = 'actionsColumn',
}

export enum StatusFilter {
    Any = 'any',
    Active = 'active',
    Deactivated = 'deactivated',
}

export enum RoleFilters {
    Any = 'any',
    Admin = 'system_admin',
    Member = 'system_user',
    Guest = 'system_guest',
}

export enum TeamFilters {
    AllTeams = 'teams_filter_for_all_teams',
    NoTeams = 'teams_filter_for_no_teams',
}
