// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from '@mattermost/types/store';
import type {Team, TeamMembership, TeamStats} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';
import type {IDMappedObjects, RelationOneToOne} from '@mattermost/types/utilities';

import {Permissions} from 'mattermost-redux/constants';
import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getDataRetentionCustomPolicy} from 'mattermost-redux/selectors/entities/admin';
import {getConfig, isCompatibleWithJoinViewTeamPermissions} from 'mattermost-redux/selectors/entities/general';
import {haveISystemPermission} from 'mattermost-redux/selectors/entities/roles_helpers';
import {createIdsSelector} from 'mattermost-redux/utils/helpers';
import {sortTeamsWithLocale, filterTeamsStartingWithTerm} from 'mattermost-redux/utils/team_utils';
import {isTeamAdmin} from 'mattermost-redux/utils/user_utils';

import {isCollapsedThreadsEnabled} from './preferences';

export function getCurrentTeamId(state: GlobalState) {
    return state.entities.teams.currentTeamId;
}

export function getTeamByName(state: GlobalState, name: string) {
    const teams = getTeams(state);

    return Object.values(teams).find((team) => team.name === name);
}

export function getTeams(state: GlobalState): IDMappedObjects<Team> {
    return state.entities.teams.teams;
}

export function getTeamsInPolicy() {
    return (createSelector(
        'getTeamsInPolicy',
        getTeams,
        (state: GlobalState, props: {policyId: string}) => getDataRetentionCustomPolicy(state, props.policyId),
        (allTeams, policy) => {
            if (!policy) {
                return [];
            }

            const policyTeams: Team[] = [];

            Object.entries(allTeams).forEach((item: [string, Team]) => {
                const [, team] = item;
                if (team.policy_id === policy.id) {
                    policyTeams.push(team);
                }
            });

            return policyTeams;
        }) as (b: GlobalState, a: {
        policyId: string;
    }) => Team[]);
}

export function getTeamStats(state: GlobalState) {
    return state.entities.teams.stats;
}

export function getTeamMemberships(state: GlobalState) {
    return state.entities.teams.myMembers;
}

export function getMembersInTeams(state: GlobalState) {
    return state.entities.teams.membersInTeam;
}

export const getTeamsList: (state: GlobalState) => Team[] = createSelector(
    'getTeamsList',
    getTeams,
    (teams) => {
        return Object.values(teams);
    },
);

export const getActiveTeamsList: (state: GlobalState) => Team[] = createSelector(
    'getActiveTeamsList',
    getTeamsList,
    (teams) => {
        return teams.filter((team) => team.delete_at === 0);
    },
);

export const getCurrentTeam: (state: GlobalState) => Team = createSelector(
    'getCurrentTeam',
    getTeams,
    getCurrentTeamId,
    (teams, currentTeamId) => {
        return teams[currentTeamId];
    },
);

export function getTeam(state: GlobalState, id: string): Team {
    const teams = getTeams(state);
    return teams[id];
}

export const getCurrentTeamMembership: (state: GlobalState) => TeamMembership = createSelector(
    'getCurrentTeamMembership',
    getCurrentTeamId,
    getTeamMemberships,
    (currentTeamId: string, teamMemberships: {[teamId: string]: TeamMembership}): TeamMembership => {
        return teamMemberships[currentTeamId];
    },
);

export const isCurrentUserCurrentTeamAdmin: (state: GlobalState) => boolean = createSelector(
    'isCurrentUserCurrentTeamAdmin',
    getCurrentTeamMembership,
    (member) => {
        if (member) {
            const roles = member.roles || '';
            return isTeamAdmin(roles);
        }
        return false;
    },
);

export const getCurrentTeamUrl: (state: GlobalState) => string = createSelector(
    'getCurrentTeamUrl',
    getCurrentTeam,
    (state) => getConfig(state).SiteURL as string,
    (currentTeam, siteURL) => {
        if (!currentTeam) {
            return siteURL;
        }

        return `${siteURL}/${currentTeam.name}`;
    },
);

export const getCurrentRelativeTeamUrl: (state: GlobalState) => string = createSelector(
    'getCurrentRelativeTeamUrl',
    getCurrentTeam,
    (currentTeam) => {
        if (!currentTeam) {
            return '/';
        }
        return `/${currentTeam.name}`;
    },
);

export const getCurrentTeamStats: (state: GlobalState) => TeamStats = createSelector(
    'getCurrentTeamStats',
    getCurrentTeamId,
    getTeamStats,
    (currentTeamId, teamStats) => {
        return teamStats[currentTeamId];
    },
);

export const getMyTeams: (state: GlobalState) => Team[] = createSelector(
    'getMyTeams',
    getTeams,
    getTeamMemberships,
    (teams, members) => {
        return Object.values(teams).filter((t) => members[t.id] && t.delete_at === 0);
    },
);

export const getMyDeletedTeams: (state: GlobalState) => Team[] = createSelector(
    'getMyDeletedTeams',
    getTeams,
    getTeamMemberships,
    (teams, members) => {
        return Object.values(teams).filter((t) => members[t.id] && t.delete_at !== 0);
    },
);

export const getMyTeamMember: (state: GlobalState, teamId: string) => TeamMembership = createSelector(
    'getMyTeamMember',
    getTeamMemberships,
    (state: GlobalState, teamId: string) => teamId,
    (teamMemberships, teamId) => {
        return teamMemberships[teamId] || {};
    },
);

export const getMembersInCurrentTeam: (state: GlobalState) => RelationOneToOne<UserProfile, TeamMembership> = createSelector(
    'getMembersInCurrentTeam',
    getCurrentTeamId,
    getMembersInTeams,
    (currentTeamId, teamMembers) => {
        return teamMembers[currentTeamId];
    },
);

export function getTeamMember(state: GlobalState, teamId: string, userId: string): TeamMembership | undefined {
    return getMembersInTeams(state)[teamId]?.[userId];
}

export const getListableTeamIds: (state: GlobalState) => Array<Team['id']> = createIdsSelector(
    'getListableTeamIds',
    getTeams,
    getTeamMemberships,
    (state) => haveISystemPermission(state, {permission: Permissions.LIST_PUBLIC_TEAMS}),
    (state) => haveISystemPermission(state, {permission: Permissions.LIST_PRIVATE_TEAMS}),
    isCompatibleWithJoinViewTeamPermissions,
    (teams, myMembers, canListPublicTeams, canListPrivateTeams, compatibleWithJoinViewTeamPermissions) => {
        return Object.keys(teams).filter((id) => {
            const team = teams[id];
            const member = myMembers[id];
            let canList = team.allow_open_invite;
            if (compatibleWithJoinViewTeamPermissions) {
                canList = (canListPrivateTeams && !team.allow_open_invite) || (canListPublicTeams && team.allow_open_invite);
            }
            return team.delete_at === 0 && canList && !member;
        });
    },
);

export const getListableTeams: (state: GlobalState) => Team[] = createSelector(
    'getListableTeams',
    getTeams,
    getListableTeamIds,
    (teams, listableTeamIds) => {
        return listableTeamIds.map((id) => teams[id]);
    },
);

export const getSortedListableTeams: (state: GlobalState, locale: string) => Team[] = createSelector(
    'getSortedListableTeams',
    getTeams,
    getListableTeamIds,
    (state: GlobalState, locale: string) => locale,
    (teams, listableTeamIds, locale) => {
        const listableTeams: {[x: string]: Team} = {};

        for (const id of listableTeamIds) {
            listableTeams[id] = teams[id];
        }

        return Object.values(listableTeams).sort(sortTeamsWithLocale(locale));
    },
);

export const getJoinableTeamIds: (state: GlobalState) => Array<Team['id']> = createIdsSelector(
    'getJoinableTeamIds',
    getTeams,
    getTeamMemberships,
    (state: GlobalState) => haveISystemPermission(state, {permission: Permissions.JOIN_PUBLIC_TEAMS}),
    (state: GlobalState) => haveISystemPermission(state, {permission: Permissions.JOIN_PRIVATE_TEAMS}),
    isCompatibleWithJoinViewTeamPermissions,
    (teams, myMembers, canJoinPublicTeams, canJoinPrivateTeams, compatibleWithJoinViewTeamPermissions) => {
        return Object.keys(teams).filter((id) => {
            const team = teams[id];
            const member = myMembers[id];
            let canJoin = team.allow_open_invite;
            if (compatibleWithJoinViewTeamPermissions) {
                canJoin = (canJoinPrivateTeams && !team.allow_open_invite) || (canJoinPublicTeams && team.allow_open_invite);
            }
            return team.delete_at === 0 && canJoin && !member;
        });
    },
);

export const getJoinableTeams: (state: GlobalState) => Team[] = createSelector(
    'getJoinableTeams',
    getTeams,
    getJoinableTeamIds,
    (teams, joinableTeamIds) => {
        return joinableTeamIds.map((id) => teams[id]);
    },
);

export const getSortedJoinableTeams: (state: GlobalState, locale: string) => Team[] = createSelector(
    'getSortedJoinableTeams',
    getTeams,
    getJoinableTeamIds,
    (state: GlobalState, locale: string) => locale,
    (teams, joinableTeamIds, locale) => {
        const joinableTeams: {[x: string]: Team} = {};

        for (const id of joinableTeamIds) {
            joinableTeams[id] = teams[id];
        }

        return Object.values(joinableTeams).sort(sortTeamsWithLocale(locale));
    },
);

export const getMySortedTeamIds: (state: GlobalState, locale: string) => Array<Team['id']> = createIdsSelector(
    'getMySortedTeamIds',
    getMyTeams,
    (state: GlobalState, locale: string) => locale,
    (teams, locale) => {
        return teams.sort(sortTeamsWithLocale(locale)).map((t) => t.id);
    },
);

export function getMyTeamsCount(state: GlobalState) {
    return getMyTeams(state).length;
}

// returns the badge number to show (excluding the current team)
// > 0 means is returning the mention count
// 0 means that there are no unread messages
// -1 means that there are unread messages but no mentions
export const getChannelDrawerBadgeCount: (state: GlobalState) => number = createSelector(
    'getChannelDrawerBadgeCount',
    getCurrentTeamId,
    getTeamMemberships,
    isCollapsedThreadsEnabled,
    (currentTeamId, teamMembers, collapsed) => {
        let mentionCount = 0;
        let messageCount = 0;
        Object.values(teamMembers).forEach((m: TeamMembership) => {
            if (m.team_id !== currentTeamId) {
                mentionCount += collapsed ? (m.mention_count_root || 0) : (m.mention_count || 0);
                messageCount += collapsed ? (m.msg_count_root || 0) : (m.msg_count || 0);
            }
        });

        let badgeCount = 0;
        if (mentionCount) {
            badgeCount = mentionCount;
        } else if (messageCount) {
            badgeCount = -1;
        }

        return badgeCount;
    },
);

export const isTeamSameWithCurrentTeam = (state: GlobalState, teamName: string): boolean => {
    const targetTeam = getTeamByName(state, teamName);
    const currentTeam = getCurrentTeam(state);

    return Boolean(targetTeam && targetTeam.id === currentTeam.id);
};

// returns the badge for a team
// > 0 means is returning the mention count
// 0 means that there are no unread messages
// -1 means that there are unread messages but no mentions
export function makeGetBadgeCountForTeamId(): (state: GlobalState, id: string) => number {
    return createSelector(
        'makeGetBadgeCountForTeamId',
        getTeamMemberships,
        (state: GlobalState, id: string) => id,
        isCollapsedThreadsEnabled,
        (members, teamId, collapsed) => {
            const member = members[teamId];
            let badgeCount = 0;

            if (member) {
                const mentionCount = collapsed ? member.mention_count_root : member.mention_count;
                const msgCount = collapsed ? member.msg_count_root : member.msg_count;
                if (mentionCount) {
                    badgeCount = mentionCount;
                } else if (msgCount) {
                    badgeCount = -1;
                }
            }

            return badgeCount;
        },
    );
}

export function searchTeamsInPolicy(teams: Team[], term: string): Team[] {
    return filterTeamsStartingWithTerm(teams, term);
}
