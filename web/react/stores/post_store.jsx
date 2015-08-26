// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var EventEmitter = require('events').EventEmitter;
var assign = require('object-assign');

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

var PostStore = assign({}, EventEmitter.prototype, {
    emitChange: function emitChange() {
        this.emit(CHANGE_EVENT);
    },

    addChangeListener: function addChangeListener(callback) {
        this.on(CHANGE_EVENT, callback);
    },

    removeChangeListener: function removeChangeListener(callback) {
        this.removeListener(CHANGE_EVENT, callback);
    },

    emitSearchChange: function emitSearchChange() {
        this.emit(SEARCH_CHANGE_EVENT);
    },

    addSearchChangeListener: function addSearchChangeListener(callback) {
        this.on(SEARCH_CHANGE_EVENT, callback);
    },

    removeSearchChangeListener: function removeSearchChangeListener(callback) {
        this.removeListener(SEARCH_CHANGE_EVENT, callback);
    },

    emitSearchTermChange: function emitSearchTermChange(doSearch, isMentionSearch) {
        this.emit(SEARCH_TERM_CHANGE_EVENT, doSearch, isMentionSearch);
    },

    addSearchTermChangeListener: function addSearchTermChangeListener(callback) {
        this.on(SEARCH_TERM_CHANGE_EVENT, callback);
    },

    removeSearchTermChangeListener: function removeSearchTermChangeListener(callback) {
        this.removeListener(SEARCH_TERM_CHANGE_EVENT, callback);
    },

    emitSelectedPostChange: function emitSelectedPostChange(fromSearch) {
        this.emit(SELECTED_POST_CHANGE_EVENT, fromSearch);
    },

    addSelectedPostChangeListener: function addSelectedPostChangeListener(callback) {
        this.on(SELECTED_POST_CHANGE_EVENT, callback);
    },

    removeSelectedPostChangeListener: function removeSelectedPostChangeListener(callback) {
        this.removeListener(SELECTED_POST_CHANGE_EVENT, callback);
    },

    emitMentionDataChange: function emitMentionDataChange(id, mentionText) {
        this.emit(MENTION_DATA_CHANGE_EVENT, id, mentionText);
    },

    addMentionDataChangeListener: function addMentionDataChangeListener(callback) {
        this.on(MENTION_DATA_CHANGE_EVENT, callback);
    },

    removeMentionDataChangeListener: function removeMentionDataChangeListener(callback) {
        this.removeListener(MENTION_DATA_CHANGE_EVENT, callback);
    },

    emitAddMention: function emitAddMention(id, username) {
        this.emit(ADD_MENTION_EVENT, id, username);
    },

    addAddMentionListener: function addAddMentionListener(callback) {
        this.on(ADD_MENTION_EVENT, callback);
    },

    removeAddMentionListener: function removeAddMentionListener(callback) {
        this.removeListener(ADD_MENTION_EVENT, callback);
    },

    getCurrentPosts: function getCurrentPosts() {
        var currentId = ChannelStore.getCurrentId();

        if (currentId != null) {
            return this.getPosts(currentId);
        }
        return null;
    },
    storePosts: function storePosts(channelId, newPostList) {
        if (isPostListNull(newPostList)) {
            return;
        }

        var postList = makePostListNonNull(PostStore.getPosts(channelId));

        for (var pid in newPostList.posts) {
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
    },
    pStorePosts: function pStorePosts(channelId, posts) {
        BrowserStore.setItem('posts_' + channelId, posts);
    },
    getPosts: function getPosts(channelId) {
        return BrowserStore.getItem('posts_' + channelId);
    },
    storePost: function(post) {
        this.pStorePost(post);
        this.emitChange();
    },
    pStorePost: function(post) {
        var postList = PostStore.getPosts(post.channel_id);
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
    },
    removePost: function(postId, channelId) {
        var postList = PostStore.getPosts(channelId);
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
    },
    storePendingPost: function(post) {
        post.state = Constants.POST_LOADING;

        var postList = this.getPendingPosts(post.channel_id);
        postList = makePostListNonNull(postList);

        postList.posts[post.pending_post_id] = post;
        postList.order.unshift(post.pending_post_id);
        this._storePendingPosts(post.channel_id, postList);
        this.emitChange();
    },
    _storePendingPosts: function(channelId, postList) {
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
    },
    getPendingPosts: function(channelId) {
        return BrowserStore.getItem('pending_posts_' + channelId);
    },
    storeUnseenDeletedPost: function(post) {
        var posts = this.getUnseenDeletedPosts(post.channel_id);

        if (!posts) {
            posts = {};
        }

        post.message = '(message deleted)';
        post.state = Constants.POST_DELETED;

        posts[post.id] = post;
        this.storeUnseenDeletedPosts(post.channel_id, posts);
    },
    storeUnseenDeletedPosts: function(channelId, posts) {
        BrowserStore.setItem('deleted_posts_' + channelId, posts);
    },
    getUnseenDeletedPosts: function(channelId) {
        return BrowserStore.getItem('deleted_posts_' + channelId);
    },
    clearUnseenDeletedPosts: function(channelId) {
        BrowserStore.setItem('deleted_posts_' + channelId, {});
    },
    removePendingPost: function(channelId, pendingPostId) {
        this._removePendingPost(channelId, pendingPostId);
        this.emitChange();
    },
    _removePendingPost: function(channelId, pendingPostId) {
        var postList = this.getPendingPosts(channelId);
        postList = makePostListNonNull(postList);

        if (pendingPostId in postList.posts) {
            delete postList.posts[pendingPostId];
        }
        var index = postList.order.indexOf(pendingPostId);
        if (index !== -1) {
            postList.order.splice(index, 1);
        }

        this._storePendingPosts(channelId, postList);
    },
    clearPendingPosts: function() {
        BrowserStore.actionOnItemsWithPrefix('pending_posts_', function clearPending(key) {
            BrowserStore.removeItem(key);
        });
    },
    updatePendingPost: function(post) {
        var postList = this.getPendingPosts(post.channel_id);
        postList = makePostListNonNull(postList);

        if (postList.order.indexOf(post.pending_post_id) === -1) {
            return;
        }

        postList.posts[post.pending_post_id] = post;
        this._storePendingPosts(post.channel_id, postList);
        this.emitChange();
    },
    storeSearchResults: function storeSearchResults(results, isMentionSearch) {
        BrowserStore.setItem('search_results', results);
        BrowserStore.setItem('is_mention_search', Boolean(isMentionSearch));
    },
    getSearchResults: function getSearchResults() {
        return BrowserStore.getItem('search_results');
    },
    getIsMentionSearch: function getIsMentionSearch() {
        return BrowserStore.getItem('is_mention_search');
    },
    storeSelectedPost: function storeSelectedPost(postList) {
        BrowserStore.setItem('select_post', postList);
    },
    getSelectedPost: function getSelectedPost() {
        return BrowserStore.getItem('select_post');
    },
    storeSearchTerm: function storeSearchTerm(term) {
        BrowserStore.setItem('search_term', term);
    },
    getSearchTerm: function getSearchTerm() {
        return BrowserStore.getItem('search_term');
    },
    getEmptyDraft: function getEmptyDraft(draft) {
        return {message: '', uploadsInProgress: [], previews: []};
    },
    storeCurrentDraft: function storeCurrentDraft(draft) {
        var channelId = ChannelStore.getCurrentId();
        BrowserStore.setItem('draft_' + channelId, draft);
    },
    getCurrentDraft: function getCurrentDraft() {
        var channelId = ChannelStore.getCurrentId();
        return PostStore.getDraft(channelId);
    },
    storeDraft: function storeDraft(channelId, draft) {
        BrowserStore.setItem('draft_' + channelId, draft);
    },
    getDraft: function getDraft(channelId) {
        return BrowserStore.getItem('draft_' + channelId, PostStore.getEmptyDraft());
    },
    storeCommentDraft: function storeCommentDraft(parentPostId, draft) {
        BrowserStore.setItem('comment_draft_' + parentPostId, draft);
    },
    getCommentDraft: function getCommentDraft(parentPostId) {
        return BrowserStore.getItem('comment_draft_' + parentPostId, PostStore.getEmptyDraft());
    },
    clearDraftUploads: function clearDraftUploads() {
        BrowserStore.actionOnItemsWithPrefix('draft_', function clearUploads(key, value) {
            if (value) {
                value.uploadsInProgress = [];
                BrowserStore.setItem(key, value);
            }
        });
    },
    clearCommentDraftUploads: function clearCommentDraftUploads() {
        BrowserStore.actionOnItemsWithPrefix('comment_draft_', function clearUploads(key, value) {
            if (value) {
                value.uploadsInProgress = [];
                BrowserStore.setItem(key, value);
            }
        });
    },
    storeLatestUpdate: function(channelId, time) {
        BrowserStore.setItem('latest_post_' + channelId, time);
    },
    getLatestUpdate: function(channelId) {
        return BrowserStore.getItem('latest_post_' + channelId, 0);
    }
});

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

module.exports = PostStore;

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
