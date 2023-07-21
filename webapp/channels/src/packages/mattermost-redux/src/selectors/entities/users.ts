// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Channel, ChannelMembership} from '@mattermost/types/channels';
import {Group} from '@mattermost/types/groups';
import {Reaction} from '@mattermost/types/reactions';
import {GlobalState} from '@mattermost/types/store';
import {Team, TeamMembership} from '@mattermost/types/teams';
import {UserProfile} from '@mattermost/types/users';
import {
    IDMappedObjects,
    RelationOneToMany,
    RelationOneToManyUnique,
    RelationOneToOne,
} from '@mattermost/types/utilities';

import {General} from 'mattermost-redux/constants';
import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {
    getCurrentChannelId,
    getCurrentUser,
    getCurrentUserId,
    getMyCurrentChannelMembership,
    getUsers,
    getMembersInTeam,
    getMembersInChannel,
} from 'mattermost-redux/selectors/entities/common';
import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';
import {getDirectShowPreferences, getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {
    displayUsername,
    filterProfilesStartingWithTerm,
    filterProfilesMatchingWithTerm,
    isSystemAdmin,
    includesAnAdminRole,
    profileListToMap,
    sortByUsername,
    isGuest,
    applyRolesFilters,
} from 'mattermost-redux/utils/user_utils';

export {getCurrentUser, getCurrentUserId, getUsers};

type Filters = {
    role?: string;
    inactive?: boolean;
    active?: boolean;
    roles?: string[];
    exclude_roles?: string[];
    channel_roles?: string[];
    team_roles?: string[];
};

export function getUserIdsInChannels(state: GlobalState): RelationOneToManyUnique<Channel, UserProfile> {
    return state.entities.users.profilesInChannel;
}

export function getUserIdsNotInChannels(state: GlobalState): RelationOneToManyUnique<Channel, UserProfile> {
    return state.entities.users.profilesNotInChannel;
}

export function getUserIdsInTeams(state: GlobalState): RelationOneToMany<Team, UserProfile> {
    return state.entities.users.profilesInTeam;
}

export function getUserIdsNotInTeams(state: GlobalState): RelationOneToMany<Team, UserProfile> {
    return state.entities.users.profilesNotInTeam;
}

export function getUserIdsWithoutTeam(state: GlobalState): Set<UserProfile['id']> {
    return state.entities.users.profilesWithoutTeam;
}

export function getUserIdsInGroups(state: GlobalState): RelationOneToMany<Group, UserProfile> {
    return state.entities.users.profilesInGroup;
}

export function getUserIdsNotInGroups(state: GlobalState): RelationOneToMany<Group, UserProfile> {
    return state.entities.users.profilesNotInGroup;
}

export function getUserStatuses(state: GlobalState): RelationOneToOne<UserProfile, string> {
    return state.entities.users.statuses;
}

export function getUserSessions(state: GlobalState): any[] {
    return state.entities.users.mySessions;
}

export function getUserAudits(state: GlobalState): any[] {
    return state.entities.users.myAudits;
}

export function getUser(state: GlobalState, id: UserProfile['id']): UserProfile {
    return state.entities.users.profiles[id];
}

export const getUsersByUsername: (a: GlobalState) => Record<string, UserProfile> = createSelector(
    'getUsersByUsername',
    getUsers,
    (users) => {
        const usersByUsername: Record<string, UserProfile> = {};

        for (const id in users) {
            if (users.hasOwnProperty(id)) {
                const user = users[id];
                usersByUsername[user.username] = user;
            }
        }

        return usersByUsername;
    },
);

export function getUserByUsername(state: GlobalState, username: UserProfile['username']): UserProfile {
    return getUsersByUsername(state)[username];
}

export const getUsersByEmail: (a: GlobalState) => Record<string, UserProfile> = createSelector(
    'getUsersByEmail',
    getUsers,
    (users) => {
        const usersByEmail: Record<string, UserProfile> = {};

        for (const user of Object.keys(users).map((key) => users[key])) {
            usersByEmail[user.email] = user;
        }

        return usersByEmail;
    },
);

export function getUserByEmail(state: GlobalState, email: UserProfile['email']): UserProfile {
    return getUsersByEmail(state)[email];
}

export const isCurrentUserSystemAdmin: (state: GlobalState) => boolean = createSelector(
    'isCurrentUserSystemAdmin',
    getCurrentUser,
    (user) => {
        const roles = user?.roles || '';
        return isSystemAdmin(roles);
    },
);

export const isCurrentUserGuestUser: (state: GlobalState) => boolean = createSelector(
    'isCurrentUserGuestUser',
    getCurrentUser,
    (user) => {
        const roles = user?.roles || '';
        return isGuest(roles);
    },
);

export const currentUserHasAnAdminRole: (state: GlobalState) => boolean = createSelector(
    'currentUserHasAnAdminRole',
    getCurrentUser,
    (user) => {
        const roles = user.roles || '';
        return includesAnAdminRole(roles);
    },
);

export const getCurrentUserRoles: (a: GlobalState) => UserProfile['roles'] = createSelector(
    'getCurrentUserRoles',
    getMyCurrentChannelMembership,
    (state) => state.entities.teams.myMembers[state.entities.teams.currentTeamId],
    getCurrentUser,
    (currentChannelMembership, currentTeamMembership, currentUser) => {
        let roles = '';
        if (currentTeamMembership) {
            roles += `${currentTeamMembership.roles} `;
        }

        if (currentChannelMembership) {
            roles += `${currentChannelMembership.roles} `;
        }

        if (currentUser) {
            roles += currentUser.roles;
        }
        return roles.trim();
    },
);

export type UserMentionKey = {
    key: string;
    caseSensitive?: boolean;
}

export const getCurrentUserMentionKeys: (state: GlobalState) => UserMentionKey[] = createSelector(
    'getCurrentUserMentionKeys',
    getCurrentUser,
    (user: UserProfile) => {
        let keys: UserMentionKey[] = [];

        if (!user || !user.notify_props) {
            return keys;
        }

        if (user.notify_props.mention_keys) {
            keys = keys.concat(user.notify_props.mention_keys.split(',').map((key) => {
                return {key};
            }));
        }

        if (user.notify_props.first_name === 'true' && user.first_name) {
            keys.push({key: user.first_name, caseSensitive: true});
        }

        if (user.notify_props.channel === 'true') {
            keys.push({key: '@channel'});
            keys.push({key: '@all'});
            keys.push({key: '@here'});
        }

        const usernameKey = '@' + user.username;
        if (keys.findIndex((key) => key.key === usernameKey) === -1) {
            keys.push({key: usernameKey});
        }

        return keys;
    },
);

export const getProfileSetInCurrentChannel: (state: GlobalState) => Set<UserProfile['id']> = createSelector(
    'getProfileSetInCurrentChannel',
    getCurrentChannelId,
    getUserIdsInChannels,
    (currentChannel, channelProfiles) => {
        return channelProfiles[currentChannel];
    },
);

export const getProfileSetNotInCurrentChannel: (state: GlobalState) => Set<UserProfile['id']> = createSelector(
    'getProfileSetNotInCurrentChannel',
    getCurrentChannelId,
    getUserIdsNotInChannels,
    (currentChannel, channelProfiles) => {
        return channelProfiles[currentChannel];
    },
);

export const getProfileSetInCurrentTeam: (state: GlobalState) => Array<UserProfile['id']> = createSelector(
    'getProfileSetInCurrentTeam',
    (state) => state.entities.teams.currentTeamId,
    getUserIdsInTeams,
    (currentTeam, teamProfiles) => {
        return teamProfiles[currentTeam];
    },
);

export const getProfileSetNotInCurrentTeam: (state: GlobalState) => Array<UserProfile['id']> = createSelector(
    'getProfileSetNotInCurrentTeam',
    (state) => state.entities.teams.currentTeamId,
    getUserIdsNotInTeams,
    (currentTeam, teamProfiles) => {
        return teamProfiles[currentTeam];
    },
);

const PROFILE_SET_ALL = 'all';
function sortAndInjectProfiles(profiles: IDMappedObjects<UserProfile>, profileSet?: 'all' | Array<UserProfile['id']> | Set<UserProfile['id']>): UserProfile[] {
    const currentProfiles = injectProfiles(profiles, profileSet);
    return currentProfiles.sort(sortByUsername);
}

function injectProfiles(profiles: IDMappedObjects<UserProfile>, profileSet?: 'all' | Array<UserProfile['id']> | Set<UserProfile['id']>): UserProfile[] {
    let currentProfiles: UserProfile[] = [];

    if (typeof profileSet === 'undefined') {
        return currentProfiles;
    } else if (profileSet === PROFILE_SET_ALL) {
        currentProfiles = Object.keys(profiles).map((key) => profiles[key]);
    } else {
        currentProfiles = Array.from(profileSet).map((p) => profiles[p]);
    }

    return currentProfiles.filter((profile) => Boolean(profile));
}

export const getProfiles: (state: GlobalState, filters?: Filters) => UserProfile[] = createSelector(
    'getProfiles',
    getUsers,
    (state: GlobalState, filters?: Filters) => filters,
    (profiles, filters) => {
        return sortAndInjectProfiles(filterProfiles(profiles, filters), PROFILE_SET_ALL);
    },
);

export function filterProfiles(profiles: IDMappedObjects<UserProfile>, filters?: Filters, memberships?: RelationOneToOne<UserProfile, TeamMembership> | RelationOneToOne<UserProfile, ChannelMembership>): IDMappedObjects<UserProfile> {
    if (!filters) {
        return profiles;
    }

    let users = Object.keys(profiles).map((key) => profiles[key]);

    const filterRole = (filters.role && filters.role !== '') ? [filters.role] : [];
    const filterRoles = [...filterRole, ...(filters.roles || []), ...(filters.team_roles || []), ...(filters.channel_roles || [])];
    const excludeRoles = filters.exclude_roles || [];
    if (filterRoles.length > 0 || excludeRoles.length > 0) {
        users = users.filter((user) => {
            return user.roles.length > 0 && applyRolesFilters(user, filterRoles, excludeRoles, memberships?.[user.id]);
        });
    }

    if (filters.inactive) {
        users = users.filter((user) => user.delete_at !== 0);
    } else if (filters.active) {
        users = users.filter((user) => user.delete_at === 0);
    }

    return users.reduce((acc, user) => {
        acc[user.id] = user;
        return acc;
    }, {} as IDMappedObjects<UserProfile>);
}

export function getIsManualStatusForUserId(state: GlobalState, userId: UserProfile['id']): boolean {
    return state.entities.users.isManualStatus[userId];
}

export const getProfilesInCurrentChannel: (state: GlobalState) => UserProfile[] = createSelector(
    'getProfilesInCurrentChannel',
    getUsers,
    getProfileSetInCurrentChannel,
    (profiles, currentChannelProfileSet) => {
        return sortAndInjectProfiles(profiles, currentChannelProfileSet);
    },
);

export const getActiveProfilesInCurrentChannel: (state: GlobalState) => UserProfile[] = createSelector(
    'getProfilesInCurrentChannel',
    getUsers,
    getProfileSetInCurrentChannel,
    (profiles, currentChannelProfileSet) => {
        return sortAndInjectProfiles(profiles, currentChannelProfileSet).filter((user) => user.delete_at === 0);
    },
);

export const getActiveProfilesInCurrentChannelWithoutSorting: (state: GlobalState) => UserProfile[] = createSelector(
    'getProfilesInCurrentChannel',
    getUsers,
    getProfileSetInCurrentChannel,
    (profiles, currentChannelProfileSet) => {
        return injectProfiles(profiles, currentChannelProfileSet).filter((user) => user.delete_at === 0);
    },
);

export const getProfilesNotInCurrentChannel: (state: GlobalState) => UserProfile[] = createSelector(
    'getProfilesNotInCurrentChannel',
    getUsers,
    getProfileSetNotInCurrentChannel,
    (profiles, notInCurrentChannelProfileSet) => {
        return sortAndInjectProfiles(profiles, notInCurrentChannelProfileSet);
    },
);

export const getProfilesInCurrentTeam: (state: GlobalState) => UserProfile[] = createSelector(
    'getProfilesInCurrentTeam',
    getUsers,
    getProfileSetInCurrentTeam,
    (profiles, currentTeamProfileSet) => {
        return sortAndInjectProfiles(profiles, currentTeamProfileSet);
    },
);

export const getProfilesInTeam: (state: GlobalState, teamId: Team['id'], filters?: Filters) => UserProfile[] = createSelector(
    'getProfilesInTeam',
    getUsers,
    getUserIdsInTeams,
    getMembersInTeam,
    (state: GlobalState, teamId: string) => teamId,
    (state: GlobalState, teamId: string, filters: Filters) => filters,
    (profiles, usersInTeams, memberships, teamId, filters) => {
        return sortAndInjectProfiles(filterProfiles(profiles, filters, memberships), usersInTeams[teamId] || new Set());
    },
);

export const getProfilesNotInTeam: (state: GlobalState, teamId: Team['id'], filters?: Filters) => UserProfile[] = createSelector(
    'getProfilesNotInTeam',
    getUsers,
    getUserIdsNotInTeams,
    (state: GlobalState, teamId: string) => teamId,
    (state: GlobalState, teamId: string, filters: Filters) => filters,
    (profiles, usersNotInTeams, teamId, filters) => {
        return sortAndInjectProfiles(filterProfiles(profiles, filters), usersNotInTeams[teamId] || new Set());
    },
);

export const getProfilesNotInCurrentTeam: (state: GlobalState) => UserProfile[] = createSelector(
    'getProfilesNotInCurrentTeam',
    getUsers,
    getProfileSetNotInCurrentTeam,
    (profiles, notInCurrentTeamProfileSet) => {
        return sortAndInjectProfiles(profiles, notInCurrentTeamProfileSet);
    },
);

export const getProfilesWithoutTeam: (state: GlobalState, filters: Filters) => UserProfile[] = createSelector(
    'getProfilesWithoutTeam',
    getUsers,
    getUserIdsWithoutTeam,
    (state: GlobalState, filters: Filters) => filters,
    (profiles, withoutTeamProfileSet, filters) => {
        return sortAndInjectProfiles(filterProfiles(profiles, filters), withoutTeamProfileSet);
    },
);

export function getStatusForUserId(state: GlobalState, userId: UserProfile['id']): string {
    return getUserStatuses(state)[userId];
}

export function getTotalUsersStats(state: GlobalState): any {
    return state.entities.users.stats;
}

export function getFilteredUsersStats(state: GlobalState): any {
    return state.entities.users.filteredStats;
}

function filterFromProfiles(currentUserId: UserProfile['id'], profiles: UserProfile[], skipCurrent = false, filters?: Filters): UserProfile[] {
    const filteredProfilesMap = filterProfiles(profileListToMap(profiles), filters);
    const filteredProfiles = Object.keys(filteredProfilesMap).map((key) => filteredProfilesMap[key]);

    if (skipCurrent) {
        removeCurrentUserFromList(filteredProfiles, currentUserId);
    }

    return filteredProfiles;
}

export function makeSearchProfilesStartingWithTerm(): (state: GlobalState, term: string, skipCurrent?: boolean, filters?: Filters) => UserProfile[] {
    return createSelector(
        'makeSearchProfilesStartingWithTerm',
        getUsers,
        getCurrentUserId,
        (state: GlobalState, term: string) => term,
        (state: GlobalState, term: string, skipCurrent?: boolean) => skipCurrent || false,
        (stateGlobalState, term: string, skipCurrent?: boolean, filters?: Filters) => filters,
        (users, currentUserId, term, skipCurrent, filters) => {
            const profiles = filterProfilesMatchingWithTerm(Object.values(users), term);
            return filterFromProfiles(currentUserId, profiles, skipCurrent, filters);
        },
    );
}

export function makeSearchProfilesMatchingWithTerm(): (state: GlobalState, term: string, skipCurrent?: boolean, filters?: Filters) => UserProfile[] {
    return createSelector(
        'makeSearchProfilesMatchingWithTerm',
        getUsers,
        getCurrentUserId,
        (state: GlobalState, term: string) => term,
        (state: GlobalState, term: string, skipCurrent?: boolean) => skipCurrent || false,
        (stateGlobalState, term: string, skipCurrent?: boolean, filters?: Filters) => filters,
        (users, currentUserId, term, skipCurrent, filters) => {
            const profiles = filterProfilesMatchingWithTerm(Object.values(users), term);
            return filterFromProfiles(currentUserId, profiles, skipCurrent, filters);
        },
    );
}

export function makeSearchProfilesInChannel() {
    const doGetProfilesInChannel = makeGetProfilesInChannel();
    return (state: GlobalState, channelId: Channel['id'], term: string, skipCurrent = false, filters?: Filters): UserProfile[] => {
        const profiles = filterProfilesStartingWithTerm(doGetProfilesInChannel(state, channelId, filters), term);

        if (skipCurrent) {
            removeCurrentUserFromList(profiles, getCurrentUserId(state));
        }

        return profiles;
    };
}

export function searchProfilesInCurrentChannel(state: GlobalState, term: string, skipCurrent = false): UserProfile[] {
    const profiles = filterProfilesStartingWithTerm(getProfilesInCurrentChannel(state), term);

    if (skipCurrent) {
        removeCurrentUserFromList(profiles, getCurrentUserId(state));
    }

    return profiles;
}

export function searchActiveProfilesInCurrentChannel(state: GlobalState, term: string, skipCurrent = false): UserProfile[] {
    return searchProfilesInCurrentChannel(state, term, skipCurrent).filter((user) => user.delete_at === 0);
}

export function searchProfilesNotInCurrentChannel(state: GlobalState, term: string, skipCurrent = false): UserProfile[] {
    const profiles = filterProfilesStartingWithTerm(getProfilesNotInCurrentChannel(state), term);
    if (skipCurrent) {
        removeCurrentUserFromList(profiles, getCurrentUserId(state));
    }

    return profiles;
}

export function searchProfilesInCurrentTeam(state: GlobalState, term: string, skipCurrent = false): UserProfile[] {
    const profiles = filterProfilesStartingWithTerm(getProfilesInCurrentTeam(state), term);
    if (skipCurrent) {
        removeCurrentUserFromList(profiles, getCurrentUserId(state));
    }

    return profiles;
}

export function searchProfilesInTeam(state: GlobalState, teamId: Team['id'], term: string, skipCurrent = false, filters?: Filters): UserProfile[] {
    const profiles = filterProfilesMatchingWithTerm(getProfilesInTeam(state, teamId, filters), term);
    if (skipCurrent) {
        removeCurrentUserFromList(profiles, getCurrentUserId(state));
    }

    return profiles;
}

export function searchProfilesNotInCurrentTeam(state: GlobalState, term: string, skipCurrent = false): UserProfile[] {
    const profiles = filterProfilesStartingWithTerm(getProfilesNotInCurrentTeam(state), term);
    if (skipCurrent) {
        removeCurrentUserFromList(profiles, getCurrentUserId(state));
    }

    return profiles;
}

export function searchProfilesWithoutTeam(state: GlobalState, term: string, skipCurrent = false, filters: Filters): UserProfile[] {
    const filteredProfiles = filterProfilesStartingWithTerm(getProfilesWithoutTeam(state, filters), term);
    if (skipCurrent) {
        removeCurrentUserFromList(filteredProfiles, getCurrentUserId(state));
    }

    return filteredProfiles;
}

function removeCurrentUserFromList(profiles: UserProfile[], currentUserId: UserProfile['id']) {
    const index = profiles.findIndex((p) => p.id === currentUserId);
    if (index >= 0) {
        profiles.splice(index, 1);
    }
}

export const shouldShowTermsOfService: (state: GlobalState) => boolean = createSelector(
    'shouldShowTermsOfService',
    getConfig,
    getCurrentUser,
    getLicense,
    (config, user, license) => {
        // Defaults to false if the user is not logged in or the setting doesn't exist
        const acceptedTermsId = user ? user.terms_of_service_id : '';
        const acceptedAt = user ? user.terms_of_service_create_at : 0;

        const featureEnabled = license.IsLicensed === 'true' && config.EnableCustomTermsOfService === 'true';
        const reacceptanceTime = parseInt(config.CustomTermsOfServiceReAcceptancePeriod!, 10) * 1000 * 60 * 60 * 24;
        const timeElapsed = new Date().getTime() - acceptedAt;
        return Boolean(user && featureEnabled && (config.CustomTermsOfServiceId !== acceptedTermsId || timeElapsed > reacceptanceTime));
    },
);

export const getUsersInVisibleDMs: (state: GlobalState) => UserProfile[] = createSelector(
    'getUsersInVisibleDMs',
    getUsers,
    getDirectShowPreferences,
    (users, preferences) => {
        const dmUsers: UserProfile[] = [];
        preferences.forEach((pref) => {
            if (pref.value === 'true' && users[pref.name]) {
                dmUsers.push(users[pref.name]);
            }
        });
        return dmUsers;
    },
);

export function makeGetProfilesForReactions(): (state: GlobalState, reactions: Reaction[]) => UserProfile[] {
    return createSelector(
        'makeGetProfilesForReactions',
        getUsers,
        (state: GlobalState, reactions: Reaction[]) => reactions,
        (users, reactions) => {
            const profiles: UserProfile[] = [];
            reactions.forEach((r) => {
                if (users[r.user_id]) {
                    profiles.push(users[r.user_id]);
                }
            });
            return profiles;
        },
    );
}

/**
 * Returns a selector that returns all profiles in a given channel with the given filters applied.
 *
 * Note that filters, if provided, must be either a constant or memoized to prevent constant recomputation of the selector.
 */
export function makeGetProfilesInChannel(): (state: GlobalState, channelId: Channel['id'], filters?: Filters) => UserProfile[] {
    return createSelector(
        'makeGetProfilesInChannel',
        getUsers,
        getUserIdsInChannels,
        getMembersInChannel,
        (state: GlobalState, channelId: string) => channelId,
        (state, channelId, filters) => filters,
        (users, userIds, membersInChannel, channelId, filters = {}) => {
            const userIdsInChannel = userIds[channelId];

            if (!userIdsInChannel) {
                return [];
            }

            return sortAndInjectProfiles(filterProfiles(users, filters, membersInChannel), userIdsInChannel);
        },
    );
}

/**
 * Returns a selector that returns all profiles not in a given channel.
 */
export function makeGetProfilesNotInChannel(): (state: GlobalState, channelId: Channel['id'], filters?: Filters) => UserProfile[] {
    return createSelector(
        'makeGetProfilesNotInChannel',
        getUsers,
        getUserIdsNotInChannels,
        (state: GlobalState, channelId: string) => channelId,
        (users, userIds, channelId) => {
            const userIdsInChannel = userIds[channelId];

            if (!userIdsInChannel) {
                return [];
            }

            return sortAndInjectProfiles(users, userIdsInChannel);
        },
    );
}

export function makeGetProfilesByIdsAndUsernames(): (
    state: GlobalState,
    props: {
        allUserIds: Array<UserProfile['id']>;
        allUsernames: Array<UserProfile['username']>;
    }
) => UserProfile[] {
    return createSelector(
        'makeGetProfilesByIdsAndUsernames',
        getUsers,
        getUsersByUsername,
        (state: GlobalState, props: {allUserIds: Array<UserProfile['id']>; allUsernames: Array<UserProfile['username']>}) => props.allUserIds,
        (state, props) => props.allUsernames,
        (allProfilesById: Record<string, UserProfile>, allProfilesByUsername: Record<string, UserProfile>, allUserIds: string[], allUsernames: string[]) => {
            const userProfiles: UserProfile[] = [];

            if (allUserIds && allUserIds.length > 0) {
                const profilesById = allUserIds.
                    filter((userId) => allProfilesById[userId]).
                    map((userId) => allProfilesById[userId]);

                if (profilesById && profilesById.length > 0) {
                    userProfiles.push(...profilesById);
                }
            }

            if (allUsernames && allUsernames.length > 0) {
                const profilesByUsername = allUsernames.
                    filter((username) => allProfilesByUsername[username]).
                    map((username) => allProfilesByUsername[username]);

                if (profilesByUsername && profilesByUsername.length > 0) {
                    userProfiles.push(...profilesByUsername);
                }
            }

            return userProfiles;
        },
    );
}

export function makeGetDisplayName(): (state: GlobalState, userId: UserProfile['id'], useFallbackUsername?: boolean) => string {
    return createSelector(
        'makeGetDisplayName',
        (state: GlobalState, userId: string) => getUser(state, userId),
        getTeammateNameDisplaySetting,
        (state, userId, useFallbackUsername = true) => useFallbackUsername,
        (user, teammateNameDisplaySetting, useFallbackUsername) => {
            return displayUsername(user, teammateNameDisplaySetting!, useFallbackUsername);
        },
    );
}

export function makeDisplayNameGetter(): (state: GlobalState, useFallbackUsername: boolean) => (user: UserProfile | null | undefined) => string {
    return createSelector(
        'makeDisplayNameGetter',
        getTeammateNameDisplaySetting,
        (_, useFallbackUsername = true) => useFallbackUsername,
        (teammateNameDisplaySetting, useFallbackUsername) => {
            return (user: UserProfile | null | undefined) => displayUsername(user, teammateNameDisplaySetting!, useFallbackUsername);
        },
    );
}

export const getProfilesInGroup: (state: GlobalState, groupId: Group['id'], filters?: Filters) => UserProfile[] = createSelector(
    'getProfilesInGroup',
    getUsers,
    getUserIdsInGroups,
    (state: GlobalState, groupId: string) => groupId,
    (state: GlobalState, groupId: string, filters: Filters) => filters,
    (profiles, usersInGroups, groupId, filters) => {
        return sortAndInjectProfiles(filterProfiles(profiles, filters), usersInGroups[groupId] || new Set());
    },
);

export const getProfilesInGroupWithoutSorting: (state: GlobalState, groupId: Group['id'], filters?: Filters) => UserProfile[] = createSelector(
    'getProfilesInGroup',
    getUsers,
    getUserIdsInGroups,
    (state: GlobalState, groupId: string) => groupId,
    (state: GlobalState, groupId: string, filters: Filters) => filters,
    (profiles, usersInGroups, groupId, filters) => {
        return injectProfiles(filterProfiles(profiles, filters), usersInGroups[groupId] || new Set());
    },
);

export const getProfilesNotInCurrentGroup: (state: GlobalState, groupId: Group['id'], filters?: Filters) => UserProfile[] = createSelector(
    'getProfilesNotInGroup',
    getUsers,
    getUserIdsNotInGroups,
    (state: GlobalState, groupId: string) => groupId,
    (state: GlobalState, groupId: string, filters: Filters) => filters,
    (profiles, usersNotInGroups, groupId, filters) => {
        return sortAndInjectProfiles(filterProfiles(profiles, filters), usersNotInGroups[groupId] || new Set());
    },
);

export function searchProfilesInGroup(state: GlobalState, groupId: Group['id'], term: string, skipCurrent = false, filters?: Filters): UserProfile[] {
    const profiles = filterProfilesStartingWithTerm(getProfilesInGroup(state, groupId, filters), term);
    if (skipCurrent) {
        removeCurrentUserFromList(profiles, getCurrentUserId(state));
    }

    return profiles;
}

export function searchProfilesInGroupWithoutSorting(state: GlobalState, groupId: Group['id'], term: string, skipCurrent = false, filters?: Filters): UserProfile[] {
    const profiles = filterProfilesStartingWithTerm(getProfilesInGroupWithoutSorting(state, groupId, filters), term);
    if (skipCurrent) {
        removeCurrentUserFromList(profiles, getCurrentUserId(state));
    }

    return profiles;
}

export function getUserLastActivities(state: GlobalState): RelationOneToOne<UserProfile, number> {
    return state.entities.users.lastActivity;
}

export function getLastActivityForUserId(state: GlobalState, userId: UserProfile['id']): number {
    return getUserLastActivities(state)[userId];
}

export function checkIsFirstAdmin(currentUser: UserProfile, users: IDMappedObjects<UserProfile>): boolean {
    if (!currentUser) {
        return false;
    }
    if (!currentUser.roles.includes('system_admin')) {
        return false;
    }
    for (const user of Object.values(users)) {
        if (user.roles.includes('system_admin') && user.create_at < currentUser.create_at) {
            // If the user in the list is an admin with create_at less than our user, than that user is older than the current one, so it can't be the first admin.
            return false;
        }
    }
    return true;
}

export const isFirstAdmin = createSelector(
    'isFirstAdmin',
    (state: GlobalState) => getCurrentUser(state),
    (state: GlobalState) => getUsers(state),
    checkIsFirstAdmin,
);

export const displayLastActiveLabel: (state: GlobalState, userId: string) => boolean = createSelector(
    'displayLastActiveLabel',
    (state: GlobalState, userId: string) => getStatusForUserId(state, userId),
    (state: GlobalState, userId: string) => getLastActivityForUserId(state, userId),
    (state: GlobalState, userId: string) => getUser(state, userId),
    getConfig,
    (userStatus, timestamp, user, config) => {
        const currentTime = new Date();
        const oneMin = 60 * 1000;

        if (
            (!userStatus || userStatus === General.ONLINE) ||
            (timestamp && (currentTime.valueOf() - new Date(timestamp).valueOf()) <= oneMin) ||
            user?.props?.show_last_active === 'false' ||
            user?.is_bot ||
            timestamp === 0 ||
            config.EnableLastActiveTime !== 'true'
        ) {
            return false;
        }
        return true;
    },
);

export const getLastActiveTimestampUnits: (state: GlobalState, userId: string) => string[] = createSelector(
    'getLastActiveTimestampUnits',
    (state: GlobalState, userId: string) => getLastActivityForUserId(state, userId),
    (timestamp) => {
        const timestampUnits = [
            'now',
            'minute',
            'hour',
        ];
        const currentTime = new Date();
        const twoDaysAgo = 48 * 60 * 60 * 1000;
        if ((currentTime.valueOf() - new Date(timestamp).valueOf()) < twoDaysAgo) {
            timestampUnits.push('day');
        }
        return timestampUnits;
    },
);
