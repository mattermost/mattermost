// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserProfile} from './users';
import type {RelationOneToOne} from './utilities';

export enum SyncableType {
    Team = 'team',
    Channel = 'channel'
}

export type SyncablePatch = {
    scheme_admin: boolean;
    auto_add: boolean;
};

export type GroupPatch = {
    allow_reference: boolean;
    name?: string;
};

export type CustomGroupPatch = {
    name: string;
    display_name: string;
};

export type Group = {
    id: string;
    name: string;
    display_name: string;
    description: string;
    source: string;
    remote_id: string | null;
    create_at: number;
    update_at: number;
    delete_at: number;
    has_syncables: boolean;
    member_count: number;
    scheme_admin: boolean;
    allow_reference: boolean;
    channel_member_count?: number;
    channel_member_timezones_count?: number;
    member_ids?: string[];
};

export enum GroupSource {
    Ldap = 'ldap',
    Custom = 'custom',
}

export type GroupTeam = {
    team_id: string;
    team_display_name: string;
    team_type?: string;
    group_id?: string;
    auto_add?: boolean;
    scheme_admin?: boolean;
    create_at?: number;
    delete_at?: number;
    update_at?: number;
};

export type GroupChannel = {
    channel_id: string;
    channel_display_name: string;
    channel_type?: string;
    team_id: string;
    team_display_name: string;
    team_type?: string;
    group_id?: string;
    auto_add?: boolean;
    scheme_admin?: boolean;
    create_at?: number;
    delete_at?: number;
    update_at?: number;
};

export type GroupSyncable = {
    group_id: string;

    auto_add: boolean;
    scheme_admin: boolean;
    create_at: number;
    delete_at: number;
    update_at: number;
    type: 'Team' | 'Channel';
};

export type GroupSyncablesState = {
    teams: GroupTeam[];
    channels: GroupChannel[];
};

export type GroupsState = {
    syncables: Record<string, GroupSyncablesState>;
    stats: RelationOneToOne<Group, GroupStats>;
    groups: Record<string, Group>;
    myGroups: string[];
};

export type GroupStats = {
    group_id: string;
    total_member_count: number;
};

export type GroupSearchOpts = {
    q: string;
    is_linked?: boolean;
    is_configured?: boolean;
};

export type MixedUnlinkedGroup = {
    mattermost_group_id?: string;
    name: string;
    primary_key: string;
    has_syncables?: boolean;
};

export type MixedUnlinkedGroupRedux = MixedUnlinkedGroup & {
    failed?: boolean;
};

export type UserWithGroup = UserProfile & {
    groups: Group[];
    scheme_guest: boolean;
    scheme_user: boolean;
    scheme_admin: boolean;
};

export type GroupsWithCount = {
    groups: Group[];
    total_group_count: number;

    // These fields are added by the client after the groups are returned by the server
    channelID?: string;
    teamID?: string;
}

export type UsersWithGroupsAndCount = {
    users: UserWithGroup[];
    total_count: number;
};

export type GroupCreateWithUserIds = {
    name: string;
    allow_reference: boolean;
    display_name: string;
    source: string;
    user_ids: string[];
    description?: string;
}

export type GetGroupsParams = {
    filter_allow_reference?: boolean;
    page?: number;
    per_page?: number;
    include_member_count?: boolean;
    include_archived?: boolean;
    filter_archived?: boolean;
    include_member_ids?: boolean;
}

export type GetGroupsForUserParams = GetGroupsParams & {
    filter_has_member: string;
}

export type GroupSearchParams = GetGroupsParams & {
    q: string;
    filter_has_member?: string;
    include_timezones?: string;
    include_channel_member_count?: string;
}

export type GroupMembership = {
    user_id: string;
    roles: string;
}

export type GroupPermissions = {
    can_delete: boolean;
    can_manage_members: boolean;
    can_restore: boolean;
}
