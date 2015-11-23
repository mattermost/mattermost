// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import EventEmitter from 'events';

import ChannelStore from '../stores/channel_store.jsx';
import BrowserStore from '../stores/browser_store.jsx';
import UserStore from '../stores/user_store.jsx';

import Constants from '../utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;

const CHANGE_EVENT = 'change';
const FOCUSED_POST_CHANGE = 'focused_post_change';
const EDIT_POST_EVENT = 'edit_post';
const POSTS_VIEW_JUMP_EVENT = 'post_list_jump';
const SELECTED_POST_CHANGE_EVENT = 'selected_post_change';

class PostStoreClass extends EventEmitter {
    constructor() {
        super();

        this.emitChange = this.emitChange.bind(this);
        this.addChangeListener = this.addChangeListener.bind(this);
        this.removeChangeListener = this.removeChangeListener.bind(this);

        this.emitEditPost = this.emitEditPost.bind(this);
        this.addEditPostListener = this.addEditPostListener.bind(this);
        this.removeEditPostListener = this.removeEditPostListner.bind(this);

        this.emitPostsViewJump = this.emitPostsViewJump.bind(this);
        this.addPostsViewJumpListener = this.addPostsViewJumpListener.bind(this);
        this.removePostsViewJumpListener = this.removePostsViewJumpListener.bind(this);

        this.emitPostFocused = this.emitPostFocused.bind(this);
        this.addPostFocusedListener = this.addPostFocusedListener.bind(this);
        this.removePostFocusedListener = this.removePostFocusedListener.bind(this);

        this.makePostsInfo = this.makePostsInfo.bind(this);

        this.getAllPosts = this.getAllPosts.bind(this);
        this.getEarliestPost = this.getEarliestPost.bind(this);
        this.getLatestPost = this.getLatestPost.bind(this);
        this.getVisiblePosts = this.getVisiblePosts.bind(this);
        this.getVisibilityAtTop = this.getVisibilityAtTop.bind(this);
        this.getVisibilityAtBottom = this.getVisibilityAtBottom.bind(this);
        this.requestVisibilityIncrease = this.requestVisibilityIncrease.bind(this);
        this.getFocusedPostId = this.getFocusedPostId.bind(this);

        this.storePosts = this.storePosts.bind(this);
        this.storePost = this.storePost.bind(this);
        this.storeFocusedPost = this.storeFocusedPost.bind(this);
        this.checkBounds = this.checkBounds.bind(this);

        this.clearFocusedPost = this.clearFocusedPost.bind(this);
        this.clearChannelVisibility = this.clearChannelVisibility.bind(this);

        this.removePost = this.removePost.bind(this);

        this.getPendingPosts = this.getPendingPosts.bind(this);
        this.storePendingPost = this.storePendingPost.bind(this);
        this.removePendingPost = this.removePendingPost.bind(this);
        this.clearPendingPosts = this.clearPendingPosts.bind(this);
        this.updatePendingPost = this.updatePendingPost.bind(this);

        this.storeUnseenDeletedPost = this.storeUnseenDeletedPost.bind(this);
        this.getUnseenDeletedPosts = this.getUnseenDeletedPosts.bind(this);
        this.clearUnseenDeletedPosts = this.clearUnseenDeletedPosts.bind(this);

        // These functions are bad and work should be done to remove this system when the RHS dies
        this.storeSelectedPost = this.storeSelectedPost.bind(this);
        this.getSelectedPost = this.getSelectedPost.bind(this);
        this.emitSelectedPostChange = this.emitSelectedPostChange.bind(this);
        this.addSelectedPostChangeListener = this.addSelectedPostChangeListener.bind(this);
        this.removeSelectedPostChangeListener = this.removeSelectedPostChangeListener.bind(this);
        this.selectedPost = null;

        this.getEmptyDraft = this.getEmptyDraft.bind(this);
        this.storeCurrentDraft = this.storeCurrentDraft.bind(this);
        this.getCurrentDraft = this.getCurrentDraft.bind(this);
        this.storeDraft = this.storeDraft.bind(this);
        this.getDraft = this.getDraft.bind(this);
        this.storeCommentDraft = this.storeCommentDraft.bind(this);
        this.getCommentDraft = this.getCommentDraft.bind(this);
        this.clearDraftUploads = this.clearDraftUploads.bind(this);
        this.clearCommentDraftUploads = this.clearCommentDraftUploads.bind(this);
        this.storeLatestUpdate = this.storeLatestUpdate.bind(this);
        this.getLatestUpdate = this.getLatestUpdate.bind(this);
        this.getCurrentUsersLatestPost = this.getCurrentUsersLatestPost.bind(this);
        this.getCommentCount = this.getCommentCount.bind(this);

        this.postsInfo = {};
        this.currentFocusedPostId = null;
    }
    emitChange() {
        this.emit(CHANGE_EVENT);
    }

    addChangeListener(callback) {
        this.on(CHANGE_EVENT, callback);
    }

    removeChangeListener(callback) {
        this.removeListener(CHANGE_EVENT, callback);
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

    emitPostsViewJump(type, post) {
        this.emit(POSTS_VIEW_JUMP_EVENT, type, post);
    }

    addPostsViewJumpListener(callback) {
        this.on(POSTS_VIEW_JUMP_EVENT, callback);
    }

    removePostsViewJumpListener(callback) {
        this.removeListener(POSTS_VIEW_JUMP_EVENT, callback);
    }

    jumpPostsViewToBottom() {
        this.emitPostsViewJump(Constants.PostsViewJumpTypes.BOTTOM, null);
    }

    jumpPostsViewToPost(post) {
        this.emitPostsViewJump(Constants.PostsViewJumpTypes.POST, post);
    }

    jumpPostsViewSidebarOpen() {
        this.emitPostsViewJump(Constants.PostsViewJumpTypes.SIDEBAR_OPEN, null);
    }

    // All this does is makes sure the postsInfo is not null for the specified channel
    makePostsInfo(id) {
        if (!this.postsInfo.hasOwnProperty(id)) {
            this.postsInfo[id] = {};
        }
    }

    getAllPosts(id) {
        if (this.postsInfo.hasOwnProperty(id)) {
            return Object.assign({}, this.postsInfo[id].postList);
        }

        return null;
    }

    getEarliestPost(id) {
        if (this.postsInfo.hasOwnProperty(id)) {
            return this.postsInfo[id].postList.posts[this.postsInfo[id].postList.order[this.postsInfo[id].postList.order.length - 1]];
        }

        return null;
    }

    getLatestPost(id) {
        if (this.postsInfo.hasOwnProperty(id)) {
            return this.postsInfo[id].postList.posts[this.postsInfo[id].postList.order[0]];
        }

        return null;
    }

    getVisiblePosts(id) {
        if (this.postsInfo.hasOwnProperty(id) && this.postsInfo[id].hasOwnProperty('postList')) {
            const postList = JSON.parse(JSON.stringify(this.postsInfo[id].postList));

            // Only limit visibility if we are not focused on a post
            if (this.currentFocusedPostId === null) {
                postList.order = postList.order.slice(0, this.postsInfo[id].endVisible);
            }

            // Add pending posts
            if (this.postsInfo[id].hasOwnProperty('pendingPosts')) {
                Object.assign(postList.posts, this.postsInfo[id].pendingPosts.posts);
                postList.order = this.postsInfo[id].pendingPosts.order.concat(postList.order);
            }

            // Add delteted posts
            if (this.postsInfo[id].hasOwnProperty('deletedPosts')) {
                Object.assign(postList.posts, this.postsInfo[id].deletedPosts);

                for (const postID in this.postsInfo[id].deletedPosts) {
                    if (this.postsInfo[id].deletedPosts.hasOwnProperty(postID)) {
                        postList.order.push(postID);
                    }
                }

                // Merge would be faster
                postList.order.sort((a, b) => {
                    if (postList.posts[a].create_at > postList.posts[b].create_at) {
                        return -1;
                    }
                    if (postList.posts[a].create_at < postList.posts[b].create_at) {
                        return 1;
                    }
                    return 0;
                });
            }

            return postList;
        }

        return null;
    }

    getVisibilityAtTop(id) {
        if (this.postsInfo.hasOwnProperty(id)) {
            return this.postsInfo[id].atTop && this.postsInfo[id].endVisible >= this.postsInfo[id].postList.order.length;
        }

        return false;
    }

    getVisibilityAtBottom(id) {
        if (this.postsInfo.hasOwnProperty(id)) {
            return this.postsInfo[id].atBottom;
        }

        return false;
    }

    // Returns true if posts need to be fetched
    requestVisibilityIncrease(id, ammount) {
        const endVisible = this.postsInfo[id].endVisible;
        const postList = this.postsInfo[id].postList;
        if (this.getVisibilityAtTop(id)) {
            return false;
        }
        this.postsInfo[id].endVisible += ammount;
        this.emitChange();
        return endVisible + ammount > postList.order.length;
    }

    getFocusedPostId() {
        return this.currentFocusedPostId;
    }

    storePosts(id, newPosts) {
        if (isPostListNull(newPosts)) {
            return;
        }

        const combinedPosts = makePostListNonNull(this.getAllPosts(id));

        for (const pid in newPosts.posts) {
            if (newPosts.posts.hasOwnProperty(pid)) {
                const np = newPosts.posts[pid];
                if (np.delete_at === 0) {
                    combinedPosts.posts[pid] = np;
                    if (combinedPosts.order.indexOf(pid) === -1) {
                        combinedPosts.order.push(pid);
                    }
                } else {
                    if (pid in combinedPosts.posts) {
                        Reflect.deleteProperty(combinedPosts.posts, pid);
                    }

                    const index = combinedPosts.order.indexOf(pid);
                    if (index !== -1) {
                        combinedPosts.order.splice(index, 1);
                    }
                }
            }
        }

        combinedPosts.order.sort((a, b) => {
            if (combinedPosts.posts[a].create_at > combinedPosts.posts[b].create_at) {
                return -1;
            }
            if (combinedPosts.posts[a].create_at < combinedPosts.posts[b].create_at) {
                return 1;
            }

            return 0;
        });

        this.makePostsInfo(id);
        this.postsInfo[id].postList = combinedPosts;
    }

    storePost(post) {
        const postList = makePostListNonNull(this.getAllPosts(post.channel_id));

        if (post.pending_post_id !== '') {
            this.removePendingPost(post.channel_id, post.pending_post_id);
        }

        post.pending_post_id = '';

        postList.posts[post.id] = post;
        if (postList.order.indexOf(post.id) === -1) {
            postList.order.unshift(post.id);
        }

        this.makePostsInfo(post.channel_id);
        this.postsInfo[post.channel_id].postList = postList;
    }

    storeFocusedPost(postId, postList) {
        const focusedPost = postList.posts[postId];
        if (!focusedPost) {
            return;
        }
        this.currentFocusedPostId = postId;
        this.storePosts(postId, postList);
    }

    checkBounds(id, numRequested, postList, before) {
        if (numRequested > postList.order.length) {
            if (before) {
                this.postsInfo[id].atTop = true;
            } else {
                this.postsInfo[id].atBottom = true;
            }
        }
    }

    clearFocusedPost() {
        if (this.currentFocusedPostId != null) {
            Reflect.deleteProperty(this.postsInfo, this.currentFocusedPostId);
            this.currentFocusedPostId = null;
        }
    }

    clearChannelVisibility(id, atBottom) {
        this.makePostsInfo(id);
        this.postsInfo[id].endVisible = Constants.POST_CHUNK_SIZE;
        this.postsInfo[id].atTop = false;
        this.postsInfo[id].atBottom = atBottom;
    }

    removePost(post) {
        const channelId = post.channel_id;
        this.makePostsInfo(channelId);
        const postList = this.postsInfo[channelId].postList;
        if (isPostListNull(postList)) {
            return;
        }

        if (post.id in postList.posts) {
            Reflect.deleteProperty(postList.posts, post.id);
        }

        const index = postList.order.indexOf(post.id);
        if (index !== -1) {
            postList.order.splice(index, 1);
        }

        this.postsInfo[channelId].postList = postList;
    }

    getPendingPosts(channelId) {
        if (this.postsInfo.hasOwnProperty(channelId)) {
            return this.postsInfo[channelId].pendingPosts;
        }

        return null;
    }

    storePendingPost(post) {
        post.state = Constants.POST_LOADING;

        const postList = makePostListNonNull(this.getPendingPosts(post.channel_id));

        postList.posts[post.pending_post_id] = post;
        postList.order.unshift(post.pending_post_id);

        this.makePostsInfo(post.channel_id);
        this.postsInfo[post.channel_id].pendingPosts = postList;
        this.emitChange();
    }

    removePendingPost(channelId, pendingPostId) {
        const postList = makePostListNonNull(this.getPendingPosts(channelId));

        Reflect.deleteProperty(postList.posts, pendingPostId);
        const index = postList.order.indexOf(pendingPostId);
        if (index !== -1) {
            postList.order.splice(index, 1);
        }

        this.postsInfo[channelId].pendingPosts = postList;
        this.emitChange();
    }

    clearPendingPosts(channelId) {
        if (this.postsInfo.hasOwnProperty(channelId)) {
            Reflect.deleteProperty(this.postsInfo[channelId], 'pendingPosts');
        }
    }

    updatePendingPost(post) {
        const postList = makePostListNonNull(this.getPendingPosts(post.channel_id));

        if (postList.order.indexOf(post.pending_post_id) === -1) {
            return;
        }

        postList.posts[post.pending_post_id] = post;
        this.postsInfo[post.channel_id].pendingPosts = postList;
        this.emitChange();
    }

    storeUnseenDeletedPost(post) {
        let posts = this.getUnseenDeletedPosts(post.channel_id);

        if (!posts) {
            posts = {};
        }

        post.message = '(message deleted)';
        post.state = Constants.POST_DELETED;
        post.filenames = [];

        posts[post.id] = post;
        this.postsInfo[post.channel_id].deletedPosts = posts;
    }

    getUnseenDeletedPosts(channelId) {
        if (this.postsInfo.hasOwnProperty(channelId)) {
            return this.postsInfo[channelId].deletedPosts;
        }

        return null;
    }

    clearUnseenDeletedPosts(channelId) {
        if (this.postsInfo.hasOwnProperty(channelId)) {
            Reflect.deleteProperty(this.postsInfo[channelId], 'deletedPosts');
        }
    }

    storeSelectedPost(postList) {
        this.selectedPost = postList;
    }

    getSelectedPost() {
        return this.selectedPost;
    }

    emitSelectedPostChange(fromSearch) {
        this.emit(SELECTED_POST_CHANGE_EVENT, fromSearch);
    }

    addSelectedPostChangeListener(callback) {
        this.on(SELECTED_POST_CHANGE_EVENT, callback);
    }

    removeSelectedPostChangeListener(callback) {
        this.removeListener(SELECTED_POST_CHANGE_EVENT, callback);
    }

    getCurrentUsersLatestPost(channelId, rootId) {
        const userId = UserStore.getCurrentId();
        var postList = makePostListNonNull(this.getAllPosts(channelId));
        var i = 0;
        var len = postList.order.length;
        var lastPost = null;

        for (i; i < len; i++) {
            const post = postList.posts[postList.order[i]];
            if (post.user_id === userId && (post.props && !post.props.from_webhook || !post.props)) {
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
        }

        return lastPost;
    }

    getEmptyDraft() {
        return {message: '', uploadsInProgress: [], previews: []};
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
        return BrowserStore.getGlobalItem('draft_' + channelId, this.getEmptyDraft());
    }
    storeCommentDraft(parentPostId, draft) {
        BrowserStore.setGlobalItem('comment_draft_' + parentPostId, draft);
    }
    getCommentDraft(parentPostId) {
        return BrowserStore.getGlobalItem('comment_draft_' + parentPostId, this.getEmptyDraft());
    }
    clearDraftUploads() {
        BrowserStore.actionOnGlobalItemsWithPrefix('draft_', (key, value) => {
            if (value) {
                value.uploadsInProgress = [];
                BrowserStore.setItem(key, value);
            }
        });
    }
    clearCommentDraftUploads() {
        BrowserStore.actionOnGlobalItemsWithPrefix('comment_draft_', (key, value) => {
            if (value) {
                value.uploadsInProgress = [];
                BrowserStore.setItem(key, value);
            }
        });
    }
    storeLatestUpdate(channelId, time) {
        if (!this.postsInfo.hasOwnProperty(channelId)) {
            this.postsInfo[channelId] = {};
        }
        this.postsInfo[channelId].latestPost = time;
    }
    getLatestUpdate(channelId) {
        if (this.postsInfo.hasOwnProperty(channelId) && this.postsInfo[channelId].hasOwnProperty('latestPost')) {
            return this.postsInfo[channelId].latestPost;
        }

        return 0;
    }
    getCommentCount(post) {
        const posts = this.getPosts(post.channel_id).posts;

        let commentCount = 0;
        for (const id in posts) {
            if (posts.hasOwnProperty(id)) {
                if (posts[id].root_id === post.id) {
                    commentCount += 1;
                }
            }
        }

        return commentCount;
    }
}

var PostStore = new PostStoreClass();

PostStore.dispatchToken = AppDispatcher.register((payload) => {
    var action = payload.action;

    switch (action.type) {
    case ActionTypes.RECIEVED_POSTS: {
        const id = PostStore.currentFocusedPostId == null ? action.id : PostStore.currentFocusedPostId;
        PostStore.checkBounds(id, action.numRequested, makePostListNonNull(action.post_list), action.before);
        PostStore.storePosts(id, makePostListNonNull(action.post_list));
        PostStore.emitChange();
        break;
    }
    case ActionTypes.RECIEVED_FOCUSED_POST:
        PostStore.clearChannelVisibility(action.postId, false);
        PostStore.storeFocusedPost(action.postId, makePostListNonNull(action.post_list));
        PostStore.emitChange();
        break;
    case ActionTypes.RECIEVED_POST:
        PostStore.storePost(action.post);
        PostStore.emitChange();
        break;
    case ActionTypes.RECIEVED_EDIT_POST:
        PostStore.emitEditPost(action);
        PostStore.emitChange();
        break;
    case ActionTypes.CLICK_CHANNEL:
        PostStore.clearFocusedPost();
        PostStore.clearChannelVisibility(action.id, true);
        PostStore.clearUnseenDeletedPosts(action.id);
        break;
    case ActionTypes.CREATE_POST:
        PostStore.storePendingPost(action.post);
        PostStore.storeDraft(action.post.channel_id, null);
        PostStore.jumpPostsViewToBottom();
        break;
    case ActionTypes.POST_DELETED:
        PostStore.storeUnseenDeletedPost(action.post);
        PostStore.removePost(action.post);
        PostStore.emitChange();
        break;
    case ActionTypes.RECIEVED_POST_SELECTED:
        PostStore.storeSelectedPost(action.post_list);
        PostStore.emitSelectedPostChange(action.from_search);
        break;
    default:
    }
});

export default PostStore;

function makePostListNonNull(pl) {
    var postList = pl;
    if (postList == null) {
        postList = {order: [], posts: {}};
    }

    if (postList.order == null) {
        postList.order = [];
    }

    if (postList.posts == null) {
        postList.posts = {};
    }

    return postList;
}

function isPostListNull(pl) {
    if (pl == null) {
        return true;
    }

    if (pl.posts == null) {
        return true;
    }

    if (pl.order == null) {
        return true;
    }

    return false;
}
