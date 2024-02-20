// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';
import {batchActions} from 'redux-batched-actions';

import type {UserAutocomplete} from '@mattermost/types/autocomplete';
import type {ServerError} from '@mattermost/types/errors';
import type {UserProfile, UserStatus, GetFilteredUsersStatsOpts, UsersStats, UserCustomStatus, UserAccessToken} from '@mattermost/types/users';

import {UserTypes, AdminTypes} from 'mattermost-redux/action_types';
import {logError} from 'mattermost-redux/actions/errors';
import {setServerVersion, getClientConfig, getLicenseConfig} from 'mattermost-redux/actions/general';
import {bindClientFunc, forceLogoutIfNecessary, debounce} from 'mattermost-redux/actions/helpers';
import {getUsersLimits} from 'mattermost-redux/actions/limits';
import {getMyPreferences} from 'mattermost-redux/actions/preferences';
import {loadRolesIfNeeded} from 'mattermost-redux/actions/roles';
import {getMyTeams, getMyTeamMembers, getMyTeamUnreads} from 'mattermost-redux/actions/teams';
import {Client4} from 'mattermost-redux/client';
import {General} from 'mattermost-redux/constants';
import {getIsUserStatusesConfigEnabled} from 'mattermost-redux/selectors/entities/common';
import {getServerVersion} from 'mattermost-redux/selectors/entities/general';
import {isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUserId, getUsers} from 'mattermost-redux/selectors/entities/users';
import type {DispatchFunc, ActionFuncAsync} from 'mattermost-redux/types/actions';
import {isMinimumServerVersion} from 'mattermost-redux/utils/helpers';

export function generateMfaSecret(userId: string) {
    return bindClientFunc({
        clientFunc: Client4.generateMfaSecret,
        params: [
            userId,
        ],
    });
}

export function createUser(user: UserProfile, token: string, inviteId: string, redirect: string): ActionFuncAsync<UserProfile> {
    return async (dispatch, getState) => {
        let created;

        try {
            created = await Client4.createUser(user, token, inviteId, redirect);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        const profiles: {
            [userId: string]: UserProfile;
        } = {
            [created.id]: created,
        };
        dispatch({type: UserTypes.RECEIVED_PROFILES, data: profiles});

        return {data: created};
    };
}

export function loadMe(): ActionFuncAsync<boolean> {
    return async (dispatch, getState) => {
        // Sometimes the server version is set in one or the other
        const serverVersion = getState().entities.general.serverVersion || Client4.getServerVersion();
        dispatch(setServerVersion(serverVersion));

        try {
            await Promise.all([
                dispatch(getClientConfig()),
                dispatch(getLicenseConfig()),
                dispatch(getMe()),
                dispatch(getMyPreferences()),
                dispatch(getMyTeams()),
                dispatch(getMyTeamMembers()),
            ]);

            const isCollapsedThreads = isCollapsedThreadsEnabled(getState());
            await dispatch(getMyTeamUnreads(isCollapsedThreads));

            await dispatch(getUsersLimits());
        } catch (error) {
            dispatch(logError(error as ServerError));
            return {error: error as ServerError};
        }

        return {data: true};
    };
}

export function logout(): ActionFuncAsync {
    return async (dispatch) => {
        dispatch({type: UserTypes.LOGOUT_REQUEST, data: null});

        try {
            await Client4.logout();
        } catch (error) {
            // nothing to do here
        }

        dispatch({type: UserTypes.LOGOUT_SUCCESS, data: null});

        return {data: true};
    };
}

export function getTotalUsersStats() {
    return bindClientFunc({
        clientFunc: Client4.getTotalUsersStats,
        onSuccess: UserTypes.RECEIVED_USER_STATS,
    });
}

export function getFilteredUsersStats(options: GetFilteredUsersStatsOpts = {}, updateGlobalState = true): ActionFuncAsync<UsersStats> {
    return async (dispatch, getState) => {
        let stats: UsersStats;
        try {
            stats = await Client4.getFilteredUsersStats(options);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        if (updateGlobalState) {
            dispatch({
                type: UserTypes.RECEIVED_FILTERED_USER_STATS,
                data: stats,
            });
        }

        return {data: stats};
    };
}

export function getProfiles(page = 0, perPage: number = General.PROFILE_CHUNK_SIZE, options: any = {}): ActionFuncAsync<UserProfile[]> {
    return async (dispatch, getState) => {
        let profiles: UserProfile[];

        try {
            profiles = await Client4.getProfiles(page, perPage, options);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch({
            type: UserTypes.RECEIVED_PROFILES_LIST,
            data: profiles,
        });

        return {data: profiles};
    };
}

export function getMissingProfilesByIds(userIds: string[]): ActionFuncAsync<UserProfile[]> {
    return async (dispatch, getState) => {
        const state = getState();
        const {profiles} = state.entities.users;
        const enabledUserStatuses = getIsUserStatusesConfigEnabled(state);
        const missingIds: string[] = [];
        userIds.forEach((id) => {
            if (!profiles[id]) {
                missingIds.push(id);
            }
        });

        if (missingIds.length > 0) {
            if (enabledUserStatuses) {
                dispatch(getStatusesByIds(missingIds));
            }
            return dispatch(getProfilesByIds(missingIds));
        }

        return {data: []};
    };
}

export function getMissingProfilesByUsernames(usernames: string[]): ActionFuncAsync<UserProfile[]> {
    return async (dispatch, getState) => {
        const {profiles} = getState().entities.users;

        const usernameProfiles = Object.values(profiles).reduce((acc, profile: any) => {
            acc[profile.username] = profile;
            return acc;
        }, {} as Record<string, UserProfile>);
        const missingUsernames: string[] = [];
        usernames.forEach((username) => {
            if (!usernameProfiles[username]) {
                missingUsernames.push(username);
            }
        });

        if (missingUsernames.length > 0) {
            return dispatch(getProfilesByUsernames(missingUsernames));
        }

        return {data: []};
    };
}

export function getProfilesByIds(userIds: string[], options?: any): ActionFuncAsync<UserProfile[]> {
    return async (dispatch, getState) => {
        let profiles: UserProfile[];

        try {
            profiles = await Client4.getProfilesByIds(userIds, options);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch({
            type: UserTypes.RECEIVED_PROFILES_LIST,
            data: profiles,
        });

        return {data: profiles};
    };
}

export function getProfilesByUsernames(usernames: string[]): ActionFuncAsync<UserProfile[]> {
    return async (dispatch, getState) => {
        let profiles;

        try {
            profiles = await Client4.getProfilesByUsernames(usernames);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch({
            type: UserTypes.RECEIVED_PROFILES_LIST,
            data: profiles,
        });

        return {data: profiles};
    };
}

export function getProfilesInTeam(teamId: string, page: number, perPage: number = General.PROFILE_CHUNK_SIZE, sort = '', options: any = {}): ActionFuncAsync<UserProfile[]> {
    return async (dispatch, getState) => {
        let profiles;

        try {
            profiles = await Client4.getProfilesInTeam(teamId, page, perPage, sort, options);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch(batchActions([
            {
                type: UserTypes.RECEIVED_PROFILES_LIST_IN_TEAM,
                data: profiles,
                id: teamId,
            },
            {
                type: UserTypes.RECEIVED_PROFILES_LIST,
                data: profiles,
            },
        ]));

        return {data: profiles};
    };
}

export function getProfilesNotInTeam(teamId: string, groupConstrained: boolean, page: number, perPage: number = General.PROFILE_CHUNK_SIZE): ActionFuncAsync<UserProfile[]> {
    return async (dispatch, getState) => {
        let profiles;
        try {
            profiles = await Client4.getProfilesNotInTeam(teamId, groupConstrained, page, perPage);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        const receivedProfilesListActionType = groupConstrained ? UserTypes.RECEIVED_PROFILES_LIST_NOT_IN_TEAM_AND_REPLACE : UserTypes.RECEIVED_PROFILES_LIST_NOT_IN_TEAM;

        dispatch(batchActions([
            {
                type: receivedProfilesListActionType,
                data: profiles,
                id: teamId,
            },
            {
                type: UserTypes.RECEIVED_PROFILES_LIST,
                data: profiles,
            },
        ]));

        return {data: profiles};
    };
}

export function getProfilesWithoutTeam(page: number, perPage: number = General.PROFILE_CHUNK_SIZE, options: any = {}): ActionFuncAsync<UserProfile[]> {
    return async (dispatch, getState) => {
        let profiles = null;
        try {
            profiles = await Client4.getProfilesWithoutTeam(page, perPage, options);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch(batchActions([
            {
                type: UserTypes.RECEIVED_PROFILES_LIST_WITHOUT_TEAM,
                data: profiles,
            },
            {
                type: UserTypes.RECEIVED_PROFILES_LIST,
                data: profiles,
            },
        ]));

        return {data: profiles};
    };
}

export enum ProfilesInChannelSortBy {
    None = '',
    Admin = 'admin',
}

export function getProfilesInChannel(channelId: string, page: number, perPage: number = General.PROFILE_CHUNK_SIZE, sort = '', options: {active?: boolean} = {}): ActionFuncAsync<UserProfile[]> {
    return async (dispatch, getState) => {
        let profiles;

        try {
            profiles = await Client4.getProfilesInChannel(channelId, page, perPage, sort, options);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch(batchActions([
            {
                type: UserTypes.RECEIVED_PROFILES_LIST_IN_CHANNEL,
                data: profiles,
                id: channelId,
            },
            {
                type: UserTypes.RECEIVED_PROFILES_LIST,
                data: profiles,
            },
        ]));

        return {data: profiles};
    };
}

export function getProfilesInGroupChannels(channelsIds: string[]): ActionFuncAsync {
    return async (dispatch, getState) => {
        let channelProfiles;

        try {
            channelProfiles = await Client4.getProfilesInGroupChannels(channelsIds.slice(0, General.MAX_GROUP_CHANNELS_FOR_PROFILES));
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        const actions: AnyAction[] = [];
        for (const channelId in channelProfiles) {
            if (channelProfiles.hasOwnProperty(channelId)) {
                const profiles = channelProfiles[channelId];

                actions.push(
                    {
                        type: UserTypes.RECEIVED_PROFILES_LIST_IN_CHANNEL,
                        data: profiles,
                        id: channelId,
                    },
                    {
                        type: UserTypes.RECEIVED_PROFILES_LIST,
                        data: profiles,
                    },
                );
            }
        }

        dispatch(batchActions(actions));

        return {data: channelProfiles};
    };
}

export function getProfilesNotInChannel(teamId: string, channelId: string, groupConstrained: boolean, page: number, perPage: number = General.PROFILE_CHUNK_SIZE): ActionFuncAsync<UserProfile[]> {
    return async (dispatch, getState) => {
        let profiles;

        try {
            profiles = await Client4.getProfilesNotInChannel(teamId, channelId, groupConstrained, page, perPage);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        const receivedProfilesListActionType = groupConstrained ? UserTypes.RECEIVED_PROFILES_LIST_NOT_IN_CHANNEL_AND_REPLACE : UserTypes.RECEIVED_PROFILES_LIST_NOT_IN_CHANNEL;

        dispatch(batchActions([
            {
                type: receivedProfilesListActionType,
                data: profiles,
                id: channelId,
            },
            {
                type: UserTypes.RECEIVED_PROFILES_LIST,
                data: profiles,
            },
        ]));

        return {data: profiles};
    };
}

export function getMe(): ActionFuncAsync<UserProfile> {
    return async (dispatch) => {
        const getMeFunc = bindClientFunc({
            clientFunc: Client4.getMe,
            onSuccess: UserTypes.RECEIVED_ME,
        });
        const me = await dispatch(getMeFunc);

        if ('error' in me) {
            return me;
        }
        if ('data' in me) {
            dispatch(loadRolesIfNeeded(me.data!.roles.split(' ')));
        }
        return me;
    };
}

export function updateMyTermsOfServiceStatus(termsOfServiceId: string, accepted: boolean): ActionFuncAsync {
    return async (dispatch, getState) => {
        const response = await dispatch(bindClientFunc({
            clientFunc: Client4.updateMyTermsOfServiceStatus,
            params: [
                termsOfServiceId,
                accepted,
            ],
        }));

        if ('data' in response) {
            if (accepted) {
                dispatch({
                    type: UserTypes.RECEIVED_TERMS_OF_SERVICE_STATUS,
                    data: {
                        terms_of_service_create_at: new Date().getTime(),
                        terms_of_service_id: accepted ? termsOfServiceId : null,
                        user_id: getCurrentUserId(getState()),
                    },
                });
            }

            return {
                data: response.data,
            };
        }

        return {
            error: response.error,
        };
    };
}

export function getProfilesInGroup(groupId: string, page = 0, perPage: number = General.PROFILE_CHUNK_SIZE, sort = ''): ActionFuncAsync<UserProfile[]> {
    return async (dispatch, getState) => {
        let profiles;

        try {
            profiles = await Client4.getProfilesInGroup(groupId, page, perPage, sort);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch(batchActions([
            {
                type: UserTypes.RECEIVED_PROFILES_LIST_IN_GROUP,
                data: profiles,
                id: groupId,
            },
            {
                type: UserTypes.RECEIVED_PROFILES_LIST,
                data: profiles,
            },
        ]));

        return {data: profiles};
    };
}

export function getProfilesNotInGroup(groupId: string, page = 0, perPage: number = General.PROFILE_CHUNK_SIZE): ActionFuncAsync<UserProfile[]> {
    return async (dispatch, getState) => {
        let profiles;

        try {
            profiles = await Client4.getProfilesNotInGroup(groupId, page, perPage);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch(batchActions([
            {
                type: UserTypes.RECEIVED_PROFILES_LIST_NOT_IN_GROUP,
                data: profiles,
                id: groupId,
            },
            {
                type: UserTypes.RECEIVED_PROFILES_LIST,
                data: profiles,
            },
        ]));

        return {data: profiles};
    };
}

export function getTermsOfService() {
    return bindClientFunc({
        clientFunc: Client4.getTermsOfService,
    });
}

export function promoteGuestToUser(userId: string) {
    return bindClientFunc({
        clientFunc: Client4.promoteGuestToUser,
        params: [userId],
    });
}

export function demoteUserToGuest(userId: string) {
    return bindClientFunc({
        clientFunc: Client4.demoteUserToGuest,
        params: [userId],
    });
}

export function createTermsOfService(text: string) {
    return bindClientFunc({
        clientFunc: Client4.createTermsOfService,
        params: [
            text,
        ],
    });
}

export function getUser(id: string) {
    return bindClientFunc({
        clientFunc: Client4.getUser,
        onSuccess: UserTypes.RECEIVED_PROFILE,
        params: [
            id,
        ],
    });
}

export function getUserByUsername(username: string) {
    return bindClientFunc({
        clientFunc: Client4.getUserByUsername,
        onSuccess: UserTypes.RECEIVED_PROFILE,
        params: [
            username,
        ],
    });
}

export function getUserByEmail(email: string) {
    return bindClientFunc({
        clientFunc: Client4.getUserByEmail,
        onSuccess: UserTypes.RECEIVED_PROFILE,
        params: [
            email,
        ],
    });
}

// We create an array to hold the id's that we want to get a status for. We build our
// debounced function that will get called after a set period of idle time in which
// the array of id's will be passed to the getStatusesByIds with a cb that clears out
// the array. Helps with performance because instead of making 75 different calls for
// statuses, we are only making one call for 75 ids.
// We could maybe clean it up somewhat by storing the array of ids in redux state possbily?
let ids: string[] = [];
const debouncedGetStatusesByIds = debounce(async (dispatch: DispatchFunc) => {
    dispatch(getStatusesByIds([...new Set(ids)]));
}, 20, false, () => {
    ids = [];
});
export function getStatusesByIdsBatchedDebounced(id: string) {
    ids = [...ids, id];
    return debouncedGetStatusesByIds;
}

export function getStatusesByIds(userIds: string[]) {
    return bindClientFunc({
        clientFunc: Client4.getStatusesByIds,
        onSuccess: UserTypes.RECEIVED_STATUSES,
        params: [
            userIds,
        ],
    });
}

export function getStatus(userId: string) {
    return bindClientFunc({
        clientFunc: Client4.getStatus,
        onSuccess: UserTypes.RECEIVED_STATUS,
        params: [
            userId,
        ],
    });
}

export function setStatus(status: UserStatus): ActionFuncAsync {
    return async (dispatch, getState) => {
        try {
            await Client4.updateStatus(status);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch({
            type: UserTypes.RECEIVED_STATUS,
            data: status,
        });

        return {data: status};
    };
}

export function setCustomStatus(customStatus: UserCustomStatus) {
    return bindClientFunc({
        clientFunc: Client4.updateCustomStatus,
        params: [
            customStatus,
        ],
    });
}

export function unsetCustomStatus() {
    return bindClientFunc({
        clientFunc: Client4.unsetCustomStatus,
    });
}

export function removeRecentCustomStatus(customStatus: UserCustomStatus) {
    return bindClientFunc({
        clientFunc: Client4.removeRecentCustomStatus,
        params: [
            customStatus,
        ],
    });
}

export function getSessions(userId: string) {
    return bindClientFunc({
        clientFunc: Client4.getSessions,
        onSuccess: UserTypes.RECEIVED_SESSIONS,
        params: [
            userId,
        ],
    });
}

export function revokeSession(userId: string, sessionId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        try {
            await Client4.revokeSession(userId, sessionId);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch({
            type: UserTypes.RECEIVED_REVOKED_SESSION,
            sessionId,
            data: null,
        });

        return {data: true};
    };
}

export function revokeAllSessionsForUser(userId: string): ActionFuncAsync<boolean> {
    return async (dispatch, getState) => {
        try {
            await Client4.revokeAllSessionsForUser(userId);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }
        const data = {isCurrentUser: userId === getCurrentUserId(getState())};
        dispatch(batchActions([
            {
                type: UserTypes.REVOKE_ALL_USER_SESSIONS_SUCCESS,
                data,
            },
        ]));

        return {data: true};
    };
}

export function revokeSessionsForAllUsers(): ActionFuncAsync<boolean> {
    return async (dispatch, getState) => {
        try {
            await Client4.revokeSessionsForAllUsers();
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error: error as ServerError};
        }

        dispatch({
            type: UserTypes.REVOKE_SESSIONS_FOR_ALL_USERS_SUCCESS,
            data: null,
        });

        return {data: true};
    };
}

export function getUserAudits(userId: string, page = 0, perPage: number = General.AUDITS_CHUNK_SIZE) {
    return bindClientFunc({
        clientFunc: Client4.getUserAudits,
        onSuccess: UserTypes.RECEIVED_AUDITS,
        params: [
            userId,
            page,
            perPage,
        ],
    });
}

export function autocompleteUsers(term: string, teamId = '', channelId = '', options?: {
    limit: number;
}): ActionFuncAsync<UserAutocomplete> {
    return async (dispatch, getState) => {
        dispatch({type: UserTypes.AUTOCOMPLETE_USERS_REQUEST, data: null});
        let data;
        try {
            data = await Client4.autocompleteUsers(term, teamId, channelId, options);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch({type: UserTypes.AUTOCOMPLETE_USERS_FAILURE, error});
            dispatch(logError(error));
            return {error};
        }

        let users = [...data.users];
        if (data.out_of_channel) {
            users = [...users, ...data.out_of_channel];
        }
        const actions: AnyAction[] = [{
            type: UserTypes.RECEIVED_PROFILES_LIST,
            data: users,
        }, {
            type: UserTypes.AUTOCOMPLETE_USERS_SUCCESS,
        }];

        if (channelId) {
            actions.push(
                {
                    type: UserTypes.RECEIVED_PROFILES_LIST_IN_CHANNEL,
                    data: data.users,
                    id: channelId,
                },
            );
            actions.push(
                {
                    type: UserTypes.RECEIVED_PROFILES_LIST_NOT_IN_CHANNEL,
                    data: data.out_of_channel || [],
                    id: channelId,
                },
            );
        }

        if (teamId) {
            actions.push(
                {
                    type: UserTypes.RECEIVED_PROFILES_LIST_IN_TEAM,
                    data: users,
                    id: teamId,
                },
            );
        }

        dispatch(batchActions(actions));

        return {data};
    };
}

export function searchProfiles(term: string, options: any = {}): ActionFuncAsync<UserProfile[]> {
    return async (dispatch, getState) => {
        let profiles;
        try {
            profiles = await Client4.searchUsers(term, options);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        const actions: AnyAction[] = [{type: UserTypes.RECEIVED_PROFILES_LIST, data: profiles}];

        if (options.in_channel_id) {
            actions.push({
                type: UserTypes.RECEIVED_PROFILES_LIST_IN_CHANNEL,
                data: profiles,
                id: options.in_channel_id,
            });
        }

        if (options.not_in_channel_id) {
            actions.push({
                type: UserTypes.RECEIVED_PROFILES_LIST_NOT_IN_CHANNEL,
                data: profiles,
                id: options.not_in_channel_id,
            });
        }

        if (options.team_id) {
            actions.push({
                type: UserTypes.RECEIVED_PROFILES_LIST_IN_TEAM,
                data: profiles,
                id: options.team_id,
            });
        }

        if (options.not_in_team_id) {
            actions.push({
                type: UserTypes.RECEIVED_PROFILES_LIST_NOT_IN_TEAM,
                data: profiles,
                id: options.not_in_team_id,
            });
        }

        if (options.in_group_id) {
            actions.push({
                type: UserTypes.RECEIVED_PROFILES_LIST_IN_GROUP,
                data: profiles,
                id: options.in_group_id,
            });
        }

        if (options.not_in_group_id) {
            actions.push({
                type: UserTypes.RECEIVED_PROFILES_LIST_NOT_IN_GROUP,
                data: profiles,
                id: options.not_in_group_id,
            });
        }

        dispatch(batchActions(actions));

        return {data: profiles};
    };
}

export function updateMe(user: Partial<UserProfile>): ActionFuncAsync<UserProfile> {
    return async (dispatch) => {
        dispatch({type: UserTypes.UPDATE_ME_REQUEST, data: null});

        let data;
        try {
            data = await Client4.patchMe(user);
        } catch (error) {
            dispatch({type: UserTypes.UPDATE_ME_FAILURE, error});
            dispatch(logError(error));
            return {error};
        }

        dispatch(batchActions([
            {type: UserTypes.RECEIVED_ME, data},
            {type: UserTypes.UPDATE_ME_SUCCESS},
        ]));
        dispatch(loadRolesIfNeeded(data.roles.split(' ')));

        return {data};
    };
}

export function patchUser(user: UserProfile): ActionFuncAsync<UserProfile> {
    return async (dispatch) => {
        let data: UserProfile;
        try {
            data = await Client4.patchUser(user);
        } catch (error) {
            dispatch(logError(error));
            return {error};
        }

        dispatch({type: UserTypes.RECEIVED_PROFILE, data});

        return {data};
    };
}

export function updateUserRoles(userId: string, roles: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        try {
            await Client4.updateUserRoles(userId, roles);
        } catch (error) {
            return {error};
        }

        const profile = getState().entities.users.profiles[userId];
        if (profile) {
            dispatch({type: UserTypes.RECEIVED_PROFILE, data: {...profile, roles}});
        }

        return {data: true};
    };
}

export function updateUserMfa(userId: string, activate: boolean, code = ''): ActionFuncAsync {
    return async (dispatch, getState) => {
        try {
            await Client4.updateUserMfa(userId, activate, code);
        } catch (error) {
            dispatch(logError(error));
            return {error};
        }

        const profile = getState().entities.users.profiles[userId];
        if (profile) {
            dispatch({type: UserTypes.RECEIVED_PROFILE, data: {...profile, mfa_active: activate}});
        }

        return {data: true};
    };
}

export function updateUserPassword(userId: string, currentPassword: string, newPassword: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        try {
            await Client4.updateUserPassword(userId, currentPassword, newPassword);
        } catch (error) {
            dispatch(logError(error));
            return {error};
        }

        const profile = getState().entities.users.profiles[userId];
        if (profile) {
            dispatch({type: UserTypes.RECEIVED_PROFILE, data: {...profile, last_password_update: new Date().getTime()}});
        }

        return {data: true};
    };
}

export function updateUserActive(userId: string, active: boolean): ActionFuncAsync<true> {
    return async (dispatch, getState) => {
        try {
            await Client4.updateUserActive(userId, active);
        } catch (error) {
            dispatch(logError(error));
            return {error};
        }

        const profile = getState().entities.users.profiles[userId];
        if (profile) {
            const deleteAt = active ? 0 : new Date().getTime();
            dispatch({type: UserTypes.RECEIVED_PROFILE, data: {...profile, delete_at: deleteAt}});
        }

        return {data: true};
    };
}

export function verifyUserEmail(token: string) {
    return bindClientFunc({
        clientFunc: Client4.verifyUserEmail,
        params: [
            token,
        ],
    });
}

export function sendVerificationEmail(email: string) {
    return bindClientFunc({
        clientFunc: Client4.sendVerificationEmail,
        params: [
            email,
        ],
    });
}

export function resetUserPassword(token: string, newPassword: string) {
    return bindClientFunc({
        clientFunc: Client4.resetUserPassword,
        params: [
            token,
            newPassword,
        ],
    });
}

export function sendPasswordResetEmail(email: string) {
    return bindClientFunc({
        clientFunc: Client4.sendPasswordResetEmail,
        params: [
            email,
        ],
    });
}

export function setDefaultProfileImage(userId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        try {
            await Client4.setDefaultProfileImage(userId);
        } catch (error) {
            dispatch(logError(error));
            return {error};
        }

        const profile = getState().entities.users.profiles[userId];
        if (profile) {
            dispatch({type: UserTypes.RECEIVED_PROFILE, data: {...profile, last_picture_update: 0}});
        }

        return {data: true};
    };
}

export function uploadProfileImage(userId: string, imageData: any): ActionFuncAsync {
    return async (dispatch, getState) => {
        try {
            await Client4.uploadProfileImage(userId, imageData);
        } catch (error) {
            return {error};
        }

        const profile = getState().entities.users.profiles[userId];
        if (profile) {
            dispatch({type: UserTypes.RECEIVED_PROFILE, data: {...profile, last_picture_update: new Date().getTime()}});
        }

        return {data: true};
    };
}

export function switchEmailToOAuth(service: string, email: string, password: string, mfaCode = '') {
    return bindClientFunc({
        clientFunc: Client4.switchEmailToOAuth,
        params: [
            service,
            email,
            password,
            mfaCode,
        ],
    });
}

export function switchOAuthToEmail(currentService: string, email: string, password: string) {
    return bindClientFunc({
        clientFunc: Client4.switchOAuthToEmail,
        params: [
            currentService,
            email,
            password,
        ],
    });
}

export function switchEmailToLdap(email: string, emailPassword: string, ldapId: string, ldapPassword: string, mfaCode = '') {
    return bindClientFunc({
        clientFunc: Client4.switchEmailToLdap,
        params: [
            email,
            emailPassword,
            ldapId,
            ldapPassword,
            mfaCode,
        ],
    });
}

export function switchLdapToEmail(ldapPassword: string, email: string, emailPassword: string, mfaCode = '') {
    return bindClientFunc({
        clientFunc: Client4.switchLdapToEmail,
        params: [
            ldapPassword,
            email,
            emailPassword,
            mfaCode,
        ],
    });
}

export function createUserAccessToken(userId: string, description: string): ActionFuncAsync<UserAccessToken> {
    return async (dispatch, getState) => {
        let data;

        try {
            data = await Client4.createUserAccessToken(userId, description);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        const actions: AnyAction[] = [{
            type: AdminTypes.RECEIVED_USER_ACCESS_TOKEN,
            data: {...data,
                token: '',
            },
        }];

        const {currentUserId} = getState().entities.users;
        if (userId === currentUserId) {
            actions.push(
                {
                    type: UserTypes.RECEIVED_MY_USER_ACCESS_TOKEN,
                    data: {...data, token: ''},
                },
            );
        }

        dispatch(batchActions(actions));

        return {data};
    };
}

export function getUserAccessToken(tokenId: string): ActionFuncAsync<UserAccessToken> {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.getUserAccessToken(tokenId);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        const actions: AnyAction[] = [{
            type: AdminTypes.RECEIVED_USER_ACCESS_TOKEN,
            data,
        }];

        const {currentUserId} = getState().entities.users;
        if (data.user_id === currentUserId) {
            actions.push(
                {
                    type: UserTypes.RECEIVED_MY_USER_ACCESS_TOKEN,
                    data,
                },
            );
        }

        dispatch(batchActions(actions));

        return {data};
    };
}

export function getUserAccessTokensForUser(userId: string, page = 0, perPage: number = General.PROFILE_CHUNK_SIZE): ActionFuncAsync<UserAccessToken[]> {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.getUserAccessTokensForUser(userId, page, perPage);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        const actions: AnyAction[] = [{
            type: AdminTypes.RECEIVED_USER_ACCESS_TOKENS_FOR_USER,
            data,
            userId,
        }];

        const {currentUserId} = getState().entities.users;
        if (userId === currentUserId) {
            actions.push(
                {
                    type: UserTypes.RECEIVED_MY_USER_ACCESS_TOKENS,
                    data,
                },
            );
        }

        dispatch(batchActions(actions));

        return {data};
    };
}

export function revokeUserAccessToken(tokenId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        try {
            await Client4.revokeUserAccessToken(tokenId);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch({
            type: UserTypes.REVOKED_USER_ACCESS_TOKEN,
            data: tokenId,
        });

        return {data: true};
    };
}

export function disableUserAccessToken(tokenId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        try {
            await Client4.disableUserAccessToken(tokenId);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch({
            type: UserTypes.DISABLED_USER_ACCESS_TOKEN,
            data: tokenId,
        });

        return {data: true};
    };
}

export function enableUserAccessToken(tokenId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        try {
            await Client4.enableUserAccessToken(tokenId);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch({
            type: UserTypes.ENABLED_USER_ACCESS_TOKEN,
            data: tokenId,
        });

        return {data: true};
    };
}

export function getKnownUsers() {
    return bindClientFunc({
        clientFunc: Client4.getKnownUsers,
    });
}

export function clearUserAccessTokens(): ActionFuncAsync {
    return async (dispatch) => {
        dispatch({type: UserTypes.CLEAR_MY_USER_ACCESS_TOKENS, data: null});
        return {data: true};
    };
}

export function checkForModifiedUsers(): ActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState();
        const users = getUsers(state);
        const lastDisconnectAt = state.websocket.lastDisconnectAt;
        const serverVersion = getServerVersion(state);

        if (!isMinimumServerVersion(serverVersion, 5, 14)) {
            return {data: true};
        }

        await dispatch(getProfilesByIds(Object.keys(users), {since: lastDisconnectAt}));
        return {data: true};
    };
}

export default {
    generateMfaSecret,
    logout,
    getProfiles,
    getProfilesByIds,
    getProfilesInTeam,
    getProfilesInChannel,
    getProfilesNotInChannel,
    getUser,
    getMe,
    getUserByUsername,
    getStatus,
    getStatusesByIds,
    getSessions,
    getTotalUsersStats,
    revokeSession,
    revokeAllSessionsForUser,
    revokeSessionsForAllUsers,
    getUserAudits,
    searchProfiles,
    updateMe,
    updateUserRoles,
    updateUserMfa,
    updateUserPassword,
    updateUserActive,
    verifyUserEmail,
    sendVerificationEmail,
    resetUserPassword,
    sendPasswordResetEmail,
    uploadProfileImage,
    switchEmailToOAuth,
    switchOAuthToEmail,
    switchEmailToLdap,
    switchLdapToEmail,
    getTermsOfService,
    createTermsOfService,
    updateMyTermsOfServiceStatus,
    createUserAccessToken,
    getUserAccessToken,
    getUserAccessTokensForUser,
    revokeUserAccessToken,
    disableUserAccessToken,
    enableUserAccessToken,
    checkForModifiedUsers,
};
