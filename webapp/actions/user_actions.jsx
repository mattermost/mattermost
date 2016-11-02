// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from 'dispatcher/app_dispatcher.jsx';

import PreferenceStore from 'stores/preference_store.jsx';
import TeamStore from 'stores/team_store.jsx';
import UserStore from 'stores/user_store.jsx';
import ChannelStore from 'stores/channel_store.jsx';

import {loadStatusesForProfilesList, loadStatusesForProfilesMap} from 'actions/status_actions.jsx';

import {getDirectChannelName} from 'utils/utils.jsx';
import * as AsyncClient from 'utils/async_client.jsx';
import Client from 'client/web_client.jsx';

import {ActionTypes, Preferences} from 'utils/constants.jsx';

export function switchFromLdapToEmail(email, password, ldapPassword, onSuccess, onError) {
    Client.ldapToEmail(
        email,
        password,
        ldapPassword,
        (data) => {
            if (data.follow_link) {
                window.location.href = data.follow_link;
            }

            if (onSuccess) {
                onSuccess(data);
            }
        },
        onError
    );
}

export function loadProfilesAndTeamMembers(offset, limit, teamId = TeamStore.getCurrentId(), success, error) {
    Client.getProfilesInTeam(
        teamId,
        offset,
        limit,
        (data) => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_PROFILES_IN_TEAM,
                profiles: data,
                team_id: teamId,
                offset,
                count: Object.keys(data).length
            });

            loadTeamMembersForProfilesMap(data, teamId, success, error);
            loadStatusesForProfilesMap(data);
        },
        (err) => {
            AsyncClient.dispatchError(err, 'getProfilesInTeam');
        }
    );
}

export function loadTeamMembersForProfilesMap(profiles, teamId = TeamStore.getCurrentId(), success, error) {
    const membersToLoad = {};
    for (const pid in profiles) {
        if (!profiles.hasOwnProperty(pid)) {
            continue;
        }

        if (!TeamStore.hasActiveMemberInTeam(teamId, pid)) {
            membersToLoad[pid] = true;
        }
    }

    const list = Object.keys(membersToLoad);
    if (list.length === 0) {
        if (success) {
            success({});
        }
        return;
    }

    loadTeamMembersForProfiles(list, teamId, success, error);
}

export function loadTeamMembersForProfilesList(profiles, teamId = TeamStore.getCurrentId(), success, error) {
    const membersToLoad = {};
    for (let i = 0; i < profiles.length; i++) {
        const pid = profiles[i].id;

        if (!TeamStore.hasActiveMemberInTeam(teamId, pid)) {
            membersToLoad[pid] = true;
        }
    }

    const list = Object.keys(membersToLoad);
    if (list.length === 0) {
        if (success) {
            success({});
        }
        return;
    }

    loadTeamMembersForProfiles(list, teamId, success, error);
}

function loadTeamMembersForProfiles(userIds, teamId, success, error) {
    Client.getTeamMembersByIds(
        teamId,
        userIds,
        (data) => {
            const memberMap = {};
            for (let i = 0; i < data.length; i++) {
                memberMap[data[i].user_id] = data[i];
            }

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_MEMBERS_IN_TEAM,
                team_id: teamId,
                team_members: memberMap
            });

            if (success) {
                success(data);
            }
        },
        (err) => {
            AsyncClient.dispatchError(err, 'getTeamMembersByIds');

            if (error) {
                error(err);
            }
        }
    );
}

function populateDMChannelsWithProfiles(userIds) {
    const currentUserId = UserStore.getCurrentId();

    for (let i = 0; i < userIds.length; i++) {
        const channelName = getDirectChannelName(currentUserId, userIds[i]);
        const channel = ChannelStore.getByName(channelName);
        if (channel) {
            UserStore.saveUserIdInChannel(channel.id, userIds[i]);
        }
    }
}

export function loadProfilesAndTeamMembersForDMSidebar() {
    const dmPrefs = PreferenceStore.getCategory(Preferences.CATEGORY_DIRECT_CHANNEL_SHOW);
    const teamId = TeamStore.getCurrentId();
    const profilesToLoad = [];
    const membersToLoad = [];

    for (const [key, value] of dmPrefs) {
        if (value === 'true') {
            if (!UserStore.hasProfile(key)) {
                profilesToLoad.push(key);
            }
            membersToLoad.push(key);
        }
    }

    if (profilesToLoad.length > 0) {
        Client.getProfilesByIds(
            profilesToLoad,
            (data) => {
                AppDispatcher.handleServerAction({
                    type: ActionTypes.RECEIVED_PROFILES,
                    profiles: data
                });

                // Use membersToLoad so we get all the DM profiles even if they were already loaded
                populateDMChannelsWithProfiles(membersToLoad);
            },
            (err) => {
                AsyncClient.dispatchError(err, 'getProfilesByIds');
            }
        );
    } else {
        populateDMChannelsWithProfiles(membersToLoad);
    }

    if (membersToLoad.length > 0) {
        Client.getTeamMembersByIds(
            teamId,
            membersToLoad,
            (data) => {
                const memberMap = {};
                for (let i = 0; i < data.length; i++) {
                    memberMap[data[i].user_id] = data[i];
                }

                const nonMembersMap = {};
                for (let i = 0; i < membersToLoad.length; i++) {
                    if (!memberMap[membersToLoad[i]]) {
                        nonMembersMap[membersToLoad[i]] = true;
                    }
                }

                AppDispatcher.handleServerAction({
                    type: ActionTypes.RECEIVED_MEMBERS_IN_TEAM,
                    team_id: teamId,
                    team_members: memberMap,
                    non_team_members: nonMembersMap
                });
            },
            (err) => {
                AsyncClient.dispatchError(err, 'getTeamMembersByIds');
            }
        );
    }
}

export function saveTheme(teamId, theme, onSuccess, onError) {
    AsyncClient.savePreference(
        Preferences.CATEGORY_THEME,
        teamId,
        JSON.stringify(theme),
        () => {
            onThemeSaved(teamId, theme, onSuccess);
        },
        (err) => {
            onError(err);
        }
    );
}

function onThemeSaved(teamId, theme, onSuccess) {
    const themePreferences = PreferenceStore.getCategory(Preferences.CATEGORY_THEME);

    if (teamId !== '' && themePreferences.size > 1) {
        // no extra handling to be done to delete team-specific themes
        onSuccess();
        return;
    }

    const toDelete = [];

    for (const [name] of themePreferences) {
        if (name === '') {
            continue;
        }

        toDelete.push({
            user_id: UserStore.getCurrentId(),
            category: Preferences.CATEGORY_THEME,
            name
        });
    }

    // we're saving a new global theme so delete any team-specific ones
    AsyncClient.deletePreferences(toDelete);

    // delete them locally before we hear from the server so that the UI flow is smoother
    AppDispatcher.handleServerAction({
        type: ActionTypes.DELETED_PREFERENCES,
        preferences: toDelete
    });

    onSuccess();
}

export function searchUsers(term, teamId = TeamStore.getCurrentId(), options = {}, success, error) {
    Client.searchUsers(
        term,
        teamId,
        options,
        (data) => {
            loadStatusesForProfilesList(data);

            if (success) {
                success(data);
            }
        },
        (err) => {
            AsyncClient.dispatchError(err, 'searchUsers');

            if (error) {
                error(err);
            }
        }
    );
}

export function autocompleteUsersInChannel(username, channelId, success, error) {
    Client.autocompleteUsersInChannel(
        username,
        channelId,
        (data) => {
            if (success) {
                success(data);
            }
        },
        (err) => {
            AsyncClient.dispatchError(err, 'autocompleteUsersInChannel');

            if (error) {
                error(err);
            }
        }
    );
}

export function autocompleteUsersInTeam(username, success, error) {
    Client.autocompleteUsersInTeam(
        username,
        (data) => {
            if (success) {
                success(data);
            }
        },
        (err) => {
            AsyncClient.dispatchError(err, 'autocompleteUsersInTeam');

            if (error) {
                error(err);
            }
        }
    );
}

export function generateMfaSecret(success, error) {
    Client.generateMfaSecret(
        (data) => {
            if (success) {
                success(data);
            }
        },
        (err) => {
            AsyncClient.dispatchError(err, 'generateMfaSecret');

            if (error) {
                error(err);
            }
        }
    );
}
