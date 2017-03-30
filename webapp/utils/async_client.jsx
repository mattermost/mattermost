// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import BrowserStore from 'stores/browser_store.jsx';
import ChannelStore from 'stores/channel_store.jsx';
import UserStore from 'stores/user_store.jsx';
import TeamStore from 'stores/team_store.jsx';
import ErrorStore from 'stores/error_store.jsx';

import * as GlobalActions from 'actions/global_actions.jsx';
import {loadStatusesForProfilesMap} from 'actions/status_actions.jsx';

import AppDispatcher from 'dispatcher/app_dispatcher.jsx';
import Client from 'client/web_client.jsx';
import * as utils from 'utils/utils.jsx';
import * as UserAgent from 'utils/user_agent.jsx';

import Constants from 'utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;
const StatTypes = Constants.StatTypes;

// Used to track in progress async calls
const callTracker = {};

const ASYNC_CLIENT_TIMEOUT = 5000;

export function dispatchError(err, method) {
    AppDispatcher.handleServerAction({
        type: ActionTypes.RECEIVED_ERROR,
        err,
        method
    });
}

function isCallInProgress(callName) {
    if (!(callName in callTracker)) {
        return false;
    }

    if (callTracker[callName] === 0) {
        return false;
    }

    if (utils.getTimestamp() - callTracker[callName] > ASYNC_CLIENT_TIMEOUT) {
        //console.log('AsyncClient call ' + callName + ' expired after more than 5 seconds');
        return false;
    }

    return true;
}

export function checkVersion() {
    var serverVersion = Client.getServerVersion();

    if (serverVersion !== BrowserStore.getLastServerVersion()) {
        if (!BrowserStore.getLastServerVersion() || BrowserStore.getLastServerVersion() === '') {
            BrowserStore.setLastServerVersion(serverVersion);
        } else {
            BrowserStore.setLastServerVersion(serverVersion);
            window.location.reload(true);
            console.log('Detected version update refreshing the page'); //eslint-disable-line no-console
        }
    }
}

export function getChannels() {
    return new Promise((resolve, reject) => {
        if (isCallInProgress('getChannels')) {
            resolve();
            return;
        }

        callTracker.getChannels = utils.getTimestamp();

        Client.getChannels(
            (data) => {
                callTracker.getChannels = 0;

                AppDispatcher.handleServerAction({
                    type: ActionTypes.RECEIVED_CHANNELS,
                    channels: data
                });
                resolve();
            },
            (err) => {
                callTracker.getChannels = 0;
                dispatchError(err, 'getChannels');
                reject(new Error('Unable to getChannels'));
            }
        );
    });
}

export function getChannel(id) {
    if (isCallInProgress('getChannel' + id)) {
        return;
    }

    callTracker['getChannel' + id] = utils.getTimestamp();

    Client.getChannel(id,
        (data) => {
            callTracker['getChannel' + id] = 0;

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_CHANNEL,
                channel: data.channel,
                member: data.member
            });
        },
        (err) => {
            callTracker['getChannel' + id] = 0;
            dispatchError(err, 'getChannel');
        }
    );
}

export function getMyChannelMembers() {
    return new Promise((resolve, reject) => {
        if (isCallInProgress('getMyChannelMembers')) {
            resolve();
            return;
        }

        callTracker.getMyChannelMembers = utils.getTimestamp();

        Client.getMyChannelMembers(
            (data) => {
                callTracker.getMyChannelMembers = 0;

                AppDispatcher.handleServerAction({
                    type: ActionTypes.RECEIVED_MY_CHANNEL_MEMBERS,
                    members: data
                });
                resolve();
            },
            (err) => {
                callTracker.getMyChannelMembers = 0;
                dispatchError(err, 'getMyChannelMembers');
                reject(new Error('Unable to getMyChannelMembers'));
            }
        );
    });
}

export function getMyChannelMembersForTeam(teamId) {
    return new Promise((resolve, reject) => {
        if (isCallInProgress(`getMyChannelMembers${teamId}`)) {
            resolve();
            return;
        }

        callTracker[`getMyChannelMembers${teamId}`] = utils.getTimestamp();

        Client.getMyChannelMembersForTeam(
            teamId,
            (data) => {
                callTracker[`getMyChannelMembers${teamId}`] = 0;

                AppDispatcher.handleServerAction({
                    type: ActionTypes.RECEIVED_MY_CHANNEL_MEMBERS,
                    members: data
                });
                resolve();
            },
            (err) => {
                callTracker[`getMyChannelMembers${teamId}`] = 0;
                dispatchError(err, 'getMyChannelMembersForTeam');
                reject(new Error('Unable to getMyChannelMembersForTeam'));
            }
        );
    });
}

export function viewChannel(channelId = ChannelStore.getCurrentId(), prevChannelId = '', time = 0) {
    if (channelId == null || !Client.teamId) {
        return;
    }

    if (isCallInProgress(`viewChannel${channelId}`)) {
        return;
    }

    callTracker[`viewChannel${channelId}`] = utils.getTimestamp();
    Client.viewChannel(
        channelId,
        prevChannelId,
        time,
        () => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_PREFERENCE,
                preference: {
                    category: 'last',
                    name: TeamStore.getCurrentId(),
                    value: channelId
                }
            });

            callTracker[`viewChannel${channelId}`] = 0;
            ErrorStore.clearLastError();
        },
        (err) => {
            callTracker[`viewChannel${channelId}`] = 0;
            const count = ErrorStore.getConnectionErrorCount();
            ErrorStore.setConnectionErrorCount(count + 1);
            dispatchError(err, 'viewChannel');
        }
    );
}

export function getMoreChannels(force) {
    if (isCallInProgress('getMoreChannels')) {
        return;
    }

    if (ChannelStore.getMoreAll().loading || force) {
        callTracker.getMoreChannels = utils.getTimestamp();
        Client.getMoreChannels(
            (data) => {
                callTracker.getMoreChannels = 0;

                AppDispatcher.handleServerAction({
                    type: ActionTypes.RECEIVED_MORE_CHANNELS,
                    channels: data
                });
            },
            (err) => {
                callTracker.getMoreChannels = 0;
                dispatchError(err, 'getMoreChannels');
            }
        );
    }
}

export function getMoreChannelsPage(offset, limit) {
    if (isCallInProgress('getMoreChannelsPage')) {
        return;
    }

    callTracker.getMoreChannelsPage = utils.getTimestamp();
    Client.getMoreChannelsPage(
        offset,
        limit,
        (data) => {
            callTracker.getMoreChannelsPage = 0;

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_MORE_CHANNELS,
                channels: data
            });
        },
        (err) => {
            callTracker.getMoreChannelsPage = 0;
            dispatchError(err, 'getMoreChannelsPage');
        }
    );
}

export function getChannelStats(channelId = ChannelStore.getCurrentId(), doVersionCheck = false) {
    if (isCallInProgress('getChannelStats' + channelId) || channelId == null) {
        return;
    }

    callTracker['getChannelStats' + channelId] = utils.getTimestamp();

    Client.getChannelStats(
        channelId,
        (data) => {
            callTracker['getChannelStats' + channelId] = 0;

            if (doVersionCheck) {
                checkVersion();
            }

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_CHANNEL_STATS,
                stats: data
            });
        },
        (err) => {
            callTracker['getChannelStats' + channelId] = 0;
            dispatchError(err, 'getChannelStats');
        }
    );
}

export function getChannelMember(channelId, userId) {
    return new Promise((resolve, reject) => {
        if (isCallInProgress(`getChannelMember${channelId}${userId}`)) {
            resolve();
            return;
        }

        callTracker[`getChannelMember${channelId}${userId}`] = utils.getTimestamp();

        Client.getChannelMember(
            channelId,
            userId,
            (data) => {
                callTracker[`getChannelMember${channelId}${userId}`] = 0;

                AppDispatcher.handleServerAction({
                    type: ActionTypes.RECEIVED_CHANNEL_MEMBER,
                    member: data
                });
                resolve();
            },
            (err) => {
                callTracker[`getChannelMember${channelId}${userId}`] = 0;
                dispatchError(err, 'getChannelMember');
                reject(new Error('Unable to getChannelMeber'));
            }
        );
    });
}

export function getUser(userId, success, error) {
    const callName = `getUser${userId}`;

    if (isCallInProgress(callName)) {
        return;
    }

    callTracker[callName] = utils.getTimestamp();
    Client.getUser(
        userId,
        (data) => {
            callTracker[callName] = 0;

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_PROFILE,
                profile: data
            });

            if (success) {
                success(data);
            }
        },
        (err) => {
            if (error) {
                error(err);
            } else {
                callTracker[callName] = 0;
                dispatchError(err, 'getUser');
            }
        }
    );
}

export function getProfiles(offset = UserStore.getPagingOffset(), limit = Constants.PROFILE_CHUNK_SIZE) {
    const callName = `getProfiles${offset}${limit}`;

    if (isCallInProgress(callName)) {
        return;
    }

    callTracker[callName] = utils.getTimestamp();
    Client.getProfiles(
        offset,
        limit,
        (data) => {
            callTracker[callName] = 0;

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_PROFILES,
                profiles: data
            });
        },
        (err) => {
            callTracker[callName] = 0;
            dispatchError(err, 'getProfiles');
        }
    );
}

export function getProfilesInTeam(teamId = TeamStore.getCurrentId(), offset = UserStore.getInTeamPagingOffset(), limit = Constants.PROFILE_CHUNK_SIZE) {
    const callName = `getProfilesInTeam${teamId}${offset}${limit}`;

    if (isCallInProgress(callName)) {
        return;
    }

    callTracker[callName] = utils.getTimestamp();
    Client.getProfilesInTeam(
        teamId,
        offset,
        limit,
        (data) => {
            callTracker[callName] = 0;

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_PROFILES_IN_TEAM,
                profiles: data,
                team_id: teamId,
                offset,
                count: Object.keys(data).length
            });
        },
        (err) => {
            callTracker[callName] = 0;
            dispatchError(err, 'getProfilesInTeam');
        }
    );
}

export function getProfilesInChannel(channelId = ChannelStore.getCurrentId(), offset = UserStore.getInChannelPagingOffset(), limit = Constants.PROFILE_CHUNK_SIZE) {
    const callName = `getProfilesInChannel${channelId}${offset}${limit}`;

    if (isCallInProgress()) {
        return;
    }

    callTracker[callName] = utils.getTimestamp();
    Client.getProfilesInChannel(
        channelId,
        offset,
        limit,
        (data) => {
            callTracker[callName] = 0;

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_PROFILES_IN_CHANNEL,
                channel_id: channelId,
                profiles: data,
                offset,
                count: Object.keys(data).length
            });

            loadStatusesForProfilesMap(data);
        },
        (err) => {
            callTracker[callName] = 0;
            dispatchError(err, 'getProfilesInChannel');
        }
    );
}

export function getProfilesNotInChannel(channelId = ChannelStore.getCurrentId(), offset = UserStore.getNotInChannelPagingOffset(), limit = Constants.PROFILE_CHUNK_SIZE) {
    const callName = `getProfilesNotInChannel${channelId}${offset}${limit}`;

    if (isCallInProgress(callName)) {
        return;
    }

    callTracker[callName] = utils.getTimestamp();
    Client.getProfilesNotInChannel(
        channelId,
        offset,
        limit,
        (data) => {
            callTracker[callName] = 0;

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_PROFILES_NOT_IN_CHANNEL,
                channel_id: channelId,
                profiles: data,
                offset,
                count: Object.keys(data).length
            });

            loadStatusesForProfilesMap(data);
        },
        (err) => {
            callTracker[callName] = 0;
            dispatchError(err, 'getProfilesNotInChannel');
        }
    );
}

export function getProfilesByIds(userIds) {
    const callName = 'getProfilesByIds' + JSON.stringify(userIds);

    if (isCallInProgress(callName)) {
        return;
    }

    if (!userIds || userIds.length === 0) {
        return;
    }

    callTracker[callName] = utils.getTimestamp();
    Client.getProfilesByIds(
        userIds,
        (data) => {
            callTracker[callName] = 0;

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_PROFILES,
                profiles: data
            });
        },
        (err) => {
            callTracker[callName] = 0;
            dispatchError(err, 'getProfilesByIds');
        }
    );
}

export function getSessions() {
    if (isCallInProgress('getSessions')) {
        return;
    }

    callTracker.getSessions = utils.getTimestamp();
    Client.getSessions(
        UserStore.getCurrentId(),
        (data) => {
            callTracker.getSessions = 0;

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_SESSIONS,
                sessions: data
            });
        },
        (err) => {
            callTracker.getSessions = 0;
            dispatchError(err, 'getSessions');
        }
    );
}

export function getAudits() {
    if (isCallInProgress('getAudits')) {
        return;
    }

    callTracker.getAudits = utils.getTimestamp();
    Client.getAudits(
        UserStore.getCurrentId(),
        (data) => {
            callTracker.getAudits = 0;

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_AUDITS,
                audits: data
            });
        },
        (err) => {
            callTracker.getAudits = 0;
            dispatchError(err, 'getAudits');
        }
    );
}

export function getLogs() {
    if (isCallInProgress('getLogs')) {
        return;
    }

    callTracker.getLogs = utils.getTimestamp();
    Client.getLogs(
        (data) => {
            callTracker.getLogs = 0;

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_LOGS,
                logs: data
            });
        },
        (err) => {
            callTracker.getLogs = 0;
            dispatchError(err, 'getLogs');
        }
    );
}

export function getServerAudits() {
    if (isCallInProgress('getServerAudits')) {
        return;
    }

    callTracker.getServerAudits = utils.getTimestamp();
    Client.getServerAudits(
        (data) => {
            callTracker.getServerAudits = 0;

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_SERVER_AUDITS,
                audits: data
            });
        },
        (err) => {
            callTracker.getServerAudits = 0;
            dispatchError(err, 'getServerAudits');
        }
    );
}

export function getComplianceReports() {
    if (isCallInProgress('getComplianceReports')) {
        return;
    }

    callTracker.getComplianceReports = utils.getTimestamp();
    Client.getComplianceReports(
        (data) => {
            callTracker.getComplianceReports = 0;

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_SERVER_COMPLIANCE_REPORTS,
                complianceReports: data
            });
        },
        (err) => {
            callTracker.getComplianceReports = 0;
            dispatchError(err, 'getComplianceReports');
        }
    );
}

export function getConfig(success, error) {
    if (isCallInProgress('getConfig')) {
        return;
    }

    callTracker.getConfig = utils.getTimestamp();
    Client.getConfig(
        (data) => {
            callTracker.getConfig = 0;

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_CONFIG,
                config: data,
                clusterId: Client.clusterId
            });

            if (success) {
                success(data);
            }
        },
        (err) => {
            callTracker.getConfig = 0;

            if (!error) {
                dispatchError(err, 'getConfig');
            }
        }
    );
}

export function getAllTeams() {
    if (isCallInProgress('getAllTeams')) {
        return;
    }

    callTracker.getAllTeams = utils.getTimestamp();
    Client.getAllTeams(
        (data) => {
            callTracker.getAllTeams = 0;

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_ALL_TEAMS,
                teams: data
            });
        },
        (err) => {
            callTracker.getAllTeams = 0;
            dispatchError(err, 'getAllTeams');
        }
    );
}

export function getAllTeamListings() {
    if (isCallInProgress('getAllTeamListings')) {
        return;
    }

    callTracker.getAllTeamListings = utils.getTimestamp();
    Client.getAllTeamListings(
        (data) => {
            callTracker.getAllTeamListings = 0;

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_ALL_TEAM_LISTINGS,
                teams: data
            });
        },
        (err) => {
            callTracker.getAllTeams = 0;
            dispatchError(err, 'getAllTeamListings');
        }
    );
}

export function search(terms, isOrSearch) {
    if (isCallInProgress('search_' + String(terms))) {
        return;
    }

    callTracker['search_' + String(terms)] = utils.getTimestamp();
    Client.search(
        terms,
        isOrSearch,
        (data) => {
            callTracker['search_' + String(terms)] = 0;

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_SEARCH,
                results: data
            });
        },
        (err) => {
            callTracker['search_' + String(terms)] = 0;
            dispatchError(err, 'search');
        }
    );
}

export function getFileInfosForPost(channelId, postId) {
    const callName = 'getFileInfosForPost' + postId;

    if (isCallInProgress(callName)) {
        return;
    }

    callTracker[callName] = utils.getTimestamp();
    Client.getFileInfosForPost(
        channelId,
        postId,
        (data) => {
            callTracker[callName] = 0;

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_FILE_INFOS,
                postId,
                infos: data
            });
        },
        (err) => {
            callTracker[callName] = 0;
            dispatchError(err, 'getPostFile');
        }
    );
}

export function getMe() {
    if (isCallInProgress('getMe')) {
        return null;
    }

    callTracker.getMe = utils.getTimestamp();
    return Client.getMe(
        (data) => {
            callTracker.getMe = 0;

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_ME,
                me: data
            });

            GlobalActions.newLocalizationSelected(data.locale);
        },
        (err) => {
            callTracker.getMe = 0;
            dispatchError(err, 'getMe');
        }
    );
}

export function getStatuses() {
    if (isCallInProgress('getStatuses')) {
        return;
    }

    callTracker.getStatuses = utils.getTimestamp();
    Client.getStatuses(
        (data) => {
            callTracker.getStatuses = 0;

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_STATUSES,
                statuses: data
            });
        },
        (err) => {
            callTracker.getStatuses = 0;
            dispatchError(err, 'getStatuses');
        }
    );
}

export function getMyTeam() {
    if (isCallInProgress('getMyTeam')) {
        return null;
    }

    callTracker.getMyTeam = utils.getTimestamp();
    return Client.getMyTeam(
        (data) => {
            callTracker.getMyTeam = 0;

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_MY_TEAM,
                team: data
            });
        },
        (err) => {
            callTracker.getMyTeam = 0;
            dispatchError(err, 'getMyTeam');
        }
    );
}

export function getTeamMember(teamId, userId) {
    const callName = `getTeamMember${teamId}${userId}`;
    if (isCallInProgress(callName)) {
        return;
    }

    callTracker[callName] = utils.getTimestamp();
    Client.getTeamMember(
        teamId,
        userId,
        (data) => {
            callTracker[callName] = 0;

            const memberMap = {};
            memberMap[userId] = data;

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_MEMBERS_IN_TEAM,
                team_id: teamId,
                team_members: memberMap
            });
        },
        (err) => {
            callTracker[callName] = 0;
            dispatchError(err, 'getTeamMember');
        }
    );
}

export function getMyTeamMembers() {
    const callName = 'getMyTeamMembers';
    if (isCallInProgress(callName)) {
        return;
    }

    callTracker[callName] = utils.getTimestamp();
    Client.getMyTeamMembers(
        (data) => {
            callTracker[callName] = 0;

            const members = {};
            for (const member of data) {
                members[member.team_id] = member;
            }

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_MY_TEAM_MEMBERS_UNREAD,
                team_members: members
            });
        },
        (err) => {
            callTracker[callName] = 0;
            dispatchError(err, 'getMyTeamMembers');
        }
    );
}

export function getMyTeamsUnread(teamId) {
    const members = TeamStore.getMyTeamMembers();
    if (members.length > 1) {
        const callName = 'getMyTeamsUnread';
        if (isCallInProgress(callName)) {
            return;
        }

        callTracker[callName] = utils.getTimestamp();
        Client.getMyTeamsUnread(
            teamId,
            (data) => {
                callTracker[callName] = 0;

                AppDispatcher.handleServerAction({
                    type: ActionTypes.RECEIVED_MY_TEAMS_UNREAD,
                    team_members: data
                });
            },
            (err) => {
                callTracker[callName] = 0;
                dispatchError(err, 'getMyTeamsUnread');
            }
        );
    }
}

export function getTeamStats(teamId) {
    const callName = `getTeamStats${teamId}`;
    if (isCallInProgress(callName)) {
        return;
    }

    callTracker[callName] = utils.getTimestamp();
    Client.getTeamStats(
        teamId,
        (data) => {
            callTracker[callName] = 0;

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_TEAM_STATS,
                team_id: teamId,
                stats: data
            });
        },
        (err) => {
            callTracker[callName] = 0;
            dispatchError(err, 'getTeamStats');
        }
    );
}

export function getAllPreferences() {
    if (isCallInProgress('getAllPreferences')) {
        return;
    }

    callTracker.getAllPreferences = utils.getTimestamp();
    Client.getAllPreferences(
        (data) => {
            callTracker.getAllPreferences = 0;

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_PREFERENCES,
                preferences: data
            });
        },
        (err) => {
            callTracker.getAllPreferences = 0;
            dispatchError(err, 'getAllPreferences');
        }
    );
}

export function savePreference(category, name, value, success, error) {
    const preference = {
        user_id: UserStore.getCurrentId(),
        category,
        name,
        value
    };

    savePreferences([preference], success, error);
}

export function savePreferences(preferences, success, error) {
    Client.savePreferences(
        preferences,
        (data) => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_PREFERENCES,
                preferences
            });

            if (success) {
                success(data);
            }
        },
        (err) => {
            dispatchError(err, 'savePreferences');

            if (error) {
                error();
            }
        }
    );
}

export function deletePreferences(preferences, success, error) {
    Client.deletePreferences(
        preferences,
        (data) => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.DELETED_PREFERENCES,
                preferences
            });

            if (success) {
                success(data);
            }
        },
        (err) => {
            dispatchError(err, 'deletePreferences');

            if (error) {
                error();
            }
        }
    );
}

export function getSuggestedCommands(command, suggestionId, component) {
    Client.listCommands(
        (data) => {
            var matches = [];
            data.forEach((cmd) => {
                if (cmd.trigger !== 'shortcuts' || !UserAgent.isMobile()) {
                    if (('/' + cmd.trigger).indexOf(command) === 0) {
                        const s = '/' + cmd.trigger;
                        let hint = '';
                        if (cmd.auto_complete_hint && cmd.auto_complete_hint.length !== 0) {
                            hint = cmd.auto_complete_hint;
                        }
                        matches.push({
                            suggestion: s,
                            hint,
                            description: cmd.auto_complete_desc
                        });
                    }
                }
            });

            matches = matches.sort((a, b) => a.suggestion.localeCompare(b.suggestion));

            // pull out the suggested commands from the returned data
            const terms = matches.map((suggestion) => suggestion.suggestion);

            if (terms.length > 0) {
                AppDispatcher.handleServerAction({
                    type: ActionTypes.SUGGESTION_RECEIVED_SUGGESTIONS,
                    id: suggestionId,
                    matchedPretext: command,
                    terms,
                    items: matches,
                    component
                });
            }
        },
        (err) => {
            dispatchError(err, 'getSuggestedCommands');
        }
    );
}

export function getStandardAnalytics(teamId) {
    const callName = 'getStandardAnaytics' + teamId;

    if (isCallInProgress(callName)) {
        return;
    }

    callTracker[callName] = utils.getTimestamp();

    Client.getAnalytics(
        'standard',
        teamId,
        (data) => {
            callTracker[callName] = 0;

            const stats = {};

            for (const index in data) {
                if (data[index].name === 'channel_open_count') {
                    stats[StatTypes.TOTAL_PUBLIC_CHANNELS] = data[index].value;
                }

                if (data[index].name === 'channel_private_count') {
                    stats[StatTypes.TOTAL_PRIVATE_GROUPS] = data[index].value;
                }

                if (data[index].name === 'post_count') {
                    stats[StatTypes.TOTAL_POSTS] = data[index].value;
                }

                if (data[index].name === 'unique_user_count') {
                    stats[StatTypes.TOTAL_USERS] = data[index].value;
                }

                if (data[index].name === 'team_count' && teamId == null) {
                    stats[StatTypes.TOTAL_TEAMS] = data[index].value;
                }

                if (data[index].name === 'total_websocket_connections') {
                    stats[StatTypes.TOTAL_WEBSOCKET_CONNECTIONS] = data[index].value;
                }

                if (data[index].name === 'total_master_db_connections') {
                    stats[StatTypes.TOTAL_MASTER_DB_CONNECTIONS] = data[index].value;
                }

                if (data[index].name === 'total_read_db_connections') {
                    stats[StatTypes.TOTAL_READ_DB_CONNECTIONS] = data[index].value;
                }

                if (data[index].name === 'daily_active_users') {
                    stats[StatTypes.DAILY_ACTIVE_USERS] = data[index].value;
                }

                if (data[index].name === 'monthly_active_users') {
                    stats[StatTypes.MONTHLY_ACTIVE_USERS] = data[index].value;
                }
            }

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_ANALYTICS,
                teamId,
                stats
            });
        },
        (err) => {
            callTracker[callName] = 0;

            dispatchError(err, 'getStandardAnalytics');
        }
    );
}

export function getAdvancedAnalytics(teamId) {
    const callName = 'getAdvancedAnalytics' + teamId;

    if (isCallInProgress(callName)) {
        return;
    }

    callTracker[callName] = utils.getTimestamp();

    Client.getAnalytics(
        'extra_counts',
        teamId,
        (data) => {
            callTracker[callName] = 0;

            const stats = {};

            for (const index in data) {
                if (data[index].name === 'file_post_count') {
                    stats[StatTypes.TOTAL_FILE_POSTS] = data[index].value;
                }

                if (data[index].name === 'hashtag_post_count') {
                    stats[StatTypes.TOTAL_HASHTAG_POSTS] = data[index].value;
                }

                if (data[index].name === 'incoming_webhook_count') {
                    stats[StatTypes.TOTAL_IHOOKS] = data[index].value;
                }

                if (data[index].name === 'outgoing_webhook_count') {
                    stats[StatTypes.TOTAL_OHOOKS] = data[index].value;
                }

                if (data[index].name === 'command_count') {
                    stats[StatTypes.TOTAL_COMMANDS] = data[index].value;
                }

                if (data[index].name === 'session_count') {
                    stats[StatTypes.TOTAL_SESSIONS] = data[index].value;
                }
            }

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_ANALYTICS,
                teamId,
                stats
            });
        },
        (err) => {
            callTracker[callName] = 0;

            dispatchError(err, 'getAdvancedAnalytics');
        }
    );
}

export function getPostsPerDayAnalytics(teamId) {
    const callName = 'getPostsPerDayAnalytics' + teamId;

    if (isCallInProgress(callName)) {
        return;
    }

    callTracker[callName] = utils.getTimestamp();

    Client.getAnalytics(
        'post_counts_day',
        teamId,
        (data) => {
            callTracker[callName] = 0;

            data.reverse();

            const stats = {};
            stats[StatTypes.POST_PER_DAY] = data;

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_ANALYTICS,
                teamId,
                stats
            });
        },
        (err) => {
            callTracker[callName] = 0;

            dispatchError(err, 'getPostsPerDayAnalytics');
        }
    );
}

export function getUsersPerDayAnalytics(teamId) {
    const callName = 'getUsersPerDayAnalytics' + teamId;

    if (isCallInProgress(callName)) {
        return;
    }

    callTracker[callName] = utils.getTimestamp();

    Client.getAnalytics(
        'user_counts_with_posts_day',
        teamId,
        (data) => {
            callTracker[callName] = 0;

            data.reverse();

            const stats = {};
            stats[StatTypes.USERS_WITH_POSTS_PER_DAY] = data;

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_ANALYTICS,
                teamId,
                stats
            });
        },
        (err) => {
            callTracker[callName] = 0;

            dispatchError(err, 'getUsersPerDayAnalytics');
        }
    );
}

export function getRecentAndNewUsersAnalytics(teamId) {
    const callName = 'getRecentAndNewUsersAnalytics' + teamId;

    if (isCallInProgress(callName)) {
        return;
    }

    callTracker[callName] = utils.getTimestamp();

    Client.getRecentlyActiveUsers(
        teamId,
        (users) => {
            const stats = {};

            const usersList = [];
            for (const id in users) {
                if (users.hasOwnProperty(id)) {
                    usersList.push(users[id]);
                }
            }

            usersList.sort((a, b) => {
                if (a.last_activity_at < b.last_activity_at) {
                    return 1;
                }

                if (a.last_activity_at > b.last_activity_at) {
                    return -1;
                }

                return 0;
            });

            const recentActive = [];
            for (let i = 0; i < usersList.length; i++) {
                if (usersList[i].last_activity_at == null) {
                    continue;
                }

                recentActive.push(usersList[i]);
                if (i >= Constants.STAT_MAX_ACTIVE_USERS) {
                    break;
                }
            }

            stats[StatTypes.RECENTLY_ACTIVE_USERS] = recentActive;

            usersList.sort((a, b) => {
                if (a.create_at < b.create_at) {
                    return 1;
                }

                if (a.create_at > b.create_at) {
                    return -1;
                }

                return 0;
            });

            var newlyCreated = [];
            for (let i = 0; i < usersList.length; i++) {
                newlyCreated.push(usersList[i]);
                if (i >= Constants.STAT_MAX_NEW_USERS) {
                    break;
                }
            }

            stats[StatTypes.NEWLY_CREATED_USERS] = newlyCreated;

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_ANALYTICS,
                teamId,
                stats
            });
            callTracker[callName] = 0;
        },
        (err) => {
            callTracker[callName] = 0;

            dispatchError(err, 'getRecentAndNewUsersAnalytics');
        }
    );
}

export function addIncomingHook(hook, success, error) {
    Client.addIncomingHook(
        hook,
        (data) => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_INCOMING_WEBHOOK,
                incomingWebhook: data
            });

            if (success) {
                success(data);
            }
        },
        (err) => {
            if (error) {
                error(err);
            } else {
                dispatchError(err, 'addIncomingHook');
            }
        }
    );
}

export function updateIncomingHook(hook, success, error) {
    Client.updateIncomingHook(
        hook,
        (data) => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.UPDATED_INCOMING_WEBHOOK,
                incomingWebhook: data
            });

            if (success) {
                success(data);
            }
        },
        (err) => {
            if (error) {
                error(err);
            } else {
                dispatchError(err, 'updateIncomingHook');
            }
        }
    );
}

export function addOutgoingHook(hook, success, error) {
    Client.addOutgoingHook(
        hook,
        (data) => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_OUTGOING_WEBHOOK,
                outgoingWebhook: data
            });

            if (success) {
                success(data);
            }
        },
        (err) => {
            if (error) {
                error(err);
            } else {
                dispatchError(err, 'addOutgoingHook');
            }
        }
    );
}

export function updateOutgoingHook(hook, success, error) {
    Client.updateOutgoingHook(
        hook,
        (data) => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.UPDATED_OUTGOING_WEBHOOK,
                outgoingWebhook: data
            });

            if (success) {
                success(data);
            }
        },
        (err) => {
            if (error) {
                error(err);
            } else {
                dispatchError(err, 'updateOutgoingHook');
            }
        }
    );
}

export function deleteIncomingHook(id) {
    Client.deleteIncomingHook(
        id,
        () => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.REMOVED_INCOMING_WEBHOOK,
                teamId: Client.teamId,
                id
            });
        },
        (err) => {
            dispatchError(err, 'deleteIncomingHook');
        }
    );
}

export function deleteOutgoingHook(id) {
    Client.deleteOutgoingHook(
        id,
        () => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.REMOVED_OUTGOING_WEBHOOK,
                teamId: Client.teamId,
                id
            });
        },
        (err) => {
            dispatchError(err, 'deleteOutgoingHook');
        }
    );
}

export function regenOutgoingHookToken(id) {
    Client.regenOutgoingHookToken(
        id,
        (data) => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.UPDATED_OUTGOING_WEBHOOK,
                outgoingWebhook: data
            });
        },
        (err) => {
            dispatchError(err, 'regenOutgoingHookToken');
        }
    );
}

export function addCommand(command, success, error) {
    Client.addCommand(
        command,
        (data) => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_COMMAND,
                command: data
            });

            if (success) {
                success(data);
            }
        },
        (err) => {
            if (error) {
                error(err);
            } else {
                dispatchError(err, 'addCommand');
            }
        }
    );
}

export function editCommand(command, success, error) {
    Client.editCommand(
        command,
        (data) => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.UPDATED_COMMAND,
                command: data
            });

            if (success) {
                success(data);
            }
        },
        (err) => {
            if (error) {
                error(err);
            } else {
                dispatchError(err, 'editCommand');
            }
        }
    );
}

export function deleteCommand(id) {
    Client.deleteCommand(
        id,
        () => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.REMOVED_COMMAND,
                teamId: Client.teamId,
                id
            });
        },
        (err) => {
            dispatchError(err, 'deleteCommand');
        }
    );
}

export function regenCommandToken(id) {
    Client.regenCommandToken(
        id,
        (data) => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.UPDATED_COMMAND,
                command: data
            });
        },
        (err) => {
            dispatchError(err, 'regenCommandToken');
        }
    );
}

export function getPublicLink(fileId, success, error) {
    const callName = 'getPublicLink' + fileId;

    if (isCallInProgress(callName)) {
        return;
    }

    callTracker[callName] = utils.getTimestamp();

    Client.getPublicLink(
        fileId,
        (link) => {
            callTracker[callName] = 0;

            success(link);
        },
        (err) => {
            callTracker[callName] = 0;

            if (error) {
                error(err);
            } else {
                dispatchError(err, 'getPublicLink');
            }
        }
    );
}

export function addEmoji(emoji, image, success, error) {
    const callName = 'addEmoji' + emoji.name;

    if (isCallInProgress(callName)) {
        return;
    }

    callTracker[callName] = utils.getTimestamp();

    Client.addEmoji(
        emoji,
        image,
        (data) => {
            callTracker[callName] = 0;

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_CUSTOM_EMOJI,
                emoji: data
            });

            if (success) {
                success();
            }
        },
        (err) => {
            callTracker[callName] = 0;

            if (error) {
                error(err);
            } else {
                dispatchError(err, 'addEmoji');
            }
        }
    );
}

export function deleteEmoji(id) {
    const callName = 'deleteEmoji' + id;

    if (isCallInProgress(callName)) {
        return;
    }

    callTracker[callName] = utils.getTimestamp();

    Client.deleteEmoji(
        id,
        () => {
            callTracker[callName] = 0;

            AppDispatcher.handleServerAction({
                type: ActionTypes.REMOVED_CUSTOM_EMOJI,
                id
            });
        },
        (err) => {
            callTracker[callName] = 0;
            dispatchError(err, 'deleteEmoji');
        }
    );
}

export function pinPost(channelId, reaction) {
    Client.pinPost(
        channelId,
        reaction,
        () => {
            // the "post_edited" websocket event take cares of updating the posts
            // the action below is mostly dispatched for the RHS to update
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_POST_PINNED
            });
        },
        (err) => {
            dispatchError(err, 'pinPost');
        }
    );
}

export function unpinPost(channelId, reaction) {
    Client.unpinPost(
        channelId,
        reaction,
        () => {
            // the "post_edited" websocket event take cares of updating the posts
            // the action below is mostly dispatched for the RHS to update
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_POST_UNPINNED
            });
        },
        (err) => {
            dispatchError(err, 'unpinPost');
        }
    );
}

export function saveReaction(channelId, reaction) {
    Client.saveReaction(
        channelId,
        reaction,
        null, // the added reaction will be sent over the websocket
        (err) => {
            dispatchError(err, 'saveReaction');
        }
    );
}

export function deleteReaction(channelId, reaction) {
    Client.deleteReaction(
        channelId,
        reaction,
        null, // the removed reaction will be sent over the websocket
        (err) => {
            dispatchError(err, 'deleteReaction');
        }
    );
}

export function listReactions(channelId, postId) {
    const callName = 'deleteEmoji' + postId;

    if (isCallInProgress(callName)) {
        return;
    }

    callTracker[callName] = utils.getTimestamp();

    Client.listReactions(
        channelId,
        postId,
        (data) => {
            callTracker[callName] = 0;

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_REACTIONS,
                postId,
                reactions: data
            });
        },
        (err) => {
            callTracker[callName] = 0;
            dispatchError(err, 'listReactions');
        }
    );
}
