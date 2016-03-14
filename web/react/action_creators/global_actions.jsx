// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import ChannelStore from '../stores/channel_store.jsx';
import PostStore from '../stores/post_store.jsx';
import SearchStore from '../stores/search_store.jsx';
import Constants from '../utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;
import * as AsyncClient from '../utils/async_client.jsx';
import * as Client from '../utils/client.jsx';
import * as Utils from '../utils/utils.jsx';

export function emitChannelClickEvent(channel) {
    AsyncClient.getChannels(true);
    AsyncClient.getChannelExtraInfo(channel.id);
    AsyncClient.updateLastViewedAt(channel.id);
    AsyncClient.getPosts(channel.id);

    AppDispatcher.handleViewAction({
        type: ActionTypes.CLICK_CHANNEL,
        name: channel.name,
        id: channel.id,
        prev: ChannelStore.getCurrentId()
    });
}

export function emitPostFocusEvent(postId) {
    Client.getPostById(
        postId,
        (data) => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_FOCUSED_POST,
                postId,
                post_list: data
            });

            AsyncClient.getPostsBefore(postId, 0, Constants.POST_FOCUS_CONTEXT_RADIUS);
            AsyncClient.getPostsAfter(postId, 0, Constants.POST_FOCUS_CONTEXT_RADIUS);
        }
    );
}

export function emitPostFocusRightHandSideFromSearch(post, isMentionSearch) {
    Client.getPost(
        post.channel_id,
        post.id,
        (data) => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_POSTS,
                id: post.channel_id,
                numRequested: 0,
                post_list: data
            });

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_POST_SELECTED,
                postId: Utils.getRootId(post),
                from_search: SearchStore.getSearchTerm()
            });

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_SEARCH,
                results: null,
                is_mention_search: isMentionSearch
            });
        },
        (err) => {
            AsyncClient.dispatchError(err, 'getPost');
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
        type: ActionTypes.RECEIVED_POST,
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

export function showDeletePostModal(post, commentCount = 0) {
    AppDispatcher.handleViewAction({
        type: ActionTypes.TOGGLE_DELETE_POST_MODAL,
        value: true,
        post,
        commentCount
    });
}

export function showGetPostLinkModal(post) {
    AppDispatcher.handleViewAction({
        type: ActionTypes.TOGGLE_GET_POST_LINK_MODAL,
        value: true,
        post
    });
}

export function showGetTeamInviteLinkModal() {
    AppDispatcher.handleViewAction({
        type: Constants.ActionTypes.TOGGLE_GET_TEAM_INVITE_LINK_MODAL,
        value: true
    });
}

export function showInviteMemberModal() {
    AppDispatcher.handleViewAction({
        type: ActionTypes.TOGGLE_INVITE_MEMBER_MODAL,
        value: true
    });
}

export function showRegisterAppModal() {
    AppDispatcher.handleViewAction({
        type: ActionTypes.TOGGLE_REGISTER_APP_MODAL,
        value: true
    });
}

export function emitSuggestionPretextChanged(suggestionId, pretext) {
    AppDispatcher.handleViewAction({
        type: ActionTypes.SUGGESTION_PRETEXT_CHANGED,
        id: suggestionId,
        pretext
    });
}

export function emitSelectNextSuggestion(suggestionId) {
    AppDispatcher.handleViewAction({
        type: ActionTypes.SUGGESTION_SELECT_NEXT,
        id: suggestionId
    });
}

export function emitSelectPreviousSuggestion(suggestionId) {
    AppDispatcher.handleViewAction({
        type: ActionTypes.SUGGESTION_SELECT_PREVIOUS,
        id: suggestionId
    });
}

export function emitCompleteWordSuggestion(suggestionId, term = '') {
    AppDispatcher.handleViewAction({
        type: Constants.ActionTypes.SUGGESTION_COMPLETE_WORD,
        id: suggestionId,
        term
    });
}

export function emitClearSuggestions(suggestionId) {
    AppDispatcher.handleViewAction({
        type: Constants.ActionTypes.SUGGESTION_CLEAR_SUGGESTIONS,
        id: suggestionId
    });
}

export function emitPreferenceChangedEvent(preference) {
    AppDispatcher.handleServerAction({
        type: Constants.ActionTypes.RECEIVED_PREFERENCE,
        preference
    });
}

export function emitRemovePost(post) {
    AppDispatcher.handleViewAction({
        type: Constants.ActionTypes.REMOVE_POST,
        post
    });
}

export function sendEphemeralPost(message, channelId) {
    const timestamp = Utils.getTimestamp();
    const post = {
        id: Utils.generateId(),
        user_id: '0',
        channel_id: channelId || ChannelStore.getCurrentId(),
        message,
        type: Constants.POST_TYPE_EPHEMERAL,
        create_at: timestamp,
        update_at: timestamp,
        filenames: [],
        props: {}
    };

    emitPostRecievedEvent(post);
}

export function loadTeamRequiredPage() {
    AsyncClient.getAllTeams();
}

export function newLocalizationSelected(locale) {
    Client.getTranslations(
        locale,
        (data) => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_LOCALE,
                locale,
                translations: data
            });
        },
        (err) => {
            AsyncClient.dispatchError(err, 'getTranslations');
        }
    );
}

export function viewLoggedIn() {
    AsyncClient.getChannels();
    AsyncClient.getChannelExtraInfo();
    AsyncClient.getMyTeam();
    AsyncClient.getMe();

    // Clear pending posts (shouldn't have pending posts if we are loading)
    PostStore.clearPendingPosts();
}
