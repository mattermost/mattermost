// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as client from './client.jsx';
import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import BrowserStore from '../stores/browser_store.jsx';
import ChannelStore from '../stores/channel_store.jsx';
import PostStore from '../stores/post_store.jsx';
import UserStore from '../stores/user_store.jsx';
import * as utils from './utils.jsx';

import Constants from './constants.jsx';
var ActionTypes = Constants.ActionTypes;

// Used to track in progress async calls
var callTracker = {};

export function dispatchError(err, method) {
    AppDispatcher.handleServerAction({
        type: ActionTypes.RECIEVED_ERROR,
        err: err,
        method: method
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
        return;
    }

    callTracker.getChannels = utils.getTimestamp();

    client.getChannels(
        (data, textStatus, xhr) => {
            callTracker.getChannels = 0;

            if (checkVersion) {
                var serverVersion = xhr.getResponseHeader('X-Version-ID');

                if (serverVersion !== BrowserStore.getLastServerVersion()) {
                    if (!BrowserStore.getLastServerVersion() || BrowserStore.getLastServerVersion() === '') {
                        BrowserStore.setLastServerVersion(serverVersion);
                    } else {
                        console.log(BrowserStore.getLastServerVersion());
                        BrowserStore.setLastServerVersion(serverVersion);
                        window.location.reload(true);
                        console.log('Detected version update refreshing the page'); //eslint-disable-line no-console
                    }
                }
            }

            if (xhr.status === 304 || !data) {
                return;
            }

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECIEVED_CHANNELS,
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
                type: ActionTypes.RECIEVED_CHANNEL,
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
                    type: ActionTypes.RECIEVED_MORE_CHANNELS,
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

export function getChannelExtraInfo(id) {
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
            (data, textStatus, xhr) => {
                callTracker['getChannelExtraInfo_' + channelId] = 0;

                if (xhr.status === 304 || !data) {
                    return;
                }

                AppDispatcher.handleServerAction({
                    type: ActionTypes.RECIEVED_CHANNEL_EXTRA_INFO,
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
                type: ActionTypes.RECIEVED_PROFILES,
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
                type: ActionTypes.RECIEVED_SESSIONS,
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
                type: ActionTypes.RECIEVED_AUDITS,
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
                type: ActionTypes.RECIEVED_LOGS,
                logs: data
            });
        },
        (err) => {
            callTracker.getLogs = 0;
            dispatchError(err, 'getLogs');
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
                type: ActionTypes.RECIEVED_CONFIG,
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
                type: ActionTypes.RECIEVED_ALL_TEAMS,
                teams: data
            });
        },
        (err) => {
            callTracker.getAllTeams = 0;
            dispatchError(err, 'getAllTeams');
        }
    );
}

export function findTeams(email) {
    if (isCallInProgress('findTeams_' + email)) {
        return;
    }

    var user = UserStore.getCurrentUser();
    if (user) {
        callTracker['findTeams_' + email] = utils.getTimestamp();
        client.findTeams(
            user.email,
            function findTeamsSuccess(data, textStatus, xhr) {
                callTracker['findTeams_' + email] = 0;

                if (xhr.status === 304 || !data) {
                    return;
                }

                AppDispatcher.handleServerAction({
                    type: ActionTypes.RECIEVED_TEAMS,
                    teams: data
                });
            },
            function findTeamsFailure(err) {
                callTracker['findTeams_' + email] = 0;
                dispatchError(err, 'findTeams');
            }
        );
    }
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
                type: ActionTypes.RECIEVED_SEARCH,
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
                    type: ActionTypes.RECIEVED_POSTS,
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

    if (PostStore.getAllPosts(channelId) == null) {
        getPostsPage(channelId, Constants.POST_CHUNK_SIZE);
        return;
    }

    const latestUpdate = PostStore.getLatestUpdate(channelId);

    callTracker['getPosts_' + channelId] = utils.getTimestamp();

    client.getPosts(
        channelId,
        latestUpdate,
        (data, textStatus, xhr) => {
            if (xhr.status === 304 || !data) {
                return;
            }

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECIEVED_POSTS,
                id: channelId,
                before: true,
                numRequested: Constants.POST_CHUNK_SIZE,
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
                type: ActionTypes.RECIEVED_POSTS,
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
                type: ActionTypes.RECIEVED_POSTS,
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
        return;
    }

    callTracker.getMe = utils.getTimestamp();
    client.getMe(
        (data, textStatus, xhr) => {
            callTracker.getMe = 0;

            if (xhr.status === 304 || !data) {
                return;
            }

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECIEVED_ME,
                me: data
            });
        },
        (err) => {
            callTracker.getMe = 0;
            dispatchError(err, 'getMe');
        }
    );
}

export function getStatuses() {
    const directChannels = ChannelStore.getAll().filter((channel) => channel.type === Constants.DM_CHANNEL);

    const teammateIds = [];
    for (var i = 0; i < directChannels.length; i++) {
        const teammate = utils.getDirectTeammate(directChannels[i].id);
        if (teammate) {
            teammateIds.push(teammate.id);
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
                type: ActionTypes.RECIEVED_STATUSES,
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
        return;
    }

    callTracker.getMyTeam = utils.getTimestamp();
    client.getMyTeam(
        function getMyTeamSuccess(data, textStatus, xhr) {
            callTracker.getMyTeam = 0;

            if (xhr.status === 304 || !data) {
                return;
            }

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECIEVED_TEAM,
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
                type: ActionTypes.RECIEVED_PREFERENCES,
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
                    type: ActionTypes.RECIEVED_PREFERENCES,
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
    client.executeCommand(
        '',
        command,
        true,
        (data) => {
            // pull out the suggested commands from the returned data
            const terms = data.suggestions.map((suggestion) => suggestion.suggestion);

            AppDispatcher.handleServerAction({
                type: ActionTypes.SUGGESTION_RECEIVED_SUGGESTIONS,
                id: suggestionId,
                matchedPretext: command,
                terms,
                items: data.suggestions,
                component
            });
        },
        (err) => {
            dispatchError(err, 'getCommandSuggestions');
        }
    );
}
