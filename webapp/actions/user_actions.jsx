// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from 'dispatcher/app_dispatcher.jsx';

import PreferenceStore from 'stores/preference_store.jsx';
import TeamStore from 'stores/team_store.jsx';
import UserStore from 'stores/user_store.jsx';
import ChannelStore from 'stores/channel_store.jsx';

import {getChannelMembersForUserIds} from 'actions/channel_actions.jsx';
import {loadStatusesForProfilesList, loadStatusesForProfilesMap} from 'actions/status_actions.jsx';

import {getDirectChannelName, getUserIdFromChannelName} from 'utils/utils.jsx';

import * as AsyncClient from 'utils/async_client.jsx';
import Client from 'client/web_client.jsx';

import {Constants, ActionTypes, Preferences} from 'utils/constants.jsx';
import {browserHistory} from 'react-router/es6';

// Redux actions
import store from 'stores/redux_store.jsx';
const dispatch = store.dispatch;
const getState = store.getState;

import {
    getProfiles,
    getProfilesInChannel,
    getProfilesInTeam,
    getProfilesWithoutTeam,
    getProfilesByIds,
    getMe,
    searchProfiles,
    autocompleteUsers as autocompleteRedux,
    updateMe,
    updateUserMfa,
    checkMfa as checkMfaRedux,
    updateUserPassword,
    createUser,
    login,
    loadMe as loadMeRedux
} from 'mattermost-redux/actions/users';

import {getMyTeams} from 'mattermost-redux/actions/teams';

export function loadMe(callback) {
    loadMeRedux()(dispatch, getState).then(
        () => {
            global.window.mm_config = store.getState().entities.general.config;
            global.window.mm_license = store.getState().entities.general.license;

            if (global.window && global.window.analytics) {
                global.window.analytics.identify(global.window.mm_config.DiagnosticId, {}, {
                    context: {
                        ip: '0.0.0.0'
                    },
                    page: {
                        path: '',
                        referrer: '',
                        search: '',
                        title: '',
                        url: ''
                    },
                    anonymousId: '00000000000000000000000000'
                });
            }

            localStorage.setItem('currentUserId', UserStore.getCurrentId());

            getMyTeams()(dispatch, getState).then(() => {
                if (callback) {
                    callback();
                }
            });
        }
    );
}

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

export function loadProfilesAndTeamMembers(page, perPage, teamId = TeamStore.getCurrentId(), success) {
    getProfilesInTeam(teamId, page, perPage)(dispatch, getState).then(
        (data) => {
            loadTeamMembersForProfilesList(data, teamId, success);
            loadStatusesForProfilesList(data);
        }
    );
}

export function loadProfilesAndTeamMembersAndChannelMembers(page, perPage, teamId = TeamStore.getCurrentId(), channelId = ChannelStore.getCurrentId(), success, error) {
    getProfilesInChannel(channelId, page, perPage)(dispatch, getState).then(
        (data) => {
            loadTeamMembersForProfilesList(
                data,
                teamId,
                () => {
                    loadChannelMembersForProfilesList(data, channelId, success, error);
                    loadStatusesForProfilesList(data);
                }
            );
        }
    );
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

export function loadProfilesWithoutTeam(page, perPage, success) {
    getProfilesWithoutTeam(page, perPage)(dispatch, getState).then(
        (data) => {
            loadStatusesForProfilesMap(data);

            if (success) {
                success(data);
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

function populateChannelWithProfiles(channelId, users) {
    for (let i = 0; i < users.length; i++) {
        UserStore.saveUserIdInChannel(channelId, users[i].id);
    }
    UserStore.emitInChannelChange();
}

export function loadNewDMIfNeeded(channelId) {
    function checkPreference(channel) {
        const userId = getUserIdFromChannelName(channel);

        if (!userId) {
            return;
        }

        const pref = PreferenceStore.getBool(Preferences.CATEGORY_DIRECT_CHANNEL_SHOW, userId, false);
        if (pref === false) {
            PreferenceStore.setPreference(Preferences.CATEGORY_DIRECT_CHANNEL_SHOW, userId, 'true');
            AsyncClient.savePreference(Preferences.CATEGORY_DIRECT_CHANNEL_SHOW, userId, 'true');
            loadProfilesForDM();
        }
    }

    const channel = ChannelStore.get(channelId);
    if (channel) {
        checkPreference(channel);
    } else {
        Client.getChannel(
            channelId,
            (data) => {
                AppDispatcher.handleServerAction({
                    type: ActionTypes.RECEIVED_CHANNEL,
                    channel: data.channel,
                    member: data.member
                });

                checkPreference(data.channel);
            },
            (err) => {
                AsyncClient.dispatchError(err, 'getChannel');
            }
       );
    }
}

export function loadNewGMIfNeeded(channelId) {
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

        getProfilesInChannel(channel.id, 0, Constants.MAX_USERS_IN_GM)(dispatch, getState).then(
            (data) => {
                populateChannelWithProfiles(channel.id, data);
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
        getProfilesByIds(profilesToLoad)(dispatch, getState).then(
            () => {
                populateDMChannelsWithProfiles(profileIds);
            },
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

export function searchUsers(term, teamId = TeamStore.getCurrentId(), options = {}, success) {
    searchProfiles(term, {team_id: teamId, ...options})(dispatch, getState).then(
        (data) => {
            loadStatusesForProfilesList(data);

            if (success) {
                success(data);
            }
        }
    );
}

export function searchUsersNotInTeam(term, teamId = TeamStore.getCurrentId(), options = {}, success) {
    searchProfiles(term, {not_in_team_id: teamId, ...options})(dispatch, getState).then(
        (data) => {
            loadStatusesForProfilesList(data);

            if (success) {
                success(data);
            }
        }
    );
}

export function autocompleteUsersInChannel(username, channelId, success) {
    const channel = ChannelStore.get(channelId);
    const teamId = channel ? channel.team_id : TeamStore.getCurrentId();
    autocompleteRedux(username, teamId, channelId)(dispatch, getState).then(
        (data) => {
            if (success) {
                success(data);
            }
        }
    );
}

export function autocompleteUsersInTeam(username, success) {
    autocompleteRedux(username, TeamStore.getCurrentId())(dispatch, getState).then(
        (data) => {
            if (success) {
                success(data);
            }
        }
    );
}

export function autocompleteUsers(username, success) {
    autocompleteRedux(username)(dispatch, getState).then(
        (data) => {
            if (success) {
                success(data);
            }
        }
    );
}

export function updateUser(user, type, success, error) {
    updateMe(user)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                error();
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

export function updateUserNotifyProps(props, success, error) {
    updateMe({notify_props: props})(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                error();
            }
        }
    );
}

export function updateUserRoles(userId, newRoles, success, error) {
    updateUserRoles(userId, newRoles)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                error();
            }
        }
    );
}

export function activateMfa(code, success, error) {
    updateUserMfa(UserStore.getCurrentId(), true, code)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                error();
            }
        },
    );
}

export function deactivateMfa(success, error) {
    updateUserMfa(UserStore.getCurrentId(), false)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                error();
            }
        },
    );
}

export function checkMfa(loginId, success, error) {
    if (global.window.mm_config.EnableMultifactorAuthentication !== 'true') {
        success(false);
        return;
    }

    checkMfaRedux(loginId)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                error();
            }
        }
    );
}

export function updateActive(userId, active, success, error) {
    Client.updateActive(userId, active,
        (data) => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_PROFILE,
                profile: data
            });

            if (success) {
                success(data);
            }
        },
        error
    );
}

export function updatePassword(userId, currentPassword, newPassword, success, error) {
    updateUserPassword(userId, currentPassword, newPassword)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                error();
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
    createUser(user, data, emailHash, inviteId)(dispatch, getState).then(
        (resp) => {
            if (resp && success) {
                success(resp);
            } else if (resp == null && error) {
                error();
            }
        }
    );
}

export function webLogin(loginId, password, token, success, error) {
    login(loginId, password, token)(dispatch, getState).then(
        (ok) => {
            if (ok && success) {
                localStorage.setItem('currentUserId', UserStore.getCurrentId());
                success();
            } else if (!ok && error) {
                error(getState().requests.users.login.error);
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
            getMe()(dispatch, getState);
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

export function loadProfiles(page, perPage, success) {
    getProfiles(page, perPage)(dispatch, getState).then(
        (data) => {
            if (success) {
                success(data);
            }
        }
    );
}

export function getMissingProfiles(ids) {
    const missingIds = ids.filter((id) => !UserStore.hasProfile(id));

    if (missingIds.length === 0) {
        return;
    }

    getProfilesByIds(missingIds)(dispatch, getState);
}

export function loadMyTeamMembers() {
    Client.getMyTeamMembers((data) => {
        AppDispatcher.handleServerAction({
            type: ActionTypes.RECEIVED_MY_TEAM_MEMBERS,
            team_members: data
        });
        AsyncClient.getMyTeamsUnread();
    }, (err) => {
        AsyncClient.dispatchError(err, 'getMyTeamMembers');
    });
}
