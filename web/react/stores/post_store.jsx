// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var EventEmitter = require('events').EventEmitter;

var ChannelStore = require('../stores/channel_store.jsx');
var BrowserStore = require('../stores/browser_store.jsx');
var UserStore = require('../stores/user_store.jsx');

var Constants = require('../utils/constants.jsx');
var ActionTypes = Constants.ActionTypes;

var CHANGE_EVENT = 'change';
var SELECTED_POST_CHANGE_EVENT = 'selected_post_change';
var EDIT_POST_EVENT = 'edit_post';
var POSTS_VIEW_JUMP_EVENT = 'post_list_jump';
var POSTS_VIEW_RESIZE_EVENT = 'post_list_resize';

class PostStoreClass extends EventEmitter {
    constructor() {
        super();

        this.emitChange = this.emitChange.bind(this);
        this.addChangeListener = this.addChangeListener.bind(this);
        this.removeChangeListener = this.removeChangeListener.bind(this);

        this.emitSelectedPostChange = this.emitSelectedPostChange.bind(this);
        this.addSelectedPostChangeListener = this.addSelectedPostChangeListener.bind(this);
        this.removeSelectedPostChangeListener = this.removeSelectedPostChangeListener.bind(this);

        this.emitEditPost = this.emitEditPost.bind(this);
        this.addEditPostListener = this.addEditPostListener.bind(this);
        this.removeEditPostListener = this.removeEditPostListner.bind(this);

        this.emitPostsViewJump = this.emitPostsViewJump.bind(this);
        this.addPostsViewJumpListener = this.addPostsViewJumpListener.bind(this);
        this.removePostsViewJumpListener = this.removePostsViewJumpListener.bind(this);

        this.emitPostsViewResize = this.emitPostsViewResize.bind(this);
        this.addPostsViewResizeListener = this.addPostsViewResizeListener.bind(this);
        this.removePostsViewResizeListener = this.removePostsViewResizeListener.bind(this);

        this.getCurrentPosts = this.getCurrentPosts.bind(this);
        this.storePosts = this.storePosts.bind(this);
        this.pStorePosts = this.pStorePosts.bind(this);
        this.getPosts = this.getPosts.bind(this);
        this.storePost = this.storePost.bind(this);
        this.pStorePost = this.pStorePost.bind(this);
        this.removePost = this.removePost.bind(this);
        this.storePendingPost = this.storePendingPost.bind(this);
        this.pStorePendingPosts = this.pStorePendingPosts.bind(this);
        this.getPendingPosts = this.getPendingPosts.bind(this);
        this.storeUnseenDeletedPost = this.storeUnseenDeletedPost.bind(this);
        this.storeUnseenDeletedPosts = this.storeUnseenDeletedPosts.bind(this);
        this.getUnseenDeletedPosts = this.getUnseenDeletedPosts.bind(this);
        this.clearUnseenDeletedPosts = this.clearUnseenDeletedPosts.bind(this);
        this.removePendingPost = this.removePendingPost.bind(this);
        this.pRemovePendingPost = this.pRemovePendingPost.bind(this);
        this.clearPendingPosts = this.clearPendingPosts.bind(this);
        this.updatePendingPost = this.updatePendingPost.bind(this);
        this.storeSelectedPost = this.storeSelectedPost.bind(this);
        this.getSelectedPost = this.getSelectedPost.bind(this);
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

    emitSelectedPostChange(fromSearch) {
        this.emit(SELECTED_POST_CHANGE_EVENT, fromSearch);
    }

    addSelectedPostChangeListener(callback) {
        this.on(SELECTED_POST_CHANGE_EVENT, callback);
    }

    removeSelectedPostChangeListener(callback) {
        this.removeListener(SELECTED_POST_CHANGE_EVENT, callback);
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

    emitPostsViewResize() {
        this.emit(POSTS_VIEW_RESIZE_EVENT);
    }

    addPostsViewResizeListener(callback) {
        this.on(POSTS_VIEW_RESIZE_EVENT, callback);
    }

    removePostsViewResizeListener(callback) {
        this.removeListener(POSTS_VIEW_RESIZE_EVENT, callback);
    }

    getCurrentPosts() {
        var currentId = ChannelStore.getCurrentId();

        if (currentId != null) {
            return this.getPosts(currentId);
        }
        return null;
    }
    storePosts(channelId, newPostsView) {
        if (isPostListNull(newPostsView)) {
            return;
        }

        var postList = makePostListNonNull(this.getPosts(channelId));

        for (const pid in newPostsView.posts) {
            if (newPostsView.posts.hasOwnProperty(pid)) {
                const np = newPostsView.posts[pid];
                if (np.delete_at === 0) {
                    postList.posts[pid] = np;
                    if (postList.order.indexOf(pid) === -1) {
                        postList.order.push(pid);
                    }
                } else {
                    if (pid in postList.posts) {
                        delete postList.posts[pid];
                    }

                    const index = postList.order.indexOf(pid);
                    if (index !== -1) {
                        postList.order.splice(index, 1);
                    }
                }
            }
        }

        postList.order.sort((a, b) => {
            if (postList.posts[a].create_at > postList.posts[b].create_at) {
                return -1;
            }
            if (postList.posts[a].create_at < postList.posts[b].create_at) {
                return 1;
            }

            return 0;
        });

        var latestUpdate = 0;
        for (var pid in postList.posts) {
            if (postList.posts[pid].update_at > latestUpdate) {
                latestUpdate = postList.posts[pid].update_at;
            }
        }

        this.storeLatestUpdate(channelId, latestUpdate);
        this.pStorePosts(channelId, postList);
        this.emitChange();
    }
    pStorePosts(channelId, posts) {
        BrowserStore.setItem('posts_' + channelId, posts);
    }
    getPosts(channelId) {
        return BrowserStore.getItem('posts_' + channelId);
    }
    getCurrentUsersLatestPost(channelId, rootId) {
        const userId = UserStore.getCurrentId();
        var postList = makePostListNonNull(this.getPosts(channelId));
        var i = 0;
        var len = postList.order.length;
        var lastPost = null;

        for (i; i < len; i++) {
            let post = postList.posts[postList.order[i]];
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
    storePost(post) {
        this.pStorePost(post);
        this.emitChange();
    }
    pStorePost(post) {
        var postList = this.getPosts(post.channel_id);
        postList = makePostListNonNull(postList);

        if (post.pending_post_id !== '') {
            this.removePendingPost(post.channel_id, post.pending_post_id);
        }

        post.pending_post_id = '';

        postList.posts[post.id] = post;
        if (postList.order.indexOf(post.id) === -1) {
            postList.order.unshift(post.id);
        }

        this.pStorePosts(post.channel_id, postList);
    }
    removePost(postId, channelId) {
        var postList = this.getPosts(channelId);
        if (isPostListNull(postList)) {
            return;
        }

        if (postId in postList.posts) {
            delete postList.posts[postId];
        }

        var index = postList.order.indexOf(postId);
        if (index !== -1) {
            postList.order.splice(index, 1);
        }

        this.pStorePosts(channelId, postList);
    }
    storePendingPost(post) {
        post.state = Constants.POST_LOADING;

        var postList = this.getPendingPosts(post.channel_id);
        postList = makePostListNonNull(postList);

        postList.posts[post.pending_post_id] = post;
        postList.order.unshift(post.pending_post_id);
        this.pStorePendingPosts(post.channel_id, postList);
        this.emitChange();
    }
    pStorePendingPosts(channelId, postList) {
        var posts = postList.posts;

        // sort failed posts to the bottom
        postList.order.sort((a, b) => {
            if (posts[a].state === Constants.POST_LOADING && posts[b].state === Constants.POST_FAILED) {
                return 1;
            }
            if (posts[a].state === Constants.POST_FAILED && posts[b].state === Constants.POST_LOADING) {
                return -1;
            }

            if (posts[a].create_at > posts[b].create_at) {
                return -1;
            }
            if (posts[a].create_at < posts[b].create_at) {
                return 1;
            }

            return 0;
        });

        BrowserStore.setGlobalItem('pending_posts_' + channelId, postList);
    }
    getPendingPosts(channelId) {
        return BrowserStore.getGlobalItem('pending_posts_' + channelId);
    }
    storeUnseenDeletedPost(post) {
        var posts = this.getUnseenDeletedPosts(post.channel_id);

        if (!posts) {
            posts = {};
        }

        post.message = '(message deleted)';
        post.state = Constants.POST_DELETED;
        post.filenames = [];

        posts[post.id] = post;
        this.storeUnseenDeletedPosts(post.channel_id, posts);
    }
    storeUnseenDeletedPosts(channelId, posts) {
        BrowserStore.setItem('deleted_posts_' + channelId, posts);
    }
    getUnseenDeletedPosts(channelId) {
        return BrowserStore.getItem('deleted_posts_' + channelId);
    }
    clearUnseenDeletedPosts(channelId) {
        BrowserStore.setItem('deleted_posts_' + channelId, {});
    }
    removePendingPost(channelId, pendingPostId) {
        this.pRemovePendingPost(channelId, pendingPostId);
        this.emitChange();
    }
    pRemovePendingPost(channelId, pendingPostId) {
        var postList = this.getPendingPosts(channelId);
        postList = makePostListNonNull(postList);

        if (pendingPostId in postList.posts) {
            delete postList.posts[pendingPostId];
        }
        var index = postList.order.indexOf(pendingPostId);
        if (index !== -1) {
            postList.order.splice(index, 1);
        }

        this.pStorePendingPosts(channelId, postList);
    }
    clearPendingPosts() {
        BrowserStore.actionOnGlobalItemsWithPrefix('pending_posts_', (key) => {
            BrowserStore.removeItem(key);
        });
    }
    updatePendingPost(post) {
        var postList = this.getPendingPosts(post.channel_id);
        postList = makePostListNonNull(postList);

        if (postList.order.indexOf(post.pending_post_id) === -1) {
            return;
        }

        postList.posts[post.pending_post_id] = post;
        this.pStorePendingPosts(post.channel_id, postList);
        this.emitChange();
    }
    storeSelectedPost(postList) {
        BrowserStore.setItem('select_post', postList);
    }
    getSelectedPost() {
        return BrowserStore.getItem('select_post');
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
        BrowserStore.setItem('latest_post_' + channelId, time);
    }
    getLatestUpdate(channelId) {
        return BrowserStore.getItem('latest_post_' + channelId, 0);
    }
}

var PostStore = new PostStoreClass();

PostStore.dispatchToken = AppDispatcher.register((payload) => {
    var action = payload.action;

    switch (action.type) {
    case ActionTypes.RECIEVED_POSTS:
        PostStore.storePosts(action.id, makePostListNonNull(action.post_list));
        break;
    case ActionTypes.RECIEVED_POST:
        PostStore.pStorePost(action.post);
        PostStore.emitChange();
        break;
    case ActionTypes.RECIEVED_POST_SELECTED:
        PostStore.storeSelectedPost(action.post_list);
        PostStore.emitSelectedPostChange(action.from_search);
        break;
    case ActionTypes.RECIEVED_EDIT_POST:
        PostStore.emitEditPost(action);
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
