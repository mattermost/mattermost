// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import EventEmitter from 'events';

import ChannelStore from 'stores/channel_store.jsx';
import BrowserStore from 'stores/browser_store.jsx';
import UserStore from 'stores/user_store.jsx';

import Constants from 'utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;

const CHANGE_EVENT = 'change';
const FOCUSED_POST_CHANGE = 'focused_post_change';
const EDIT_POST_EVENT = 'edit_post';
const POSTS_VIEW_JUMP_EVENT = 'post_list_jump';
const SELECTED_POST_CHANGE_EVENT = 'selected_post_change';

class PostStoreClass extends EventEmitter {
    constructor() {
        super();
        this.selectedPostId = null;
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

    getPost(channelId, postId) {
        const postInfo = this.postsInfo[channelId];
        if (postInfo == null) {
            return null;
        }

        const posts = postInfo.postList;
        let post = null;

        if (posts.posts.hasOwnProperty(postId)) {
            post = posts.posts[postId];
        }

        return post;
    }

    getAllPosts(id) {
        if (this.postsInfo.hasOwnProperty(id)) {
            return this.postsInfo[id].postList;
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
                    if (combinedPosts.order.indexOf(pid) === -1 && newPosts.order.indexOf(pid) !== -1) {
                        combinedPosts.order.push(pid);
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

    storeFocusedPost(postId, channelId, postList) {
        const focusedPost = postList.posts[postId];
        if (!focusedPost) {
            return;
        }
        this.currentFocusedPostId = postId;
        this.storePosts(postId, postList);
        this.storePosts(channelId, postList);
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
        if (this.postsInfo[id].postList) {
            this.postsInfo[id].atTop = this.postsInfo[id].atTop && Constants.POST_CHUNK_SIZE >= this.postsInfo[id].postList.order.length;
        } else {
            this.postsInfo[id].atTop = false;
        }
        this.postsInfo[id].atBottom = atBottom;
    }

    deletePost(post) {
        const postInfo = this.postsInfo[post.channel_id];
        if (!postInfo) {
            // the post that has been deleted is in a channel that we haven't seen so just ignore it
            return;
        }

        const postList = this.postsInfo[post.channel_id].postList;

        if (isPostListNull(postList)) {
            return;
        }

        if (post.id in postList.posts) {
            // make sure to copy the post so that component state changes work properly
            postList.posts[post.id] = Object.assign({}, post, {
                state: Constants.POST_DELETED,
                filenames: []
            });
        }
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

        for (const pid in postList.posts) {
            if (!postList.posts.hasOwnProperty(pid)) {
                continue;
            }

            if (postList.posts[pid].root_id === post.id) {
                Reflect.deleteProperty(postList.posts, pid);
                const commentIndex = postList.order.indexOf(pid);
                if (commentIndex !== -1) {
                    postList.order.splice(commentIndex, 1);
                }
            }
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
        const copyPost = JSON.parse(JSON.stringify(post));
        copyPost.state = Constants.POST_LOADING;

        const postList = makePostListNonNull(this.getPendingPosts(copyPost.channel_id));

        postList.posts[copyPost.pending_post_id] = copyPost;
        postList.order.unshift(copyPost.pending_post_id);

        this.makePostsInfo(copyPost.channel_id);
        this.postsInfo[copyPost.channel_id].pendingPosts = postList;
        this.emitChange();
    }

    removePendingPost(channelId, pendingPostId) {
        const postList = makePostListNonNull(this.getPendingPosts(channelId));

        Reflect.deleteProperty(postList.posts, pendingPostId);
        const index = postList.order.indexOf(pendingPostId);
        if (index === -1) {
            return;
        }

        postList.order.splice(index, 1);

        this.postsInfo[channelId].pendingPosts = postList;
        this.emitChange();
    }

    clearPendingPosts(channelId) {
        if (this.postsInfo.hasOwnProperty(channelId)) {
            Reflect.deleteProperty(this.postsInfo[channelId], 'pendingPosts');
        }
    }

    updatePendingPost(post) {
        const copyPost = JSON.parse(JSON.stringify(post));
        const postList = makePostListNonNull(this.getPendingPosts(copyPost.channel_id));

        if (postList.order.indexOf(copyPost.pending_post_id) === -1) {
            return;
        }

        postList.posts[copyPost.pending_post_id] = copyPost;
        this.postsInfo[copyPost.channel_id].pendingPosts = postList;
        this.emitChange();
    }

    storeSelectedPostId(postId) {
        this.selectedPostId = postId;
    }

    getSelectedPostId() {
        return this.selectedPostId;
    }

    getSelectedPost() {
        if (this.selectedPostId == null) {
            return null;
        }

        for (const k in this.postsInfo) {
            if (this.postsInfo[k].postList.posts.hasOwnProperty(this.selectedPostId)) {
                return this.postsInfo[k].postList.posts[this.selectedPostId];
            }
        }

        return null;
    }

    getSelectedPostThread() {
        if (this.selectedPostId == null) {
            return null;
        }

        const posts = {};
        let pendingPosts;
        for (const k in this.postsInfo) {
            if (this.postsInfo[k].postList && this.postsInfo[k].postList.posts.hasOwnProperty(this.selectedPostId)) {
                Object.assign(posts, this.postsInfo[k].postList.posts);
                if (this.postsInfo[k].pendingPosts != null) {
                    pendingPosts = this.postsInfo[k].pendingPosts.posts;
                }
            }
        }

        const threadPosts = {};
        const rootId = this.selectedPostId;
        for (const k in posts) {
            if (posts[k].root_id === rootId) {
                threadPosts[k] = JSON.parse(JSON.stringify(posts[k]));
            }
        }

        for (const k in pendingPosts) {
            if (pendingPosts[k].root_id === rootId) {
                threadPosts[k] = JSON.parse(JSON.stringify(pendingPosts[k]));
            }
        }

        return threadPosts;
    }

    emitSelectedPostChange(fromSearch, fromFlaggedPosts) {
        this.emit(SELECTED_POST_CHANGE_EVENT, fromSearch, fromFlaggedPosts);
    }

    addSelectedPostChangeListener(callback) {
        this.on(SELECTED_POST_CHANGE_EVENT, callback);
    }

    removeSelectedPostChangeListener(callback) {
        this.removeListener(SELECTED_POST_CHANGE_EVENT, callback);
    }

    getCurrentUsersLatestPost(channelId, rootId) {
        const userId = UserStore.getCurrentId();

        const postList = makePostListNonNull(this.getAllPosts(channelId));
        const len = postList.order.length;

        let lastPost = null;

        for (let i = 0; i < len; i++) {
            const post = postList.posts[postList.order[i]];

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

    getCommentCount(post) {
        const posts = this.getAllPosts(post.channel_id).posts;

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
    case ActionTypes.RECEIVED_POSTS: {
        const id = PostStore.currentFocusedPostId !== null && action.isPost ? PostStore.currentFocusedPostId : action.id;
        PostStore.storePosts(id, makePostListNonNull(action.post_list));
        PostStore.checkBounds(id, action.numRequested, makePostListNonNull(action.post_list), action.before);
        PostStore.emitChange();
        break;
    }
    case ActionTypes.RECEIVED_FOCUSED_POST:
        PostStore.clearChannelVisibility(action.postId, false);
        PostStore.storeFocusedPost(action.postId, action.channelId, makePostListNonNull(action.post_list));
        PostStore.emitChange();
        break;
    case ActionTypes.RECEIVED_POST:
        PostStore.storePost(action.post);
        PostStore.emitChange();
        break;
    case ActionTypes.RECEIVED_EDIT_POST:
        PostStore.emitEditPost(action);
        PostStore.emitChange();
        break;
    case ActionTypes.CLICK_CHANNEL:
        PostStore.clearFocusedPost();
        PostStore.clearChannelVisibility(action.id, true);
        break;
    case ActionTypes.CREATE_POST:
        PostStore.storePendingPost(action.post);
        PostStore.storeDraft(action.post.channel_id, null);
        PostStore.jumpPostsViewToBottom();
        break;
    case ActionTypes.CREATE_COMMENT:
        PostStore.storePendingPost(action.post);
        PostStore.storeCommentDraft(action.post.root_id, null);
        break;
    case ActionTypes.POST_DELETED:
        PostStore.deletePost(action.post);
        PostStore.emitChange();
        break;
    case ActionTypes.REMOVE_POST:
        PostStore.removePost(action.post);
        PostStore.emitChange();
        break;
    case ActionTypes.RECEIVED_POST_SELECTED:
        PostStore.storeSelectedPostId(action.postId);
        PostStore.emitSelectedPostChange(action.from_search, action.from_flagged_posts);
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
