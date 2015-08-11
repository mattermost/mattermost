// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
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

var dispatchError = function(err, method) {
    AppDispatcher.handleServerAction({
        type: ActionTypes.RECIEVED_ERROR,
        err: err,
        method: method
    });
};

var isCallInProgress = function(callName) {
    if (!(callName in callTracker)) return false;

    if (callTracker[callName] === 0) return false;

    if (utils.getTimestamp() - callTracker[callName] > 5000) {
        console.log("AsyncClient call " + callName + " expired after more than 5 seconds");
        return false;
    }

    return true;
};

module.exports.dispatchError = dispatchError;

module.exports.getChannels = function(force, updateLastViewed, checkVersion) {
    if (isCallInProgress("getChannels")) return;

    if (ChannelStore.getAll().length == 0 || force) {
        callTracker["getChannels"] = utils.getTimestamp();
        client.getChannels(
            function(data, textStatus, xhr) {
                callTracker["getChannels"] = 0;

                if (updateLastViewed && ChannelStore.getCurrentId() != null) {
                    module.exports.updateLastViewedAt();
                }

                if (checkVersion) {
                    var serverVersion = xhr.getResponseHeader("X-Version-ID");

                    if (!UserStore.getLastVersion()) {
                        UserStore.setLastVersion(serverVersion);
                    }

                    if (serverVersion != UserStore.getLastVersion()) {
                        UserStore.setLastVersion(serverVersion);
                        window.location.href = window.location.href;
                        console.log("Detected version update refreshing the page");
                    }
                }

                if (xhr.status === 304 || !data) return;

                AppDispatcher.handleServerAction({
                    type: ActionTypes.RECIEVED_CHANNELS,
                    channels: data.channels,
                    members: data.members
                });

            },
            function(err) {
                callTracker["getChannels"] = 0;
                dispatchError(err, "getChannels");
            }
        );
    }
}

module.exports.updateLastViewedAt = function() {
    if (isCallInProgress("updateLastViewed")) return;

    if (ChannelStore.getCurrentId() == null) return;

    callTracker["updateLastViewed"] = utils.getTimestamp();
    client.updateLastViewedAt(
        ChannelStore.getCurrentId(),
        function(data) {
            callTracker["updateLastViewed"] = 0;
        },
        function(err) {
            callTracker["updateLastViewed"] = 0;
            dispatchError(err, "updateLastViewedAt");
        }
    );
}

module.exports.getMoreChannels = function(force) {
    if (isCallInProgress("getMoreChannels")) return;

    if (ChannelStore.getMoreAll().loading || force) {

        callTracker["getMoreChannels"] = utils.getTimestamp();
        client.getMoreChannels(
            function(data, textStatus, xhr) {
                callTracker["getMoreChannels"] = 0;

                if (xhr.status === 304 || !data) return;

                AppDispatcher.handleServerAction({
                    type: ActionTypes.RECIEVED_MORE_CHANNELS,
                    channels: data.channels,
                    members: data.members
                });
            },
            function(err) {
                callTracker["getMoreChannels"] = 0;
                dispatchError(err, "getMoreChannels");
            }
        );
    }
}

module.exports.getChannelExtraInfo = function(force) {
    var channelId = ChannelStore.getCurrentId();

    if (channelId != null) {
        if (isCallInProgress("getChannelExtraInfo_"+channelId)) return;
        var minMembers = ChannelStore.getCurrent() && ChannelStore.getCurrent().type === 'D' ? 1 : 0;

        if (ChannelStore.getCurrentExtraInfo().members.length <= minMembers || force) {
            callTracker["getChannelExtraInfo_"+channelId] = utils.getTimestamp();
            client.getChannelExtraInfo(
                channelId,
                function(data, textStatus, xhr) {
                    callTracker["getChannelExtraInfo_"+channelId] = 0;

                    if (xhr.status === 304 || !data) return;

                    AppDispatcher.handleServerAction({
                        type: ActionTypes.RECIEVED_CHANNEL_EXTRA_INFO,
                        extra_info: data
                    });
                },
                function(err) {
                    callTracker["getChannelExtraInfo_"+channelId] = 0;
                    dispatchError(err, "getChannelExtraInfo");
                }
            );
        }
    }
}

module.exports.getProfiles = function() {
    if (isCallInProgress("getProfiles")) return;

    callTracker["getProfiles"] = utils.getTimestamp();
    client.getProfiles(
        function(data, textStatus, xhr) {
            callTracker["getProfiles"] = 0;

            if (xhr.status === 304 || !data) return;

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECIEVED_PROFILES,
                profiles: data
            });
        },
        function(err) {
            callTracker["getProfiles"] = 0;
            dispatchError(err, "getProfiles");
        }
    );
}

module.exports.getSessions = function() {
    if (isCallInProgress("getSessions")) return;

    callTracker["getSessions"] = utils.getTimestamp();
    client.getSessions(
        UserStore.getCurrentId(),
        function(data, textStatus, xhr) {
            callTracker["getSessions"] = 0;

            if (xhr.status === 304 || !data) return;

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECIEVED_SESSIONS,
                sessions: data
            });
        },
        function(err) {
            callTracker["getSessions"] = 0;
            dispatchError(err, "getSessions");
        }
    );
}

module.exports.getAudits = function() {
    if (isCallInProgress("getAudits")) return;

    callTracker["getAudits"] = utils.getTimestamp();
    client.getAudits(
        UserStore.getCurrentId(),
        function(data, textStatus, xhr) {
            callTracker["getAudits"] = 0;

            if (xhr.status === 304 || !data) return;

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECIEVED_AUDITS,
                audits: data
            });
        },
        function(err) {
            callTracker["getAudits"] = 0;
            dispatchError(err, "getAudits");
        }
    );
}

module.exports.findTeams = function(email) {
    if (isCallInProgress("findTeams_"+email)) return;

    var user = UserStore.getCurrentUser();
    if (user) {
        callTracker["findTeams_"+email] = utils.getTimestamp();
        client.findTeams(
            user.email,
            function(data, textStatus, xhr) {
                callTracker["findTeams_"+email] = 0;

                if (xhr.status === 304 || !data) return;

                AppDispatcher.handleServerAction({
                    type: ActionTypes.RECIEVED_TEAMS,
                    teams: data
                });
            },
            function(err) {
                callTracker["findTeams_"+email] = 0;
                dispatchError(err, "findTeams");
            }
        );
    }
}

module.exports.search = function(terms) {
    if (isCallInProgress("search_"+String(terms))) return;

    callTracker["search_"+String(terms)] = utils.getTimestamp();
    client.search(
        terms,
        function(data, textStatus, xhr) {
            callTracker["search_"+String(terms)] = 0;

            if (xhr.status === 304 || !data) return;

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECIEVED_SEARCH,
                results: data
            });
        },
        function(err) {
            callTracker["search_"+String(terms)] = 0;
            dispatchError(err, "search");
        }
    );
}

module.exports.getPosts = function(force, id, maxPosts) {
    if (PostStore.getCurrentPosts() == null || force) {
        var channelId = id ? id : ChannelStore.getCurrentId();

        if (isCallInProgress("getPosts_"+channelId)) return;

        var post_list = PostStore.getCurrentPosts();

        if (!maxPosts) { maxPosts = Constants.POST_CHUNK_SIZE * Constants.MAX_POST_CHUNKS };

        // if we already have more than POST_CHUNK_SIZE posts,
        //   let's get the amount we have but rounded up to next multiple of POST_CHUNK_SIZE,
        //   with a max at maxPosts
        var numPosts = Math.min(maxPosts, Constants.POST_CHUNK_SIZE);
        if (post_list && post_list.order.length > 0) {
            numPosts = Math.min(maxPosts, Constants.POST_CHUNK_SIZE * Math.ceil(post_list.order.length / Constants.POST_CHUNK_SIZE));
        }

        if (channelId != null) {
            callTracker["getPosts_"+channelId] = utils.getTimestamp();
            client.getPosts(
                channelId,
                0,
                numPosts,
                function(data, textStatus, xhr) {
                    if (xhr.status === 304 || !data) return;

                    AppDispatcher.handleServerAction({
                        type: ActionTypes.RECIEVED_POSTS,
                        id: channelId,
                        post_list: data
                    });

                    module.exports.getProfiles();
                },
                function(err) {
                    dispatchError(err, "getPosts");
                },
                function() {
                    callTracker["getPosts_"+channelId] = 0;
                }
            );
        }
    }
}

module.exports.getMe = function() {
    if (isCallInProgress("getMe")) return;

    callTracker["getMe"] = utils.getTimestamp();
    client.getMe(
        function(data, textStatus, xhr) {
            callTracker["getMe"] = 0;

            if (xhr.status === 304 || !data) return;

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECIEVED_ME,
                me: data
            });
        },
        function(err) {
            callTracker["getMe"] = 0;
            dispatchError(err, "getMe");
        }
    );
}

module.exports.getStatuses = function() {
    if (isCallInProgress("getStatuses")) return;

    callTracker["getStatuses"] = utils.getTimestamp();
    client.getStatuses(
        function(data, textStatus, xhr) {
            callTracker["getStatuses"] = 0;

            if (xhr.status === 304 || !data) return;

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECIEVED_STATUSES,
                statuses: data
            });
        },
        function(err) {
            callTracker["getStatuses"] = 0;
            dispatchError(err, "getStatuses");
        }
    );
}

module.exports.getMyTeam = function() {
    if (isCallInProgress("getMyTeam")) return;

    callTracker["getMyTeam"] = utils.getTimestamp();
    client.getMyTeam(
        function(data, textStatus, xhr) {
            callTracker["getMyTeam"] = 0;

            if (xhr.status === 304 || !data) return;

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECIEVED_TEAM,
                team: data
            });
        },
        function(err) {
            callTracker["getMyTeam"] = 0;
            dispatchError(err, "getMyTeam");
        }
    );
}
