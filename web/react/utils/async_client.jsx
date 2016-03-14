// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as client from './client.jsx';
import * as GlobalActions from '../action_creators/global_actions.jsx';
import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import BrowserStore from '../stores/browser_store.jsx';
import ChannelStore from '../stores/channel_store.jsx';
import PreferenceStore from '../stores/preference_store.jsx';
import PostStore from '../stores/post_store.jsx';
import UserStore from '../stores/user_store.jsx';
import * as utils from './utils.jsx';

import Constants from './constants.jsx';
const ActionTypes = Constants.ActionTypes;
const StatTypes = Constants.StatTypes;

// Used to track in progress async calls
const callTracker = {};

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

    if (utils.getTimestamp() - callTracker[callName] > 5000) {
        //console.log('AsyncClient call ' + callName + ' expired after more than 5 seconds');
        return false;
    }

    return true;
}

export function getChannels(checkVersion) {
    if (isCallInProgress('getChannels')) {
        return null;
    }

    callTracker.getChannels = utils.getTimestamp();

    return client.getChannels(
        (data, textStatus, xhr) => {
            callTracker.getChannels = 0;

            if (xhr.status === 304 || !data) {
                return;
            }

            if (checkVersion) {
                var serverVersion = xhr.getResponseHeader('X-Version-ID');

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

    client.getChannel(id,
        (data, textStatus, xhr) => {
            callTracker['getChannel' + id] = 0;

            if (xhr.status === 304 || !data) {
                return;
            }

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
    client.updateLastViewedAt(
        channelId,
        () => {
            callTracker.updateLastViewed = 0;
        },
        (err) => {
            callTracker.updateLastViewed = 0;
            dispatchError(err, 'updateLastViewedAt');
        }
    );
}

export function getMoreChannels(force) {
    if (isCallInProgress('getMoreChannels')) {
        return;
    }

    if (ChannelStore.getMoreAll().loading || force) {
        callTracker.getMoreChannels = utils.getTimestamp();
        client.getMoreChannels(
            function getMoreChannelsSuccess(data, textStatus, xhr) {
                callTracker.getMoreChannels = 0;

                if (xhr.status === 304 || !data) {
                    return;
                }

                AppDispatcher.handleServerAction({
                    type: ActionTypes.RECEIVED_MORE_CHANNELS,
                    channels: data.channels,
                    members: data.members
                });
            },
            function getMoreChannelsFailure(err) {
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

        client.getChannelExtraInfo(
            channelId,
            memberLimit,
            (data, textStatus, xhr) => {
                callTracker['getChannelExtraInfo_' + channelId] = 0;

                if (xhr.status === 304 || !data) {
                    return;
                }

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

export function getProfiles() {
    if (isCallInProgress('getProfiles')) {
        return;
    }

    callTracker.getProfiles = utils.getTimestamp();
    client.getProfiles(
        function getProfilesSuccess(data, textStatus, xhr) {
            callTracker.getProfiles = 0;

            if (xhr.status === 304 || !data) {
                return;
            }

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_PROFILES,
                profiles: data
            });
        },
        function getProfilesFailure(err) {
            callTracker.getProfiles = 0;
            dispatchError(err, 'getProfiles');
        }
    );
}

export function getSessions() {
    if (isCallInProgress('getSessions')) {
        return;
    }

    callTracker.getSessions = utils.getTimestamp();
    client.getSessions(
        UserStore.getCurrentId(),
        function getSessionsSuccess(data, textStatus, xhr) {
            callTracker.getSessions = 0;

            if (xhr.status === 304 || !data) {
                return;
            }

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_SESSIONS,
                sessions: data
            });
        },
        function getSessionsFailure(err) {
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
    client.getAudits(
        UserStore.getCurrentId(),
        function getAuditsSuccess(data, textStatus, xhr) {
            callTracker.getAudits = 0;

            if (xhr.status === 304 || !data) {
                return;
            }

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_AUDITS,
                audits: data
            });
        },
        function getAuditsFailure(err) {
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
    client.getLogs(
        (data, textStatus, xhr) => {
            callTracker.getLogs = 0;

            if (xhr.status === 304 || !data) {
                return;
            }

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
    client.getServerAudits(
        (data, textStatus, xhr) => {
            callTracker.getServerAudits = 0;

            if (xhr.status === 304 || !data) {
                return;
            }

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

export function getConfig() {
    if (isCallInProgress('getConfig')) {
        return;
    }

    callTracker.getConfig = utils.getTimestamp();
    client.getConfig(
        (data, textStatus, xhr) => {
            callTracker.getConfig = 0;

            if (xhr.status === 304 || !data) {
                return;
            }

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_CONFIG,
                config: data
            });
        },
        (err) => {
            callTracker.getConfig = 0;
            dispatchError(err, 'getConfig');
        }
    );
}

export function getAllTeams() {
    if (isCallInProgress('getAllTeams')) {
        return;
    }

    callTracker.getAllTeams = utils.getTimestamp();
    client.getAllTeams(
        (data, textStatus, xhr) => {
            callTracker.getAllTeams = 0;

            if (xhr.status === 304 || !data) {
                return;
            }

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

export function search(terms) {
    if (isCallInProgress('search_' + String(terms))) {
        return;
    }

    callTracker['search_' + String(terms)] = utils.getTimestamp();
    client.search(
        terms,
        function searchSuccess(data, textStatus, xhr) {
            callTracker['search_' + String(terms)] = 0;

            if (xhr.status === 304 || !data) {
                return;
            }

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_SEARCH,
                results: data
            });
        },
        function searchFailure(err) {
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

        client.getPostsPage(
            channelId,
            0,
            numPosts,
            (data, textStatus, xhr) => {
                if (xhr.status === 304 || !data) {
                    return;
                }

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

    client.getPosts(
        channelId,
        latestPostTime,
        (data, textStatus, xhr) => {
            if (xhr.status === 304 || !data) {
                return;
            }

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

export function getPostsBefore(postId, offset, numPost) {
    const channelId = ChannelStore.getCurrentId();
    if (channelId == null) {
        return;
    }

    if (isCallInProgress('getPostsBefore_' + channelId)) {
        return;
    }

    client.getPostsBefore(
        channelId,
        postId,
        offset,
        numPost,
        (data, textStatus, xhr) => {
            if (xhr.status === 304 || !data) {
                return;
            }

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_POSTS,
                id: channelId,
                before: true,
                numRequested: numPost,
                post_list: data
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

export function getPostsAfter(postId, offset, numPost) {
    const channelId = ChannelStore.getCurrentId();
    if (channelId == null) {
        return;
    }

    if (isCallInProgress('getPostsAfter_' + channelId)) {
        return;
    }

    client.getPostsAfter(
        channelId,
        postId,
        offset,
        numPost,
        (data, textStatus, xhr) => {
            if (xhr.status === 304 || !data) {
                return;
            }

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_POSTS,
                id: channelId,
                before: false,
                numRequested: numPost,
                post_list: data
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
    return client.getMe(
        (data, textStatus, xhr) => {
            callTracker.getMe = 0;

            if (xhr.status === 304 || !data) {
                return;
            }

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
    const preferences = PreferenceStore.getCategory(Constants.Preferences.CATEGORY_DIRECT_CHANNEL_SHOW);

    const teammateIds = [];
    for (const preference of preferences) {
        if (preference.value === 'true') {
            teammateIds.push(preference.name);
        }
    }

    if (isCallInProgress('getStatuses') || teammateIds.length === 0) {
        return;
    }

    callTracker.getStatuses = utils.getTimestamp();
    client.getStatuses(teammateIds,
        (data, textStatus, xhr) => {
            callTracker.getStatuses = 0;

            if (xhr.status === 304 || !data) {
                return;
            }

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
    return client.getMyTeam(
        function getMyTeamSuccess(data, textStatus, xhr) {
            callTracker.getMyTeam = 0;

            if (xhr.status === 304 || !data) {
                return;
            }

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_MY_TEAM,
                team: data
            });
        },
        function getMyTeamFailure(err) {
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
    client.getAllPreferences(
        (data, textStatus, xhr) => {
            callTracker.getAllPreferences = 0;

            if (xhr.status === 304 || !data) {
                return;
            }

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

export function savePreferences(preferences, success, error) {
    client.savePreferences(
        preferences,
        (data, textStatus, xhr) => {
            if (xhr.status !== 304) {
                AppDispatcher.handleServerAction({
                    type: ActionTypes.RECEIVED_PREFERENCES,
                    preferences
                });
            }

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

export function getSuggestedCommands(command, suggestionId, component) {
    client.listCommands(
        (data) => {
            var matches = [];
            data.forEach((cmd) => {
                if (('/' + cmd.trigger).indexOf(command) === 0) {
                    let s = '/' + cmd.trigger;
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

    client.getFileInfo(
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

    client.getAnalytics(
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

    client.getAnalytics(
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

    client.getAnalytics(
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

    client.getAnalytics(
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

    client.getProfilesForTeam(
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
