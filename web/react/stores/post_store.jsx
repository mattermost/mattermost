// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var EventEmitter = require('events').EventEmitter;

var ChannelStore = require('../stores/channel_store.jsx');
var BrowserStore = require('../stores/browser_store.jsx');

var Constants = require('../utils/constants.jsx');
var ActionTypes = Constants.ActionTypes;

var CHANGE_EVENT = 'change';
var SEARCH_CHANGE_EVENT = 'search_change';
var SEARCH_TERM_CHANGE_EVENT = 'search_term_change';
var SELECTED_POST_CHANGE_EVENT = 'selected_post_change';
var MENTION_DATA_CHANGE_EVENT = 'mention_data_change';
var ADD_MENTION_EVENT = 'add_mention';

class PostStoreClass extends EventEmitter {
    constructor() {
        super();

        this.emitChange = this.emitChange.bind(this);
        this.addChangeListener = this.addChangeListener.bind(this);
        this.removeChangeListener = this.removeChangeListener.bind(this);
        this.emitSearchChange = this.emitSearchChange.bind(this);
        this.addSearchChangeListener = this.addSearchChangeListener.bind(this);
        this.removeSearchChangeListener = this.removeSearchChangeListener.bind(this);
        this.emitSearchTermChange = this.emitSearchTermChange.bind(this);
        this.addSearchTermChangeListener = this.addSearchTermChangeListener.bind(this);
        this.removeSearchTermChangeListener = this.removeSearchTermChangeListener.bind(this);
        this.emitSelectedPostChange = this.emitSelectedPostChange.bind(this);
        this.addSelectedPostChangeListener = this.addSelectedPostChangeListener.bind(this);
        this.removeSelectedPostChangeListener = this.removeSelectedPostChangeListener.bind(this);
        this.emitMentionDataChange = this.emitMentionDataChange.bind(this);
        this.addMentionDataChangeListener = this.addMentionDataChangeListener.bind(this);
        this.removeMentionDataChangeListener = this.removeMentionDataChangeListener.bind(this);
        this.emitAddMention = this.emitAddMention.bind(this);
        this.addAddMentionListener = this.addAddMentionListener.bind(this);
        this.removeAddMentionListener = this.removeAddMentionListener.bind(this);
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
        this.storeSearchResults = this.storeSearchResults.bind(this);
        this.getSearchResults = this.getSearchResults.bind(this);
        this.getIsMentionSearch = this.getIsMentionSearch.bind(this);
        this.storeSelectedPost = this.storeSelectedPost.bind(this);
        this.getSelectedPost = this.getSelectedPost.bind(this);
        this.storeSearchTerm = this.storeSearchTerm.bind(this);
        this.getSearchTerm = this.getSearchTerm.bind(this);
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

    emitSearchChange() {
        this.emit(SEARCH_CHANGE_EVENT);
    }

    addSearchChangeListener(callback) {
        this.on(SEARCH_CHANGE_EVENT, callback);
    }

    removeSearchChangeListener(callback) {
        this.removeListener(SEARCH_CHANGE_EVENT, callback);
    }

    emitSearchTermChange(doSearch, isMentionSearch) {
        this.emit(SEARCH_TERM_CHANGE_EVENT, doSearch, isMentionSearch);
    }

    addSearchTermChangeListener(callback) {
        this.on(SEARCH_TERM_CHANGE_EVENT, callback);
    }

    removeSearchTermChangeListener(callback) {
        this.removeListener(SEARCH_TERM_CHANGE_EVENT, callback);
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

    emitMentionDataChange(id, mentionText) {
        this.emit(MENTION_DATA_CHANGE_EVENT, id, mentionText);
    }

    addMentionDataChangeListener(callback) {
        this.on(MENTION_DATA_CHANGE_EVENT, callback);
    }

    removeMentionDataChangeListener(callback) {
        this.removeListener(MENTION_DATA_CHANGE_EVENT, callback);
    }

    emitAddMention(id, username) {
        this.emit(ADD_MENTION_EVENT, id, username);
    }

    addAddMentionListener(callback) {
        this.on(ADD_MENTION_EVENT, callback);
    }

    removeAddMentionListener(callback) {
        this.removeListener(ADD_MENTION_EVENT, callback);
    }

    getCurrentPosts() {
        var currentId = ChannelStore.getCurrentId();

        if (currentId != null) {
            return this.getPosts(currentId);
        }
        return null;
    }
    storePosts(channelId, newPostList) {
        if (isPostListNull(newPostList)) {
            return;
        }

        var postList = makePostListNonNull(this.getPosts(channelId));

        for (let pid in newPostList.posts) {
            if (newPostList.posts.hasOwnProperty(pid)) {
                var np = newPostList.posts[pid];
                if (np.delete_at === 0) {
                    postList.posts[pid] = np;
                    if (postList.order.indexOf(pid) === -1) {
                        postList.order.push(pid);
                    }
                } else {
                    if (pid in postList.posts) {
                        delete postList.posts[pid];
                    }

                    var index = postList.order.indexOf(pid);
                    if (index !== -1) {
                        postList.order.splice(index, 1);
                    }
                }
            }
        }

        postList.order.sort(function postSort(a, b) {
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
        postList.order.sort(function postSort(a, b) {
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

        BrowserStore.setItem('pending_posts_' + channelId, postList);
    }
    getPendingPosts(channelId) {
        return BrowserStore.getItem('pending_posts_' + channelId);
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
        BrowserStore.actionOnItemsWithPrefix('pending_posts_', function clearPending(key) {
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
    storeSearchResults(results, isMentionSearch) {
        BrowserStore.setItem('search_results', results);
        BrowserStore.setItem('is_mention_search', Boolean(isMentionSearch));
    }
    getSearchResults() {
        return BrowserStore.getItem('search_results');
    }
    getIsMentionSearch() {
        return BrowserStore.getItem('is_mention_search');
    }
    storeSelectedPost(postList) {
        BrowserStore.setItem('select_post', postList);
    }
    getSelectedPost() {
        return BrowserStore.getItem('select_post');
    }
    storeSearchTerm(term) {
        BrowserStore.setItem('search_term', term);
    }
    getSearchTerm() {
        return BrowserStore.getItem('search_term');
    }
    getEmptyDraft() {
        return {message: '', uploadsInProgress: [], previews: []};
    }
    storeCurrentDraft(draft) {
        var channelId = ChannelStore.getCurrentId();
        BrowserStore.setItem('draft_' + channelId, draft);
    }
    getCurrentDraft() {
        var channelId = ChannelStore.getCurrentId();
        return this.getDraft(channelId);
    }
    storeDraft(channelId, draft) {
        BrowserStore.setItem('draft_' + channelId, draft);
    }
    getDraft(channelId) {
        return BrowserStore.getItem('draft_' + channelId, this.getEmptyDraft());
    }
    storeCommentDraft(parentPostId, draft) {
        BrowserStore.setItem('comment_draft_' + parentPostId, draft);
    }
    getCommentDraft(parentPostId) {
        return BrowserStore.getItem('comment_draft_' + parentPostId, this.getEmptyDraft());
    }
    clearDraftUploads() {
        BrowserStore.actionOnItemsWithPrefix('draft_', function clearUploads(key, value) {
            if (value) {
                value.uploadsInProgress = [];
                BrowserStore.setItem(key, value);
            }
        });
    }
    clearCommentDraftUploads() {
        BrowserStore.actionOnItemsWithPrefix('comment_draft_', function clearUploads(key, value) {
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

PostStore.dispatchToken = AppDispatcher.register(function registry(payload) {
    var action = payload.action;

    switch (action.type) {
    case ActionTypes.RECIEVED_POSTS:
        PostStore.storePosts(action.id, makePostListNonNull(action.post_list));
        break;
    case ActionTypes.RECIEVED_POST:
        PostStore.pStorePost(action.post);
        PostStore.emitChange();
        break;
    case ActionTypes.RECIEVED_SEARCH:
        PostStore.storeSearchResults(action.results, action.is_mention_search);
        PostStore.emitSearchChange();
        break;
    case ActionTypes.RECIEVED_SEARCH_TERM:
        PostStore.storeSearchTerm(action.term);
        PostStore.emitSearchTermChange(action.do_search, action.is_mention_search);
        break;
    case ActionTypes.RECIEVED_POST_SELECTED:
        PostStore.storeSelectedPost(action.post_list);
        PostStore.emitSelectedPostChange(action.from_search);
        break;
    case ActionTypes.RECIEVED_MENTION_DATA:
        PostStore.emitMentionDataChange(action.id, action.mention_text);
        break;
    case ActionTypes.RECIEVED_ADD_MENTION:
        PostStore.emitAddMention(action.id, action.username);
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
