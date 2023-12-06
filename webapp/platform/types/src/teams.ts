// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ServerError} from './errors';
import {UserProfile} from './users';
import {RelationOneToOne} from './utilities';

export type TeamMembership = TeamUnread & {
    user_id: string;
    roles: string;
    delete_at: number;
    scheme_admin: boolean;
    scheme_guest: boolean;
    scheme_user: boolean;
};

export type TeamMemberWithError = {
    member: TeamMembership;
    user_id: string;
    error: ServerError;
}

export type TeamType = 'O' | 'I';

export type Team = {
    id: string;
    create_at: number;
    update_at: number;
    delete_at: number;
    display_name: string;
    name: string;
    description: string;
    email: string;
    type: TeamType;
    company_name: string;
    allowed_domains: string;
    invite_id: string;
    allow_open_invite: boolean;
    scheme_id: string;
    group_constrained: boolean;
    policy_id?: string | null;
};

export type TeamsState = {
    currentTeamId: string;
    teams: Record<string, Team>;
    myMembers: Record<string, TeamMembership>;
    membersInTeam: RelationOneToOne<Team, RelationOneToOne<UserProfile, TeamMembership>>;
    stats: RelationOneToOne<Team, TeamStats>;
    groupsAssociatedToTeam: any;
    totalCount: number;
};

export type TeamUnread = {
    team_id: string;

    /** The number of unread mentions in channels on this team, not including DMs and GMs */
    mention_count: number;

    /** The number of unread mentions in root posts in channels on this team, not including DMs and GMs */
    mention_count_root: number;

    /**
     * The number of unread posts in channels on this team, not including DMs and GMs
     *
     * @remarks Note that this differs from ChannelMembership.msg_count and ChannelUnread.msg_count since it tracks
     * unread posts instead of read posts.
     */
    msg_count: number;

    /**
     * The number of unread root posts in channels on this team, not including DMs and GMs
     *
     * @remarks Note that this differs from ChannelMember.msg_count_root and ChannelUnread.msg_count_root since it
     * tracks unread posts instead of read posts.
     */
    msg_count_root: number;

    thread_count?: number;
    thread_mention_count?: number;
    thread_urgent_mention_count?: number;
};

export type GetTeamMembersOpts = {
    sort?: 'Username';
    exclude_deleted_users?: boolean;
};

export type TeamsWithCount = {
    teams: Team[];
    total_count: number;
};

export type TeamStats = {
    team_id: string;
    total_member_count: number;
    active_member_count: number;
};

export type TeamSearchOpts = {
    page?: number;
    per_page?: number;
    allow_open_invite?: boolean;
    group_constrained?: boolean;
}

export type TeamInviteWithError = {
    email: string;
    error: ServerError;
};
