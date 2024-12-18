// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import isEqual from 'lodash/isEqual';
import type {AnyAction} from 'redux';
import {combineReducers} from 'redux';

import type {Team} from '@mattermost/types/teams';
import type {UserProfile, UsersState} from '@mattermost/types/users';
import type {IDMappedObjects, RelationOneToManyUnique, RelationOneToOne} from '@mattermost/types/utilities';

import type {MMReduxAction} from 'mattermost-redux/action_types';
import {UserTypes, ChannelTypes} from 'mattermost-redux/action_types';

function profilesToSet(state: RelationOneToManyUnique<Team, UserProfile>, action: AnyAction) {
    const id = action.id;
    const users: UserProfile[] = Object.values(action.data);

    return users.reduce((nextState, user) => addProfileToSet(nextState, id, user.id), state);
}

function removeProfilesFromSet(state: RelationOneToManyUnique<Team, UserProfile>, action: AnyAction) {
    const id = action.id;
    const users: UserProfile[] = Object.values(action.data);
    return users.reduce((nextState, user) => removeProfileFromSet(nextState, {type: '', data: {id, user_id: user.id}}), state);
}

function profileListToSet(state: RelationOneToManyUnique<Team, UserProfile>, action: AnyAction, replace = false) {
    const id = action.id;
    const users: UserProfile[] = action.data || [];

    if (replace) {
        return {
            ...state,
            [id]: new Set(users.map((user) => user.id)),
        };
    }

    return users.reduce((nextState, user) => addProfileToSet(nextState, id, user.id), state);
}

function removeProfileListFromSet(state: RelationOneToManyUnique<Team, UserProfile>, action: AnyAction) {
    const id = action.id;
    const nextSet = new Set(state[id]);
    if (action.data) {
        action.data.forEach((profile: UserProfile) => {
            nextSet.delete(profile.id);
        });

        return {
            ...state,
            [id]: nextSet,
        };
    }

    return state;
}

function addProfileToSet(state: RelationOneToManyUnique<Team, UserProfile>, id: string, userId: string) {
    const nextSet = new Set(state[id]);
    nextSet.add(userId);
    return {
        ...state,
        [id]: nextSet,
    };
}

function removeProfileFromSets(state: RelationOneToManyUnique<Team, UserProfile>, action: AnyAction) {
    const newState = {...state};
    let removed = false;
    Object.keys(state).forEach((key) => {
        if (newState[key].has(action.data.user_id)) {
            newState[key] = new Set(newState[key]);
            newState[key].delete(action.data.user_id);
            removed = true;
        }
    });
    return removed ? newState : state;
}

function removeProfileFromSet(state: RelationOneToManyUnique<Team, UserProfile>, action: AnyAction) {
    const {id, user_id: userId} = action.data;

    const nextSet = new Set(state[id]);
    nextSet.delete(userId);
    return {
        ...state,
        [id]: nextSet,
    };
}

function currentUserId(state: UsersState['currentUserId'] = '', action: MMReduxAction) {
    switch (action.type) {
    case UserTypes.RECEIVED_ME: {
        const data = action.data;

        return data.id;
    }

    case UserTypes.LOGIN: { // Used by the mobile app
        const {user} = action.data;

        return user ? user.id : state;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return '';
    }

    return state;
}

function mySessions(state: UsersState['mySessions'] = [], action: MMReduxAction) {
    switch (action.type) {
    case UserTypes.RECEIVED_SESSIONS:
        return [...action.data];

    case UserTypes.RECEIVED_REVOKED_SESSION: {
        let index = -1;
        const length = state.length;
        for (let i = 0; i < length; i++) {
            if (state[i].id === action.sessionId) {
                index = i;
                break;
            }
        }
        if (index > -1) {
            return state.slice(0, index).concat(state.slice(index + 1));
        }

        return state;
    }

    case UserTypes.REVOKE_ALL_USER_SESSIONS_SUCCESS:
        if (action.data.isCurrentUser === true) {
            return [];
        }
        return state;

    case UserTypes.REVOKE_SESSIONS_FOR_ALL_USERS_SUCCESS:
        return [];

    case UserTypes.LOGOUT_SUCCESS:
        return [];

    default:
        return state;
    }
}

function myAudits(state: UsersState['myAudits'] = [], action: MMReduxAction) {
    switch (action.type) {
    case UserTypes.RECEIVED_AUDITS:
        return [...action.data];

    case UserTypes.LOGOUT_SUCCESS:
        return [];

    default:
        return state;
    }
}

function receiveUserProfile(state: IDMappedObjects<UserProfile>, received: UserProfile) {
    const existing = state[received.id];

    if (!existing) {
        // No existing data to merge with
        return {
            ...state,
            [received.id]: received,
        };
    }

    const merged = {
        ...existing,
        ...received,
    };

    // If there was a remote_id but not anymore, remove it
    if (existing.remote_id && !received.remote_id) {
        delete merged.remote_id;
    }

    // MM-53377:
    // For non-admin users, certain API responses don't return details for the current user that would be sanitized
    // out for others. This currently includes:
    // - email (if PrivacySettings.ShowEmailAddress is false)
    // - first_name/last_name (if PrivacySettings.ShowFullName is false)
    // - last_password_update
    // - auth_service
    // - notify_props
    //
    // Because email, first_name, last_name, and auth_service can all be empty strings regularly, we can't just
    // merge the received user and the existing one together like we normally would. Instead, we can use the
    // existence of existing.notify_props or existing.last_password_update to determine which object has that extra
    // data so that it can take precedence. Those fields are:
    // 1. Never empty or zero by Go standards
    // 2. Only ever sent to the current user, not even to admins, so we know that the object contains privileged data
    //
    // Note that admins may have the email/name/auth_service of other users loaded as well. This does not prevent that
    // data from being replaced when merging sanitized user objects. There doesn't seem to be a way for us to detect
    // whether the object is sanitized for admins.
    if (existing.notify_props && (!received.notify_props || Object.keys(received.notify_props).length === 0)) {
        merged.email = existing.email;
        merged.first_name = existing.first_name;
        merged.last_name = existing.last_name;
        merged.last_password_update = existing.last_password_update;
        merged.auth_service = existing.auth_service;
        merged.notify_props = existing.notify_props;
    }

    if (isEqual(existing, merged)) {
        return state;
    }

    return {
        ...state,
        [merged.id]: merged,
    };
}

function profiles(state: UsersState['profiles'] = {}, action: MMReduxAction) {
    switch (action.type) {
    case UserTypes.RECEIVED_ME:
    case UserTypes.RECEIVED_PROFILE: {
        const user = action.data;

        return receiveUserProfile(state, user);
    }
    case UserTypes.RECEIVED_PROFILES_LIST: {
        const users: UserProfile[] = action.data;

        return users.reduce(receiveUserProfile, state);
    }
    case UserTypes.RECEIVED_PROFILES: {
        const users: UserProfile[] = Object.values(action.data);

        return users.reduce(receiveUserProfile, state);
    }

    case UserTypes.RECEIVED_TERMS_OF_SERVICE_STATUS: {
        const data = action.data;
        return {
            ...state,
            [data.user_id]: {
                ...state[data.user_id],
                terms_of_service_id: data.terms_of_service_id,
                terms_of_service_create_at: data.terms_of_service_create_at,
            },
        };
    }
    case UserTypes.PROFILE_NO_LONGER_VISIBLE: {
        if (state[action.data.user_id]) {
            const newState = {...state};
            delete newState[action.data.user_id];
            return newState;
        }
        return state;
    }

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function profilesInTeam(state: UsersState['profilesInTeam'] = {}, action: MMReduxAction) {
    switch (action.type) {
    case UserTypes.RECEIVED_PROFILE_IN_TEAM:
        return addProfileToSet(state, action.data.id, action.data.user_id);

    case UserTypes.RECEIVED_PROFILES_LIST_IN_TEAM:
        return profileListToSet(state, action);

    case UserTypes.RECEIVED_PROFILES_IN_TEAM:
        return profilesToSet(state, action);

    case UserTypes.RECEIVED_PROFILE_NOT_IN_TEAM:
        return removeProfileFromSet(state, action);

    case UserTypes.RECEIVED_PROFILES_LIST_NOT_IN_TEAM:
        return removeProfileListFromSet(state, action);

    case UserTypes.LOGOUT_SUCCESS:
        return {};

    case UserTypes.PROFILE_NO_LONGER_VISIBLE:
        return removeProfileFromSets(state, action);

    default:
        return state;
    }
}

function profilesNotInTeam(state: UsersState['profilesNotInTeam'] = {}, action: MMReduxAction) {
    switch (action.type) {
    case UserTypes.RECEIVED_PROFILE_NOT_IN_TEAM:
        return addProfileToSet(state, action.data.id, action.data.user_id);

    case UserTypes.RECEIVED_PROFILES_LIST_NOT_IN_TEAM:
        return profileListToSet(state, action);

    case UserTypes.RECEIVED_PROFILES_LIST_NOT_IN_TEAM_AND_REPLACE:
        return profileListToSet(state, action, true);

    case UserTypes.RECEIVED_PROFILE_IN_TEAM:
        return removeProfileFromSet(state, action);

    case UserTypes.RECEIVED_PROFILES_LIST_IN_TEAM:
        return removeProfileListFromSet(state, action);

    case UserTypes.LOGOUT_SUCCESS:
        return {};

    case UserTypes.PROFILE_NO_LONGER_VISIBLE:
        return removeProfileFromSets(state, action);

    default:
        return state;
    }
}

function profilesWithoutTeam(state: UsersState['profilesWithoutTeam'] = new Set<string>(), action: MMReduxAction) {
    switch (action.type) {
    case UserTypes.RECEIVED_PROFILE_WITHOUT_TEAM: {
        const nextSet = new Set(state);
        Object.values(action.data as string[]).forEach((id: string) => nextSet.add(id));
        return nextSet;
    }
    case UserTypes.RECEIVED_PROFILES_LIST_WITHOUT_TEAM: {
        const nextSet = new Set(state);
        action.data.forEach((user: UserProfile) => nextSet.add(user.id));
        return nextSet;
    }
    case UserTypes.RECEIVED_PROFILE_IN_TEAM: {
        const nextSet = new Set(state);
        nextSet.delete(action.data.id);
        return nextSet;
    }
    case UserTypes.PROFILE_NO_LONGER_VISIBLE: {
        const nextSet = new Set(state);
        nextSet.delete(action.data.user_id);
        return nextSet;
    }

    case UserTypes.LOGOUT_SUCCESS:
        return new Set<string>();

    default:
        return state;
    }
}

function profilesInChannel(state: UsersState['profilesInChannel'] = {}, action: MMReduxAction) {
    switch (action.type) {
    case UserTypes.RECEIVED_PROFILE_IN_CHANNEL:
        return addProfileToSet(state, action.data.id, action.data.user_id);

    case UserTypes.RECEIVED_PROFILES_LIST_IN_CHANNEL:
        return profileListToSet(state, action);

    case UserTypes.RECEIVED_PROFILES_IN_CHANNEL:
        return profilesToSet(state, action);

    case UserTypes.RECEIVED_PROFILE_NOT_IN_CHANNEL:
        return removeProfileFromSet(state, action);

    case ChannelTypes.CHANNEL_MEMBER_REMOVED:
        return removeProfileFromSet(state, {
            type: '',
            data: {
                id: action.data.channel_id,
                user_id: action.data.user_id,
            }});

    case UserTypes.PROFILE_NO_LONGER_VISIBLE:
        return removeProfileFromSets(state, action);

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function profilesNotInChannel(state: UsersState['profilesNotInChannel'] = {}, action: MMReduxAction) {
    switch (action.type) {
    case UserTypes.RECEIVED_PROFILE_NOT_IN_CHANNEL:
        return addProfileToSet(state, action.data.id, action.data.user_id);

    case UserTypes.RECEIVED_PROFILES_LIST_NOT_IN_CHANNEL:
        return profileListToSet(state, action);

    case UserTypes.RECEIVED_PROFILES_LIST_NOT_IN_CHANNEL_AND_REPLACE:
        return profileListToSet(state, action, true);

    case UserTypes.RECEIVED_PROFILES_NOT_IN_CHANNEL:
        return profilesToSet(state, action);

    case UserTypes.RECEIVED_PROFILES_IN_CHANNEL:
        return removeProfilesFromSet(state, action);

    case UserTypes.RECEIVED_PROFILE_IN_CHANNEL:
        return removeProfileFromSet(state, action);

    case ChannelTypes.CHANNEL_MEMBER_ADDED:
        return removeProfileFromSet(state, {
            type: '',
            data: {
                id: action.data.channel_id,
                user_id: action.data.user_id,
            }});

    case UserTypes.LOGOUT_SUCCESS:
        return {};

    case UserTypes.PROFILE_NO_LONGER_VISIBLE:
        return removeProfileFromSets(state, action);

    default:
        return state;
    }
}

function profilesInGroup(state: UsersState['profilesInGroup'] = {}, action: MMReduxAction) {
    switch (action.type) {
    case UserTypes.RECEIVED_PROFILES_LIST_IN_GROUP: {
        return profileListToSet(state, action);
    }
    case UserTypes.RECEIVED_PROFILES_FOR_GROUP: {
        const id = action.id;
        const nextSet = new Set(state[id]);
        if (action.data) {
            action.data.forEach((profile: any) => {
                nextSet.add(profile.user_id);
            });

            return {
                ...state,
                [id]: nextSet,
            };
        }
        return state;
    }
    case UserTypes.RECEIVED_PROFILES_LIST_TO_REMOVE_FROM_GROUP: {
        const id = action.id;
        const nextSet = new Set(state[id]);
        if (action.data) {
            action.data.forEach((profile: any) => {
                nextSet.delete(profile.user_id);
            });

            return {
                ...state,
                [id]: nextSet,
            };
        }
        return state;
    }

    case UserTypes.PROFILE_NO_LONGER_VISIBLE:
        return removeProfileFromSets(state, action);

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function profilesNotInGroup(state: UsersState['profilesNotInGroup'] = {}, action: MMReduxAction) {
    switch (action.type) {
    case UserTypes.RECEIVED_PROFILES_FOR_GROUP: {
        const id = action.id;
        const nextSet = new Set(state[id]);
        if (action.data) {
            action.data.forEach((profile: any) => {
                nextSet.delete(profile.user_id);
            });

            return {
                ...state,
                [id]: nextSet,
            };
        }
        return state;
    }
    case UserTypes.RECEIVED_PROFILES_LIST_NOT_IN_GROUP: {
        return profileListToSet(state, action);
    }

    case UserTypes.PROFILE_NO_LONGER_VISIBLE:
        return removeProfileFromSets(state, action);

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function dndEndTimes(state: UsersState['dndEndTimes'] = {}, action: MMReduxAction) {
    switch (action.type) {
    case UserTypes.RECEIVED_DND_END_TIMES: {
        return {...state, ...action.data};
    }
    case UserTypes.PROFILE_NO_LONGER_VISIBLE: {
        if (state[action.data.user_id]) {
            const newState = {...state};
            delete newState[action.data.user_id];
            return newState;
        }
        return state;
    }

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function statuses(state: RelationOneToOne<UserProfile, string> = {}, action: MMReduxAction) {
    switch (action.type) {
    case UserTypes.RECEIVED_STATUSES: {
        return {...state, ...action.data};
    }

    case UserTypes.PROFILE_NO_LONGER_VISIBLE: {
        if (state[action.data.user_id]) {
            const newState = {...state};
            delete newState[action.data.user_id];
            return newState;
        }
        return state;
    }

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function isManualStatus(state: RelationOneToOne<UserProfile, boolean> = {}, action: MMReduxAction) {
    switch (action.type) {
    case UserTypes.RECEIVED_STATUSES_IS_MANUAL: {
        return {...state, ...action.data};
    }

    case UserTypes.PROFILE_NO_LONGER_VISIBLE: {
        if (state[action.data.user_id]) {
            const newState = {...state};
            delete newState[action.data.user_id];
            return newState;
        }
        return state;
    }

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function myUserAccessTokens(state: UsersState['myUserAccessTokens'] = {}, action: MMReduxAction) {
    switch (action.type) {
    case UserTypes.RECEIVED_MY_USER_ACCESS_TOKEN: {
        const nextState = {...state};
        nextState[action.data.id] = action.data;

        return nextState;
    }
    case UserTypes.RECEIVED_MY_USER_ACCESS_TOKENS: {
        const nextState = {...state};

        for (const uat of action.data) {
            nextState[uat.id] = uat;
        }

        return nextState;
    }
    case UserTypes.REVOKED_USER_ACCESS_TOKEN: {
        const nextState = {...state};
        Reflect.deleteProperty(nextState, action.data);

        return nextState;
    }

    case UserTypes.ENABLED_USER_ACCESS_TOKEN: {
        if (state[action.data]) {
            const nextState = {...state};
            nextState[action.data] = {...nextState[action.data], is_active: true};
            return nextState;
        }
        return state;
    }

    case UserTypes.DISABLED_USER_ACCESS_TOKEN: {
        if (state[action.data]) {
            const nextState = {...state};
            nextState[action.data] = {...nextState[action.data], is_active: false};
            return nextState;
        }
        return state;
    }

    case UserTypes.CLEAR_MY_USER_ACCESS_TOKENS:
    case UserTypes.LOGOUT_SUCCESS:
        return {};

    default:
        return state;
    }
}

function stats(state: UsersState['stats'] = {}, action: MMReduxAction) {
    switch (action.type) {
    case UserTypes.RECEIVED_USER_STATS: {
        const stat = action.data;
        return {
            ...state,
            ...stat,
        };
    }
    default:
        return state;
    }
}

function filteredStats(state: UsersState['filteredStats'] = {}, action: MMReduxAction) {
    switch (action.type) {
    case UserTypes.RECEIVED_FILTERED_USER_STATS: {
        const stat = action.data;
        return {
            ...state,
            ...stat,
        };
    }
    default:
        return state;
    }
}

function lastActivity(state: UsersState['lastActivity'] = {}, action: MMReduxAction) {
    switch (action.type) {
    case UserTypes.RECEIVED_LAST_ACTIVITIES: {
        return {...state, ...action.data};
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    case UserTypes.PROFILE_NO_LONGER_VISIBLE: {
        if (state[action.data.user_id]) {
            const newState = {...state};
            delete newState[action.data.user_id];
            return newState;
        }
        return state;
    }
    default:
        return state;
    }
}

export default combineReducers({

    // the current selected user
    currentUserId,

    // array with the user's sessions
    mySessions,

    // array with the user's audits
    myAudits,

    // object where every key is the token id and has a user access token as a value
    myUserAccessTokens,

    // object where every key is a user id and has an object with the users details
    profiles,

    // object where every key is a team id and has a Set with the users id that are members of the team
    profilesInTeam,

    // object where every key is a team id and has a Set with the users id that are not members of the team
    profilesNotInTeam,

    // set with user ids for users that are not on any team
    profilesWithoutTeam,

    // object where every key is a channel id and has a Set with the users id that are members of the channel
    profilesInChannel,

    // object where every key is a channel id and has a Set with the users id that are not members of the channel
    profilesNotInChannel,

    // object where every key is a group id and has a Set with the users id that are members of the group
    profilesInGroup,

    // object where every key is a group id and has a Set with the users id that are members of the group
    profilesNotInGroup,

    // object where every key is the user id and has a value with the dnd end time of each user
    dndEndTimes,

    // object where every key is the user id and has a value with the current status of each user
    statuses,

    // object where every key is the user id and has a value with a flag determining if their status was set manually
    isManualStatus,

    // Total user stats
    stats,

    // Total user stats after filters have been applied
    filteredStats,

    // object where every key is the user id and has a value with the last activity timestamp
    lastActivity,
});
