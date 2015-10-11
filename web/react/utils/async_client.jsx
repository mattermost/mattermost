// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var client = require('./client.jsx');
var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var ChannelStore = require('../stores/channel_store.jsx');
var PostStore = require('../stores/post_store.jsx');
var UserStore = require('../stores/user_store.jsx');
var utils = require('./utils.jsx');

var Constants = require('./constants.jsx');
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

export function getChannels(force, updateLastViewed, checkVersion) {
    var channels = ChannelStore.getAll();

    if (channels.length === 0 || force) {
        if (isCallInProgress('getChannels')) {
            return;
        }

        callTracker.getChannels = utils.getTimestamp();

        client.getChannels(
            function getChannelsSuccess(data, textStatus, xhr) {
                callTracker.getChannels = 0;

                if (checkVersion) {
                    var serverVersion = xhr.getResponseHeader('X-Version-ID');

                    if (!UserStore.getLastVersion()) {
                        UserStore.setLastVersion(serverVersion);
                    }

                    if (serverVersion !== UserStore.getLastVersion()) {
                        UserStore.setLastVersion(serverVersion);
                        window.location.href = window.location.href;
                        console.log('Detected version update refreshing the page'); //eslint-disable-line no-console
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
            function getChannelsFailure(err) {
                callTracker.getChannels = 0;
                dispatchError(err, 'getChannels');
            }
        );
    } else {
        if (isCallInProgress('getChannelCounts')) {
            return;
        }

        callTracker.getChannelCounts = utils.getTimestamp();

        client.getChannelCounts(
            function getChannelCountsSuccess(data, textStatus, xhr) {
                callTracker.getChannelCounts = 0;

                if (xhr.status === 304 || !data) {
                    return;
                }

                var countMap = data.counts;
                var updateAtMap = data.update_times;

                for (var id in countMap) {
                    if ({}.hasOwnProperty.call(countMap, id)) {
                        var c = ChannelStore.get(id);
                        var count = countMap[id];
                        var updateAt = updateAtMap[id];
                        if (!c || c.total_msg_count !== count || updateAt > c.update_at) {
                            getChannel(id);
                        }
                    }
                }
            },
            function getChannelCountsFailure(err) {
                callTracker.getChannelCounts = 0;
                dispatchError(err, 'getChannelCounts');
            }
        );
    }

    if (updateLastViewed && ChannelStore.getCurrentId() != null) {
        updateLastViewedAt();
    }
}

export function getChannel(id) {
    if (isCallInProgress('getChannel' + id)) {
        return;
    }

    callTracker['getChannel' + id] = utils.getTimestamp();

    client.getChannel(id,
        function getChannelSuccess(data, textStatus, xhr) {
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
        function getChannelFailure(err) {
            callTracker['getChannel' + id] = 0;
            dispatchError(err, 'getChannel');
        }
    );
}

export function updateLastViewedAt() {
    const channelId = ChannelStore.getCurrentId();

    if (channelId === null) {
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

export function getChannelExtraInfo(force) {
    var channelId = ChannelStore.getCurrentId();

    if (channelId != null) {
        if (isCallInProgress('getChannelExtraInfo_' + channelId)) {
            return;
        }
        var minMembers = 0;
        if (ChannelStore.getCurrent() && ChannelStore.getCurrent().type === 'D') {
            minMembers = 1;
        }

        if (ChannelStore.getCurrentExtraInfo().members.length <= minMembers || force) {
            callTracker['getChannelExtraInfo_' + channelId] = utils.getTimestamp();
            client.getChannelExtraInfo(
                channelId,
                function getChannelExtraInfoSuccess(data, textStatus, xhr) {
                    callTracker['getChannelExtraInfo_' + channelId] = 0;

                    if (xhr.status === 304 || !data) {
                        return;
                    }

                    AppDispatcher.handleServerAction({
                        type: ActionTypes.RECIEVED_CHANNEL_EXTRA_INFO,
                        extra_info: data
                    });
                },
                function getChannelExtraInfoFailure(err) {
                    callTracker['getChannelExtraInfo_' + channelId] = 0;
                    dispatchError(err, 'getChannelExtraInfo');
                }
            );
        }
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

export function getPostsPage(force, id, maxPosts) {
    if (PostStore.getCurrentPosts() == null || force) {
        var channelId = id;
        if (channelId == null) {
            channelId = ChannelStore.getCurrentId();
        }

        if (isCallInProgress('getPostsPage_' + channelId)) {
            return;
        }

        var postList = PostStore.getCurrentPosts();

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
                function getPostsPageSuccess(data, textStatus, xhr) {
                    if (xhr.status === 304 || !data) {
                        return;
                    }

                    AppDispatcher.handleServerAction({
                        type: ActionTypes.RECIEVED_POSTS,
                        id: channelId,
                        post_list: data
                    });

                    getProfiles();
                },
                function getPostsPageFailure(err) {
                    dispatchError(err, 'getPostsPage');
                },
                function getPostsPageComplete() {
                    callTracker['getPostsPage_' + channelId] = 0;
                }
            );
        }
    }
}

export function getPosts(id) {
    var channelId = id;
    if (channelId == null) {
        if (ChannelStore.getCurrentId() == null) {
            return;
        }
        channelId = ChannelStore.getCurrentId();
    }

    if (isCallInProgress('getPosts_' + channelId)) {
        return;
    }

    if (PostStore.getCurrentPosts() == null) {
        getPostsPage(true, id, Constants.POST_CHUNK_SIZE);
        return;
    }

    var latestUpdate = PostStore.getLatestUpdate(channelId);

    callTracker['getPosts_' + channelId] = utils.getTimestamp();

    client.getPosts(
        channelId,
        latestUpdate,
        function success(data, textStatus, xhr) {
            if (xhr.status === 304 || !data) {
                return;
            }

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECIEVED_POSTS,
                id: channelId,
                post_list: data
            });

            getProfiles();
        },
        function fail(err) {
            dispatchError(err, 'getPosts');
        },
        function complete() {
            callTracker['getPosts_' + channelId] = 0;
        }
    );
}

export function getMe() {
    if (isCallInProgress('getMe')) {
        return;
    }

    callTracker.getMe = utils.getTimestamp();
    client.getMeSynchronous(
        function getMeSyncSuccess(data, textStatus, xhr) {
            callTracker.getMe = 0;

            if (xhr.status === 304 || !data) {
                return;
            }

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECIEVED_ME,
                me: data
            });
        },
        function getMeSyncFailure(err) {
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
    client.getStatuses(
        function getStatusesSuccess(data, textStatus, xhr) {
            callTracker.getStatuses = 0;

            if (xhr.status === 304 || !data) {
                return;
            }

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECIEVED_STATUSES,
                statuses: data
            });
        },
        function getStatusesFailure(err) {
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
