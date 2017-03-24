// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from 'dispatcher/app_dispatcher.jsx';

import PreferenceStore from 'stores/preference_store.jsx';
import TeamStore from 'stores/team_store.jsx';
import UserStore from 'stores/user_store.jsx';
import ChannelStore from 'stores/channel_store.jsx';

import {getChannelMembersForUserIds} from 'actions/channel_actions.jsx';
import {loadStatusesForProfilesList, loadStatusesForProfilesMap} from 'actions/status_actions.jsx';

import {getDirectChannelName} from 'utils/utils.jsx';

import * as AsyncClient from 'utils/async_client.jsx';
import Client from 'client/web_client.jsx';

import {Constants, ActionTypes, Preferences} from 'utils/constants.jsx';
import {browserHistory} from 'react-router/es6';

export function switchFromLdapToEmail(email, password, token, ldapPassword, onSuccess, onError) {
    Client.ldapToEmail(
        email,
        password,
        token,
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

export function loadProfilesAndTeamMembersAndChannelMembers(offset, limit, teamId = TeamStore.getCurrentId(), channelId = ChannelStore.getCurrentId(), success, error) {
    Client.getProfilesInChannel(
        channelId,
        offset,
        limit,
        (data) => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_PROFILES_IN_CHANNEL,
                profiles: data,
                channel_id: channelId,
                offset,
                count: Object.keys(data).length
            });

            loadTeamMembersForProfilesMap(
                data,
                teamId,
                () => {
                    loadChannelMembersForProfilesMap(data, channelId, success, error);
                    loadStatusesForProfilesMap(data);
                });
        },
        (err) => {
            AsyncClient.dispatchError(err, 'getProfilesInChannel');
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

export function loadProfilesWithoutTeam(page, perPage, success, error) {
    Client.getProfilesWithoutTeam(
        page,
        perPage,
        (data) => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_PROFILES_WITHOUT_TEAM,
                profiles: data,
                page
            });

            loadStatusesForProfilesMap(data);
        },
        (err) => {
            AsyncClient.dispatchError(err, 'getProfilesWithoutTeam');

            if (error) {
                error(err);
            }
        }
    );
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

export function loadChannelMembersForProfilesMap(profiles, channelId = ChannelStore.getCurrentId(), success, error) {
    const membersToLoad = {};
    for (const pid in profiles) {
        if (!profiles.hasOwnProperty(pid)) {
            continue;
        }

        if (!ChannelStore.hasActiveMemberInChannel(channelId, pid)) {
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

    getChannelMembersForUserIds(channelId, list, success, error);
}

export function loadTeamMembersAndChannelMembersForProfilesList(profiles, teamId = TeamStore.getCurrentId(), channelId = ChannelStore.getCurrentId(), success, error) {
    loadTeamMembersForProfilesList(profiles, teamId, () => {
        loadChannelMembersForProfilesList(profiles, channelId, success, error);
    }, error);
}

export function loadChannelMembersForProfilesList(profiles, channelId = ChannelStore.getCurrentId(), success, error) {
    const membersToLoad = {};
    for (let i = 0; i < profiles.length; i++) {
        const pid = profiles[i].id;

        if (!ChannelStore.hasActiveMemberInChannel(channelId, pid)) {
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

    getChannelMembersForUserIds(channelId, list, success, error);
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

function populateChannelWithProfiles(channelId, userIds) {
    for (let i = 0; i < userIds.length; i++) {
        UserStore.saveUserIdInChannel(channelId, userIds[i]);
    }
    UserStore.emitInChannelChange();
}

export function loadNewDMIfNeeded(userId) {
    if (userId === UserStore.getCurrentId()) {
        return;
    }

    const pref = PreferenceStore.getBool(Preferences.CATEGORY_DIRECT_CHANNEL_SHOW, userId, false);
    if (pref === false) {
        PreferenceStore.setPreference(Preferences.CATEGORY_DIRECT_CHANNEL_SHOW, userId, 'true');
        AsyncClient.savePreference(Preferences.CATEGORY_DIRECT_CHANNEL_SHOW, userId, 'true');
        loadProfilesForDM();
    }
}

export function loadNewGMIfNeeded(channelId, userId) {
    if (userId === UserStore.getCurrentId()) {
        return;
    }

    function checkPreference() {
        const pref = PreferenceStore.getBool(Preferences.CATEGORY_GROUP_CHANNEL_SHOW, channelId, false);
        if (pref === false) {
            PreferenceStore.setPreference(Preferences.CATEGORY_GROUP_CHANNEL_SHOW, channelId, 'true');
            AsyncClient.savePreference(Preferences.CATEGORY_GROUP_CHANNEL_SHOW, channelId, 'true');
            loadProfilesForGM();
        }
    }

    const channel = ChannelStore.get(channelId);
    if (channel) {
        checkPreference();
    } else {
        Client.getChannel(
            channelId,
            (data) => {
                AppDispatcher.handleServerAction({
                    type: ActionTypes.RECEIVED_CHANNEL,
                    channel: data.channel,
                    member: data.member
                });

                checkPreference();
            },
            (err) => {
                AsyncClient.dispatchError(err, 'getChannel');
            }
       );
    }
}

export function loadProfilesForSidebar() {
    loadProfilesForDM();
    loadProfilesForGM();
}

export function loadProfilesForGM() {
    const channels = ChannelStore.getChannels();
    const newPreferences = [];

    for (let i = 0; i < channels.length; i++) {
        const channel = channels[i];
        if (channel.type !== Constants.GM_CHANNEL) {
            continue;
        }

        if (UserStore.getProfileListInChannel(channel.id).length >= Constants.MIN_USERS_IN_GM) {
            continue;
        }

        const isVisible = PreferenceStore.getBool(Preferences.CATEGORY_GROUP_CHANNEL_SHOW, channel.id);

        if (!isVisible) {
            const member = ChannelStore.getMyMember(channel.id);
            if (!member || (member.mention_count === 0 && member.msg_count >= channel.total_msg_count)) {
                continue;
            }

            newPreferences.push({
                user_id: UserStore.getCurrentId(),
                category: Preferences.CATEGORY_GROUP_CHANNEL_SHOW,
                name: channel.id,
                value: 'true'
            });
        }

        Client.getProfilesInChannel(
            channel.id,
            0,
            Constants.MAX_USERS_IN_GM,
            (data) => {
                AppDispatcher.handleServerAction({
                    type: ActionTypes.RECEIVED_PROFILES,
                    profiles: data
                });

                populateChannelWithProfiles(channel.id, Object.keys(data));
            }
        );
    }

    if (newPreferences.length > 0) {
        AsyncClient.savePreferences(newPreferences);
    }
}

export function loadProfilesForDM() {
    const channels = ChannelStore.getChannels();
    const newPreferences = [];
    const profilesToLoad = [];
    const profileIds = [];

    for (let i = 0; i < channels.length; i++) {
        const channel = channels[i];
        if (channel.type !== Constants.DM_CHANNEL) {
            continue;
        }

        const teammateId = channel.name.replace(UserStore.getCurrentId(), '').replace('__', '');
        const isVisible = PreferenceStore.getBool(Preferences.CATEGORY_DIRECT_CHANNEL_SHOW, teammateId);

        if (!isVisible) {
            const member = ChannelStore.getMyMember(channel.id);
            if (!member || member.mention_count === 0) {
                continue;
            }

            newPreferences.push({
                user_id: UserStore.getCurrentId(),
                category: Preferences.CATEGORY_DIRECT_CHANNEL_SHOW,
                name: teammateId,
                value: 'true'
            });
        }

        if (!UserStore.hasProfile(teammateId)) {
            profilesToLoad.push(teammateId);
        }
        profileIds.push(teammateId);
    }

    if (newPreferences.length > 0) {
        AsyncClient.savePreferences(newPreferences);
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
                populateDMChannelsWithProfiles(profileIds);
            },
            (err) => {
                AsyncClient.dispatchError(err, 'getProfilesByIds');
            }
        );
    } else {
        populateDMChannelsWithProfiles(profileIds);
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
        if (name === '' || name === teamId) {
            continue;
        }

        toDelete.push({
            user_id: UserStore.getCurrentId(),
            category: Preferences.CATEGORY_THEME,
            name
        });
    }

    if (toDelete.length > 0) {
        // we're saving a new global theme so delete any team-specific ones
        AsyncClient.deletePreferences(toDelete);

        // delete them locally before we hear from the server so that the UI flow is smoother
        AppDispatcher.handleServerAction({
            type: ActionTypes.DELETED_PREFERENCES,
            preferences: toDelete
        });
    }

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

export function autocompleteUsers(username, success, error) {
    Client.autocompleteUsers(
        username,
        (data) => {
            if (success) {
                success(data);
            }
        },
        (err) => {
            AsyncClient.dispatchError(err, 'autocompleteUsers');

            if (error) {
                error(err);
            }
        }
    );
}

export function updateUser(username, type, success, error) {
    Client.updateUser(
        username,
        type,
        (data) => {
            if (success) {
                success(data);
            }
        },
        (err) => {
            if (error) {
                error(err);
            } else {
                AsyncClient.dispatchError(err, 'updateUser');
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

export function updateUserNotifyProps(data, success, error) {
    Client.updateUserNotifyProps(
      data,
      () => {
          AsyncClient.getMe();

          if (success) {
              success();
          }
      },
      (err) => {
          if (error) {
              error(err);
          }
      }
    );
}

export function updateUserRoles(userId, newRoles, success, error) {
    Client.updateUserRoles(
      userId,
      newRoles,
      () => {
          AsyncClient.getUser(userId);

          if (success) {
              success();
          }
      },
      (err) => {
          if (error) {
              error(err);
          }
      }
    );
}

export function activateMfa(code, success, error) {
    Client.updateMfa(
        code,
        true,
        () => {
            AsyncClient.getMe();

            if (success) {
                success();
            }
        },
        (err) => {
            if (error) {
                error(err);
            }
        }
    );
}

export function deactivateMfa(success, error) {
    Client.updateMfa(
        '',
        false,
        () => {
            AsyncClient.getMe();

            if (success) {
                success();
            }
        },
        (err) => {
            if (error) {
                error(err);
            }
        }
    );
}

export function checkMfa(loginId, success, error) {
    if (global.window.mm_config.EnableMultifactorAuthentication !== 'true') {
        success(false);
        return;
    }

    Client.checkMfa(
        loginId,
        (data) => {
            if (success) {
                success(data && data.mfa_required === 'true');
            }
        },
        (err) => {
            if (error) {
                error(err);
            }
        }
    );
}

export function updateActive(userId, active, success, error) {
    Client.updateActive(userId, active,
        () => {
            AsyncClient.getUser(userId);

            if (success) {
                success();
            }
        },
        (err) => {
            if (error) {
                error(err);
            }
        }
    );
}

export function updatePassword(userId, currentPassword, newPassword, success, error) {
    Client.updatePassword(userId, currentPassword, newPassword,
        () => {
            if (success) {
                success();
            }
        },
        (err) => {
            if (error) {
                error(err);
            }
        }
    );
}

export function verifyEmail(uid, hid, success, error) {
    Client.verifyEmail(
        uid,
        hid,
        (data) => {
            if (success) {
                success(data);
            }
        },
        (err) => {
            if (error) {
                error(err);
            }
        }
    );
}

export function resetPassword(code, password, success, error) {
    Client.resetPassword(
        code,
        password,
        () => {
            browserHistory.push('/login?extra=' + ActionTypes.PASSWORD_CHANGE);

            if (success) {
                success();
            }
        },
        (err) => {
            if (error) {
                error(err);
            }
        }
    );
}

export function resendVerification(email, success, error) {
    Client.resendVerification(
        email,
        () => {
            if (success) {
                success();
            }
        },
        (err) => {
            if (error) {
                error(err);
            }
        }
    );
}

export function loginById(userId, password, mfaToken, success, error) {
    Client.loginById(
        userId,
        password,
        mfaToken,
        () => {
            if (success) {
                success();
            }
        },
        (err) => {
            if (error) {
                error(err);
            }
        }
    );
}

export function createUserWithInvite(user, data, emailHash, inviteId, success, error) {
    Client.createUserWithInvite(
        user,
        data,
        emailHash,
        inviteId,
        (response) => {
            if (success) {
                success(response);
            }
        },
        (err) => {
            if (error) {
                error(err);
            }
        }
    );
}

export function webLogin(loginId, password, token, success, error) {
    Client.webLogin(
        loginId,
        password,
        token,
        () => {
            if (success) {
                success();
            }
        },
        (err) => {
            if (error) {
                error(err);
            }
        }
    );
}

export function webLoginByLdap(loginId, password, token, success, error) {
    Client.webLoginByLdap(
        loginId,
        password,
        token,
        (data) => {
            if (success) {
                success(data);
            }
        },
        (err) => {
            if (error) {
                error(err);
            }
        }
    );
}

export function getAuthorizedApps(success, error) {
    Client.getAuthorizedApps(
        (authorizedApps) => {
            if (success) {
                success(authorizedApps);
            }
        },
        (err) => {
            if (error) {
                error(err);
            }
        });
}

export function deauthorizeOAuthApp(appId, success, error) {
    Client.deauthorizeOAuthApp(
        appId,
        () => {
            if (success) {
                success();
            }
        },
        (err) => {
            if (error) {
                error(err);
            }
        });
}

export function uploadProfileImage(userPicture, success, error) {
    Client.uploadProfileImage(
        userPicture,
        () => {
            AsyncClient.getMe();
            if (success) {
                success();
            }
        },
        (err) => {
            if (error) {
                error(err);
            }
        }
    );
}

export function loadProfiles(offset = UserStore.getPagingOffset(), limit = Constants.PROFILE_CHUNK_SIZE, success, error) {
    Client.getProfiles(
        offset,
        limit,
        (data) => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_PROFILES,
                profiles: data
            });

            if (success) {
                success(data);
            }
        },
        (err) => {
            AsyncClient.dispatchError(err, 'getProfiles');

            if (error) {
                error(err);
            }
        }
    );
}
