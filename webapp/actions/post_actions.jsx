// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from 'dispatcher/app_dispatcher.jsx';

import ChannelStore from 'stores/channel_store.jsx';
import PostStore from 'stores/post_store.jsx';
import UserStore from 'stores/user_store.jsx';

import {loadStatusesForChannel} from 'actions/status_actions.jsx';
import {loadNewDMIfNeeded, loadNewGMIfNeeded} from 'actions/user_actions.jsx';
import {trackEvent} from 'actions/diagnostics_actions.jsx';
import {sendDesktopNotification} from 'actions/notification_actions.jsx';
import * as GlobalActions from 'actions/global_actions.jsx';

import Client from 'client/web_client.jsx';
import * as AsyncClient from 'utils/async_client.jsx';
import WebSocketClient from 'client/web_websocket_client.jsx';

import Constants from 'utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;
const Preferences = Constants.Preferences;

// Redux actions
import store from 'stores/redux_store.jsx';
const dispatch = store.dispatch;
const getState = store.getState;
import {getProfilesByIds} from 'mattermost-redux/actions/users';
import {getMyChannelMember} from 'mattermost-redux/actions/channels';

export function handleNewPost(post, msg) {
    let websocketMessageProps = {};
    if (msg) {
        websocketMessageProps = msg.data;
    }

    if (ChannelStore.getMyMember(post.channel_id)) {
        completePostReceive(post, websocketMessageProps);
    } else {
        // This API call requires any real team id in API v3, so set one if we don't already have one
        if (!Client.teamId && msg && msg.data) {
            Client.setTeamId(msg.data.team_id);
        }

        getMyChannelMember(post.channel_id)(dispatch, getState).then(() => completePostReceive(post, websocketMessageProps));
    }

    if (msg && msg.data) {
        if (msg.data.channel_type === Constants.DM_CHANNEL) {
            loadNewDMIfNeeded(post.channel_id);
        } else if (msg.data.channel_type === Constants.GM_CHANNEL) {
            loadNewGMIfNeeded(post.channel_id);
        }
    }
}

function completePostReceive(post, websocketMessageProps) {
    if (post.root_id && PostStore.getPost(post.channel_id, post.root_id) == null) {
        Client.getPost(
            post.channel_id,
            post.root_id,
            (data) => {
                AppDispatcher.handleServerAction({
                    type: ActionTypes.RECEIVED_POSTS,
                    id: post.channel_id,
                    numRequested: 0,
                    post_list: data
                });

                // Required to update order
                AppDispatcher.handleServerAction({
                    type: ActionTypes.RECEIVED_POST,
                    post,
                    websocketMessageProps
                });

                sendDesktopNotification(post, websocketMessageProps);

                loadProfilesForPosts(data.posts);
            },
            (err) => {
                AsyncClient.dispatchError(err, 'getPost');
            }
        );

        return;
    }

    AppDispatcher.handleServerAction({
        type: ActionTypes.RECEIVED_POST,
        post,
        websocketMessageProps
    });

    sendDesktopNotification(post, websocketMessageProps);
}

export function pinPost(channelId, postId) {
    AsyncClient.pinPost(channelId, postId);
}

export function unpinPost(channelId, postId) {
    AsyncClient.unpinPost(channelId, postId);
}

export function flagPost(postId) {
    trackEvent('api', 'api_posts_flagged');
    AsyncClient.savePreference(Preferences.CATEGORY_FLAGGED_POST, postId, 'true');
}

export function unflagPost(postId, success) {
    trackEvent('api', 'api_posts_unflagged');
    const pref = {
        user_id: UserStore.getCurrentId(),
        category: Preferences.CATEGORY_FLAGGED_POST,
        name: postId
    };
    AsyncClient.deletePreferences([pref], success);
}

export function getFlaggedPosts() {
    Client.getFlaggedPosts(0, Constants.POST_CHUNK_SIZE,
        (data) => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_SEARCH_TERM,
                term: null,
                do_search: false,
                is_mention_search: false
            });

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_SEARCH,
                results: data,
                is_flagged_posts: true,
                is_pinned_posts: false
            });

            loadProfilesForPosts(data.posts);
        },
        (err) => {
            AsyncClient.dispatchError(err, 'getFlaggedPosts');
        }
    );
}

export function getPinnedPosts(channelId = ChannelStore.getCurrentId()) {
    Client.getPinnedPosts(channelId,
        (data) => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_SEARCH_TERM,
                term: null,
                do_search: false,
                is_mention_search: false
            });

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_SEARCH,
                results: data,
                is_flagged_posts: false,
                is_pinned_posts: true
            });

            loadProfilesForPosts(data.posts);
        },
        (err) => {
            AsyncClient.dispatchError(err, 'getPinnedPosts');
        }
    );
}

export function loadPosts(channelId = ChannelStore.getCurrentId(), isPost = false) {
    const postList = PostStore.getAllPosts(channelId);
    const latestPostTime = PostStore.getLatestPostFromPageTime(channelId);

    if (
        !postList || Object.keys(postList).length === 0 ||
        (!isPost && postList.order.length < Constants.POST_CHUNK_SIZE) ||
        latestPostTime === 0
    ) {
        loadPostsPage(channelId, Constants.POST_CHUNK_SIZE, isPost);
        return;
    }

    Client.getPosts(
        channelId,
        latestPostTime,
        (data) => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_POSTS,
                id: channelId,
                before: true,
                numRequested: 0,
                post_list: data,
                isPost
            });

            loadProfilesForPosts(data.posts);
            loadStatusesForChannel(channelId);
        },
        (err) => {
            AsyncClient.dispatchError(err, 'loadPosts');
        }
    );
}

export function loadPostsPage(channelId = ChannelStore.getCurrentId(), max = Constants.POST_CHUNK_SIZE, isPost = false) {
    const postList = PostStore.getAllPosts(channelId);

    // if we already have more than POST_CHUNK_SIZE posts,
    //   let's get the amount we have but rounded up to next multiple of POST_CHUNK_SIZE,
    //   with a max
    let numPosts = Math.min(max, Constants.POST_CHUNK_SIZE);
    if (postList && postList.order.length > 0) {
        numPosts = Math.min(max, Constants.POST_CHUNK_SIZE * Math.ceil(postList.order.length / Constants.POST_CHUNK_SIZE));
    }

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
                checkLatest: true,
                checkEarliest: true,
                post_list: data,
                isPost
            });

            loadProfilesForPosts(data.posts);
            loadStatusesForChannel(channelId);
        },
        (err) => {
            AsyncClient.dispatchError(err, 'loadPostsPage');
        }
    );
}

export function loadPostsBefore(postId, offset, numPost, isPost) {
    const channelId = ChannelStore.getCurrentId();
    if (channelId == null) {
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
                checkEarliest: true,
                numRequested: numPost,
                post_list: data,
                isPost
            });

            loadProfilesForPosts(data.posts);
            loadStatusesForChannel(channelId);
        },
        (err) => {
            AsyncClient.dispatchError(err, 'loadPostsBefore');
        }
    );
}

export function loadPostsAfter(postId, offset, numPost, isPost) {
    const channelId = ChannelStore.getCurrentId();
    if (channelId == null) {
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

            loadProfilesForPosts(data.posts);
            loadStatusesForChannel(channelId);
        },
        (err) => {
            AsyncClient.dispatchError(err, 'loadPostsAfter');
        }
    );
}

export function loadProfilesForPosts(posts) {
    const profilesToLoad = {};
    for (const pid in posts) {
        if (!posts.hasOwnProperty(pid)) {
            continue;
        }

        const post = posts[pid];
        if (!UserStore.hasProfile(post.user_id)) {
            profilesToLoad[post.user_id] = true;
        }
    }

    const list = Object.keys(profilesToLoad);
    if (list.length === 0) {
        return;
    }

    getProfilesByIds(list)(dispatch, getState);
}

export function addReaction(channelId, postId, emojiName) {
    const reaction = {
        post_id: postId,
        user_id: UserStore.getCurrentId(),
        emoji_name: emojiName
    };
    emitEmojiPosted(emojiName);

    AsyncClient.saveReaction(channelId, reaction);
}

export function removeReaction(channelId, postId, emojiName) {
    const reaction = {
        post_id: postId,
        user_id: UserStore.getCurrentId(),
        emoji_name: emojiName
    };

    AsyncClient.deleteReaction(channelId, reaction);
}

const postQueue = [];

export function queuePost(post, doLoadPost, success, error) {
    postQueue.push(
        createPost.bind(
            this,
            post,
            doLoadPost,
            (data) => {
                if (success) {
                    success(data);
                }

                postSendComplete();
            },
            (err) => {
                if (error) {
                    error(err);
                }

                postSendComplete();
            }
        )
    );

    sendFirstPostInQueue();
}

// Remove the completed post from the queue and send the next one
function postSendComplete() {
    postQueue.shift();
    sendNextPostInQueue();
}

// Start sending posts if a new queue has started
function sendFirstPostInQueue() {
    if (postQueue.length === 1) {
        sendNextPostInQueue();
    }
}

// Send the next post in the queue if there is one
function sendNextPostInQueue() {
    const nextPostAction = postQueue[0];
    if (nextPostAction) {
        nextPostAction();
    }
}

export function createPost(post, doLoadPost, success, error) {
    if (WebSocketClient.isOpen()) {
        Client.createPost(post,
            (data) => {
                if (doLoadPost) {
                    loadPosts(post.channel_id);
                } else {
                    PostStore.removePendingPost(post.channel_id, post.pending_post_id);
                }

                AppDispatcher.handleServerAction({
                    type: ActionTypes.RECEIVED_POST,
                    post: data
                });

                if (success) {
                    success(data);
                }
            },

            (err) => {
                if (err.id === 'api.post.create_post.root_id.app_error') {
                    PostStore.removePendingPost(post.channel_id, post.pending_post_id);
                } else {
                    post.state = Constants.POST_FAILED;
                    PostStore.updatePendingPost(post);
                }

                if (error) {
                    error(err);
                }
            }
        );
    } else {
        post.state = Constants.POST_FAILED;
        PostStore.updatePendingPost(post);
    }
}

export function updatePost(post, success, isPost) {
    Client.updatePost(
        post,
        () => {
            loadPosts(post.channel_id, isPost);

            if (success) {
                success();
            }
        },
        (err) => {
            AsyncClient.dispatchError(err, 'updatePost');
        });
}

export function emitEmojiPosted(emoji) {
    AppDispatcher.handleServerAction({
        type: ActionTypes.EMOJI_POSTED,
        alias: emoji
    });
}

export function deletePost(channelId, post, success, error) {
    Client.deletePost(
        channelId,
        post.id,
        () => {
            GlobalActions.emitRemovePost(post);
            if (post.id === PostStore.getSelectedPostId()) {
                AppDispatcher.handleServerAction({
                    type: ActionTypes.RECEIVED_POST_SELECTED,
                    postId: null
                });
            }

            if (success) {
                success();
            }
        },
        (err) => {
            AsyncClient.dispatchError(err, 'deletePost');

            if (error) {
                error(err);
            }
        }
    );
}

export function performSearch(terms, isMentionSearch, success, error) {
    Client.search(
        terms,
        isMentionSearch,
        (data) => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_SEARCH,
                results: data,
                is_mention_search: isMentionSearch
            });

            loadProfilesForPosts(data.posts);

            if (success) {
                success(data);
            }
        },
        (err) => {
            AsyncClient.dispatchError(err, 'search');

            if (error) {
                error(err);
            }
        }
    );
}

export function storePostDraft(channelId, draft) {
    AppDispatcher.handleViewAction({
        type: ActionTypes.POST_DRAFT_CHANGED,
        channelId,
        draft
    });
}
