// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import Client from 'client/web_client.jsx';
import * as GlobalActions from 'actions/global_actions.jsx';
import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import BrowserStore from 'stores/browser_store.jsx';
import ChannelStore from 'stores/channel_store.jsx';
import PostStore from 'stores/post_store.jsx';
import UserStore from 'stores/user_store.jsx';
import * as utils from './utils.jsx';
import ErrorStore from 'stores/error_store.jsx';

import Constants from './constants.jsx';
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

export function getChannels(doVersionCheck) {
    if (isCallInProgress('getChannels')) {
        return null;
    }

    callTracker.getChannels = utils.getTimestamp();

    return Client.getChannels(
        (data) => {
            callTracker.getChannels = 0;

            if (doVersionCheck) {
                checkVersion();
            }

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_CHANNELS,
                channels: data.channels,
                members: data.members
            });
        },
        (err) => {
            callTracker.getChannels = 0;
            dispatchError(err, 'getChannels');
        }
    );
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

export function updateLastViewedAt(id) {
    let channelId;
    if (id) {
        channelId = id;
    } else {
        channelId = ChannelStore.getCurrentId();
    }

    if (channelId == null) {
        return;
    }

    if (isCallInProgress(`updateLastViewed${channelId}`)) {
        return;
    }

    callTracker[`updateLastViewed${channelId}`] = utils.getTimestamp();
    Client.updateLastViewedAt(
        channelId,
        () => {
            callTracker.updateLastViewed = 0;
            ErrorStore.clearLastError();
        },
        (err) => {
            callTracker.updateLastViewed = 0;
            var count = ErrorStore.getConnectionErrorCount();
            ErrorStore.setConnectionErrorCount(count + 1);
            dispatchError(err, 'updateLastViewedAt');
        }
    );
}

export function setLastViewedAt(lastViewedAt, id) {
    let channelId;
    if (id) {
        channelId = id;
    } else {
        channelId = ChannelStore.getCurrentId();
    }

    if (channelId == null) {
        return;
    }

    if (lastViewedAt == null) {
        return;
    }

    if (isCallInProgress(`setLastViewedAt${channelId}${lastViewedAt}`)) {
        return;
    }

    callTracker[`setLastViewedAt${channelId}${lastViewedAt}`] = utils.getTimestamp();
    Client.setLastViewedAt(
        channelId,
        lastViewedAt,
        () => {
            callTracker.setLastViewedAt = 0;
            ErrorStore.clearLastError();
        },
        (err) => {
            callTracker.setLastViewedAt = 0;
            var count = ErrorStore.getConnectionErrorCount();
            ErrorStore.setConnectionErrorCount(count + 1);
            dispatchError(err, 'setLastViewedAt');
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
                    channels: data.channels,
                    members: data.members
                });
            },
            (err) => {
                callTracker.getMoreChannels = 0;
                dispatchError(err, 'getMoreChannels');
            }
        );
    }
}

export function getChannelExtraInfo(id, memberLimit) {
    let channelId;
    if (id) {
        channelId = id;
    } else {
        channelId = ChannelStore.getCurrentId();
    }

    if (channelId != null) {
        if (isCallInProgress('getChannelExtraInfo_' + channelId)) {
            return;
        }

        callTracker['getChannelExtraInfo_' + channelId] = utils.getTimestamp();

        Client.getChannelExtraInfo(
            channelId,
            memberLimit,
            (data) => {
                callTracker['getChannelExtraInfo_' + channelId] = 0;

                AppDispatcher.handleServerAction({
                    type: ActionTypes.RECEIVED_CHANNEL_EXTRA_INFO,
                    extra_info: data
                });
            },
            (err) => {
                callTracker['getChannelExtraInfo_' + channelId] = 0;
                dispatchError(err, 'getChannelExtraInfo');
            }
        );
    }
}

export function getTeamMembers(teamId) {
    if (isCallInProgress('getTeamMembers')) {
        return;
    }

    callTracker.getTeamMembers = utils.getTimestamp();
    Client.getTeamMembers(
        teamId,
        (data) => {
            callTracker.getTeamMembers = 0;

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_MEMBERS_FOR_TEAM,
                team_members: data
            });
        },
        (err) => {
            callTracker.getTeamMembers = 0;
            dispatchError(err, 'getTeamMembers');
        }
    );
}

export function getProfilesForDirectMessageList() {
    if (isCallInProgress('getProfilesForDirectMessageList')) {
        return;
    }

    callTracker.getProfilesForDirectMessageList = utils.getTimestamp();
    Client.getProfilesForDirectMessageList(
        (data) => {
            callTracker.getProfilesForDirectMessageList = 0;

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_PROFILES_FOR_DM_LIST,
                profiles: data
            });
        },
        (err) => {
            callTracker.getProfilesForDirectMessageList = 0;
            dispatchError(err, 'getProfilesForDirectMessageList');
        }
    );
}

export function getProfiles() {
    if (isCallInProgress('getProfiles')) {
        return;
    }

    callTracker.getProfiles = utils.getTimestamp();
    Client.getProfiles(
        (data) => {
            callTracker.getProfiles = 0;

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_PROFILES,
                profiles: data
            });
        },
        (err) => {
            callTracker.getProfiles = 0;
            dispatchError(err, 'getProfiles');
        }
    );
}

export function getDirectProfiles() {
    if (isCallInProgress('getDirectProfiles')) {
        return;
    }

    callTracker.getDirectProfiles = utils.getTimestamp();
    Client.getDirectProfiles(
        (data) => {
            callTracker.getDirectProfiles = 0;

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_DIRECT_PROFILES,
                profiles: data
            });
        },
        (err) => {
            callTracker.getDirectProfiles = 0;
            dispatchError(err, 'getDirectProfiles');
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

export function getPostsPage(id, maxPosts) {
    let channelId = id;
    if (channelId == null) {
        channelId = ChannelStore.getCurrentId();
        if (channelId == null) {
            return;
        }
    }

    if (isCallInProgress('getPostsPage_' + channelId)) {
        return;
    }

    var postList = PostStore.getAllPosts(id);

    var max = maxPosts;
    if (max == null) {
        max = Constants.POST_CHUNK_SIZE * Constants.MAX_POST_CHUNKS;
    }

    // if we already have more than POST_CHUNK_SIZE posts,
    //   let's get the amount we have but rounded up to next multiple of POST_CHUNK_SIZE,
    //   with a max at maxPosts
    var numPosts = Math.min(max, Constants.POST_CHUNK_SIZE);
    if (postList && postList.order.length > 0) {
        numPosts = Math.min(max, Constants.POST_CHUNK_SIZE * Math.ceil(postList.order.length / Constants.POST_CHUNK_SIZE));
    }

    if (channelId != null) {
        callTracker['getPostsPage_' + channelId] = utils.getTimestamp();

        Client.getPostsPage(
            channelId,
            0,
            numPosts,
            (data) => {
                AppDispatcher.handleServerAction({
                    type: ActionTypes.RECEIVED_POSTS,
                    id: channelId,
                    before: true,
                    numRequested: numPosts,
                    post_list: data
                });

                getProfiles();
            },
            (err) => {
                dispatchError(err, 'getPostsPage');
            },
            () => {
                callTracker['getPostsPage_' + channelId] = 0;
            }
        );
    }
}

export function getPosts(id) {
    let channelId = id;
    if (channelId == null) {
        channelId = ChannelStore.getCurrentId();
        if (channelId == null) {
            return;
        }
    }

    if (isCallInProgress('getPosts_' + channelId)) {
        return;
    }

    const postList = PostStore.getAllPosts(channelId);

    if ($.isEmptyObject(postList) || postList.order.length < Constants.POST_CHUNK_SIZE) {
        getPostsPage(channelId, Constants.POST_CHUNK_SIZE);
        return;
    }

    const latestPost = PostStore.getLatestPost(channelId);
    let latestPostTime = 0;

    if (latestPost != null && latestPost.update_at != null) {
        latestPostTime = latestPost.create_at;
    }

    callTracker['getPosts_' + channelId] = utils.getTimestamp();

    Client.getPosts(
        channelId,
        latestPostTime,
        (data) => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_POSTS,
                id: channelId,
                before: true,
                numRequested: 0,
                post_list: data
            });

            getProfiles();
        },
        (err) => {
            dispatchError(err, 'getPosts');
        },
        () => {
            callTracker['getPosts_' + channelId] = 0;
        }
    );
}

export function getPostsBefore(postId, offset, numPost, isPost) {
    const channelId = ChannelStore.getCurrentId();
    if (channelId == null) {
        return;
    }

    if (isCallInProgress('getPostsBefore_' + channelId)) {
        return;
    }

    Client.getPostsBefore(
        channelId,
        postId,
        offset,
        numPost,
        (data) => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_POSTS,
                id: channelId,
                before: true,
                numRequested: numPost,
                post_list: data,
                isPost
            });

            getProfiles();
        },
        (err) => {
            dispatchError(err, 'getPostsBefore');
        },
        () => {
            callTracker['getPostsBefore_' + channelId] = 0;
        }
    );
}

export function getPostsAfter(postId, offset, numPost, isPost) {
    const channelId = ChannelStore.getCurrentId();
    if (channelId == null) {
        return;
    }

    if (isCallInProgress('getPostsAfter_' + channelId)) {
        return;
    }

    Client.getPostsAfter(
        channelId,
        postId,
        offset,
        numPost,
        (data) => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_POSTS,
                id: channelId,
                before: false,
                numRequested: numPost,
                post_list: data,
                isPost
            });

            getProfiles();
        },
        (err) => {
            dispatchError(err, 'getPostsAfter');
        },
        () => {
            callTracker['getPostsAfter_' + channelId] = 0;
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
            dispatchError(err, 'getCommandSuggestions');
        }
    );
}

export function getFileInfo(filename) {
    const callName = 'getFileInfo' + filename;

    if (isCallInProgress(callName)) {
        return;
    }

    callTracker[callName] = utils.getTimestamp();

    Client.getFileInfo(
        filename,
        (data) => {
            callTracker[callName] = 0;

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_FILE_INFO,
                filename,
                info: data
            });
        },
        (err) => {
            callTracker[callName] = 0;

            dispatchError(err, 'getFileInfo');
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

    Client.getProfilesForTeam(
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
        },
        (err) => {
            callTracker[callName] = 0;

            dispatchError(err, 'getRecentAndNewUsersAnalytics');
        }
    );
}

export function listIncomingHooks() {
    if (isCallInProgress('listIncomingHooks')) {
        return;
    }

    callTracker.listIncomingHooks = utils.getTimestamp();

    Client.listIncomingHooks(
        (data) => {
            callTracker.listIncomingHooks = 0;

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_INCOMING_WEBHOOKS,
                teamId: Client.teamId,
                incomingWebhooks: data
            });
        },
        (err) => {
            callTracker.listIncomingHooks = 0;
            dispatchError(err, 'getIncomingHooks');
        }
    );
}

export function listOutgoingHooks() {
    if (isCallInProgress('listOutgoingHooks')) {
        return;
    }

    callTracker.listOutgoingHooks = utils.getTimestamp();

    Client.listOutgoingHooks(
        (data) => {
            callTracker.listOutgoingHooks = 0;

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_OUTGOING_WEBHOOKS,
                teamId: Client.teamId,
                outgoingWebhooks: data
            });
        },
        (err) => {
            callTracker.listOutgoingHooks = 0;
            dispatchError(err, 'getOutgoingHooks');
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
                success();
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

export function addOutgoingHook(hook, success, error) {
    Client.addOutgoingHook(
        hook,
        (data) => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_OUTGOING_WEBHOOK,
                outgoingWebhook: data
            });

            if (success) {
                success();
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

export function listTeamCommands() {
    if (isCallInProgress('listTeamCommands')) {
        return;
    }

    callTracker.listTeamCommands = utils.getTimestamp();

    Client.listTeamCommands(
        (data) => {
            callTracker.listTeamCommands = 0;

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_COMMANDS,
                teamId: Client.teamId,
                commands: data
            });
        },
        (err) => {
            callTracker.listTeamCommands = 0;
            dispatchError(err, 'listTeamCommands');
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
                success();
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

export function getPublicLink(filename, success, error) {
    const callName = 'getPublicLink' + filename;

    if (isCallInProgress(callName)) {
        return;
    }

    callTracker[callName] = utils.getTimestamp();

    Client.getPublicLink(
        filename,
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

export function listEmoji() {
    if (isCallInProgress('listEmoji')) {
        return;
    }

    callTracker.listEmoji = utils.getTimestamp();

    Client.listEmoji(
        (data) => {
            callTracker.listEmoji = 0;

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_CUSTOM_EMOJIS,
                emojis: data
            });
        },
        (err) => {
            callTracker.listEmoji = 0;
            dispatchError(err, 'listEmoji');
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
