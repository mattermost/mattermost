// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import ChannelStore from '../stores/channel_store.jsx';
import PostStore from '../stores/post_store.jsx';
import Constants from '../utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;
import * as AsyncClient from '../utils/async_client.jsx';
import * as Client from '../utils/client.jsx';

export function emitChannelClickEvent(channel) {
    AsyncClient.getChannels();
    AsyncClient.getChannelExtraInfo();
    AsyncClient.updateLastViewedAt();
    AsyncClient.getPosts(channel.id);

    AppDispatcher.handleViewAction({
        type: ActionTypes.CLICK_CHANNEL,
        name: channel.name,
        id: channel.id
    });
}

export function emitPostFocusEvent(postId) {
    Client.getPostById(
        postId,
        (data) => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECIEVED_FOCUSED_POST,
                postId,
                post_list: data
            });

            AsyncClient.getPostsBefore(postId, 0, Constants.POST_FOCUS_CONTEXT_RADIUS);
            AsyncClient.getPostsAfter(postId, 0, Constants.POST_FOCUS_CONTEXT_RADIUS);
        }
    );
}

export function emitLoadMorePostsEvent() {
    const id = ChannelStore.getCurrentId();
    loadMorePostsTop(id);
}

export function emitLoadMorePostsFocusedTopEvent() {
    const id = PostStore.getFocusedPostId();
    loadMorePostsTop(id);
}

export function loadMorePostsTop(id) {
    const earliestPostId = PostStore.getEarliestPost(id).id;
    if (PostStore.requestVisibilityIncrease(id, Constants.POST_CHUNK_SIZE)) {
        AsyncClient.getPostsBefore(earliestPostId, 0, Constants.POST_CHUNK_SIZE);
    }
}

export function emitLoadMorePostsFocusedBottomEvent() {
    const id = PostStore.getFocusedPostId();
    const latestPostId = PostStore.getLatestPost(id).id;
    AsyncClient.getPostsAfter(latestPostId, 0, Constants.POST_CHUNK_SIZE);
}

export function emitPostRecievedEvent(post) {
    AppDispatcher.handleServerAction({
        type: ActionTypes.RECIEVED_POST,
        post
    });
}

export function emitUserPostedEvent(post) {
    AppDispatcher.handleServerAction({
        type: ActionTypes.CREATE_POST,
        post
    });
}

export function emitPostDeletedEvent(post) {
    AppDispatcher.handleServerAction({
        type: ActionTypes.POST_DELETED,
        post
    });
}
