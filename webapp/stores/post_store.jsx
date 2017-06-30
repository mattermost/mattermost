// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import EventEmitter from 'events';

import ChannelStore from 'stores/channel_store.jsx';
import BrowserStore from 'stores/browser_store.jsx';
import UserStore from 'stores/user_store.jsx';

import * as PostUtils from 'utils/post_utils.jsx';
import {Constants} from 'utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;

const FOCUSED_POST_CHANGE = 'focused_post_change';
const EDIT_POST_EVENT = 'edit_post';
const POST_PINNED_CHANGE_EVENT = 'post_pinned_change';

import store from 'stores/redux_store.jsx';
const dispatch = store.dispatch;
const getState = store.getState;

import * as Selectors from 'mattermost-redux/selectors/entities/posts';

class PostStoreClass extends EventEmitter {
    constructor() {
        super();
        this.selectedPostId = null;
        this.currentFocusedPostId = null;
    }

    emitPostFocused() {
        this.emit(FOCUSED_POST_CHANGE);
    }

    addPostFocusedListener(callback) {
        this.on(FOCUSED_POST_CHANGE, callback);
    }

    removePostFocusedListener(callback) {
        this.removeListener(FOCUSED_POST_CHANGE, callback);
    }

    emitEditPost(post) {
        this.emit(EDIT_POST_EVENT, post);
    }

    addEditPostListener(callback) {
        this.on(EDIT_POST_EVENT, callback);
    }

    removeEditPostListner(callback) {
        this.removeListener(EDIT_POST_EVENT, callback);
    }

    emitPostPinnedChange() {
        this.emit(POST_PINNED_CHANGE_EVENT);
    }

    addPostPinnedChangeListener(callback) {
        this.on(POST_PINNED_CHANGE_EVENT, callback);
    }

    removePostPinnedChangeListener(callback) {
        this.removeListener(POST_PINNED_CHANGE_EVENT, callback);
    }

    getLatestPostId(channelId) {
        const postsInChannel = getState().entities.posts.postsInChannel[channelId] || [];
        return postsInChannel[0];
    }

    getLatestReplyablePost(channelId) {
        const postIds = getState().entities.posts.postsInChannel[channelId] || [];
        const posts = getState().entities.posts.posts;

        for (const postId of postIds) {
            const post = posts[postId] || {};
            if (post.state !== Constants.POST_DELETED && !PostUtils.isSystemMessage(post)) {
                return post;
            }
        }

        return null;
    }

    getVisiblePosts() {
        const posts = Selectors.getPostsInCurrentChannel(getState());
        const currentChannelId = getState().entities.channels.currentChannelId;
        return posts.slice(0, getState().views.channel.postVisibility[currentChannelId]);
    }

    getFocusedPostId() {
        return this.currentFocusedPostId;
    }

    storeFocusedPostId(postId) {
        this.currentFocusedPostId = postId;
    }

    clearFocusedPost() {
        this.currentFocusedPostId = null;
    }

    getCurrentUsersLatestPost(channelId, rootId) {
        const userId = UserStore.getCurrentId();

        const postIds = getState().entities.posts.postsInChannel[channelId] || [];

        let lastPost = null;

        for (const id of postIds) {
            const post = Selectors.getPost(getState(), id) || {};

            // don't edit webhook posts, deleted posts, or system messages
            if (post.user_id !== userId ||
                (post.props && post.props.from_webhook) ||
                post.state === Constants.POST_DELETED ||
                (post.type && post.type.startsWith(Constants.SYSTEM_MESSAGE_PREFIX))) {
                continue;
            }

            if (rootId) {
                if (post.root_id === rootId || post.id === rootId) {
                    lastPost = post;
                    break;
                }
            } else {
                lastPost = post;
                break;
            }
        }

        return lastPost;
    }

    normalizeDraft(originalDraft) {
        let draft = {
            message: '',
            uploadsInProgress: [],
            fileInfos: []
        };

        // Make sure that the post draft is non-null and has all the required fields
        if (originalDraft) {
            draft = {
                message: originalDraft.message || draft.message,
                uploadsInProgress: originalDraft.uploadsInProgress || draft.uploadsInProgress,
                fileInfos: originalDraft.fileInfos || draft.fileInfos
            };
        }

        return draft;
    }

    storeCurrentDraft(draft) {
        var channelId = ChannelStore.getCurrentId();
        BrowserStore.setGlobalItem('draft_' + channelId, draft);
    }

    getCurrentDraft() {
        var channelId = ChannelStore.getCurrentId();
        return this.getDraft(channelId);
    }

    storeDraft(channelId, draft) {
        BrowserStore.setGlobalItem('draft_' + channelId, draft);
    }

    getDraft(channelId) {
        return this.normalizeDraft(BrowserStore.getGlobalItem('draft_' + channelId));
    }

    storeCommentDraft(parentPostId, draft) {
        BrowserStore.setGlobalItem('comment_draft_' + parentPostId, draft);
    }

    getCommentDraft(parentPostId) {
        return this.normalizeDraft(BrowserStore.getGlobalItem('comment_draft_' + parentPostId));
    }

    clearDraftUploads() {
        BrowserStore.actionOnGlobalItemsWithPrefix('draft_', (key, value) => {
            if (value) {
                value.uploadsInProgress = [];
                BrowserStore.setGlobalItem(key, value);
            }
        });
    }

    clearCommentDraftUploads() {
        BrowserStore.actionOnGlobalItemsWithPrefix('comment_draft_', (key, value) => {
            if (value) {
                value.uploadsInProgress = [];
                BrowserStore.setGlobalItem(key, value);
            }
        });
    }

    getCommentCount(rootPost) {
        const postIds = getState().entities.posts.postsInChannel[rootPost.channel_id] || [];

        let commentCount = 0;
        for (const postId of postIds) {
            const post = Selectors.getPost(getState(), postId) || {};
            if (post.root_id === rootPost.id) {
                commentCount += 1;
            }
        }

        return commentCount;
    }
}

var PostStore = new PostStoreClass();

PostStore.dispatchToken = AppDispatcher.register((payload) => {
    var action = payload.action;

    switch (action.type) {
    case ActionTypes.RECEIVED_FOCUSED_POST:
        PostStore.storeFocusedPostId(action.postId);
        PostStore.emitPostFocused();
        break;
    case ActionTypes.CLICK_CHANNEL:
        PostStore.clearFocusedPost();
        break;
    case ActionTypes.RECEIVED_EDIT_POST:
        PostStore.emitEditPost(action);
        break;
    case ActionTypes.RECEIVED_POST_SELECTED:
        dispatch({...action, type: ActionTypes.SELECT_POST});
        break;
    case ActionTypes.RECEIVED_POST_PINNED:
    case ActionTypes.RECEIVED_POST_UNPINNED:
        PostStore.emitPostPinnedChange();
        break;
    default:
    }
});

export default PostStore;
