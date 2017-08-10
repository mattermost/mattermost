// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import EventEmitter from 'events';

import Constants from 'utils/constants.jsx';
import ChannelStore from 'stores/channel_store.jsx';

var ActionTypes = Constants.ActionTypes;

var CHANGE_EVENT = 'change';
var SEARCH_CHANGE_EVENT = 'search_change';
var SEARCH_TERM_CHANGE_EVENT = 'search_term_change';
var SHOW_SEARCH_EVENT = 'show_search';

class SearchStoreClass extends EventEmitter {
    constructor() {
        super();

        this.searchResults = null;
        this.isMentionSearch = false;
        this.isFlaggedPosts = false;
        this.isPinnedPosts = false;
        this.isVisible = false;
        this.searchTerm = '';
        this.loading = false;
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

    emitShowSearch() {
        this.emit(SHOW_SEARCH_EVENT);
    }

    addShowSearchListener(callback) {
        this.on(SHOW_SEARCH_EVENT, callback);
    }

    removeShowSearchListener(callback) {
        this.removeListener(SHOW_SEARCH_EVENT, callback);
    }

    getSearchResults() {
        return this.searchResults;
    }

    getIsMentionSearch() {
        return this.isMentionSearch;
    }

    getIsFlaggedPosts() {
        return this.isFlaggedPosts;
    }

    getIsPinnedPosts() {
        return this.isPinnedPosts;
    }

    storeSearchTerm(term) {
        this.searchTerm = term;
    }

    getSearchTerm() {
        return this.searchTerm;
    }

    storeSearchResults(results, isMentionSearch = false, isFlaggedPosts = false, isPinnedPosts = false) {
        this.searchResults = results;
        this.isMentionSearch = isMentionSearch;
        this.isFlaggedPosts = isFlaggedPosts;
        this.isPinnedPosts = isPinnedPosts;
    }

    deletePost(post) {
        const results = this.getSearchResults();
        if (results == null) {
            return;
        }

        if (post.id in results.posts) {
            // make sure to copy the post so that component state changes work properly
            results.posts[post.id] = Object.assign({}, post, {
                state: Constants.POST_DELETED,
                file_ids: []
            });
        }
    }

    updatePost(post) {
        const results = this.getSearchResults();
        if (!post || results == null) {
            return;
        }

        if (post.id in results.posts) {
            results.posts[post.id] = Object.assign({}, post);
        }
    }

    togglePinPost(postId, isPinned) {
        const results = this.getSearchResults();
        if (results == null || results.posts == null) {
            return;
        }

        if (postId in results.posts) {
            const post = results.posts[postId];
            results.posts[postId] = Object.assign({}, post, {
                is_pinned: isPinned
            });
        }
    }

    removePost(post) {
        const results = this.getSearchResults();
        if (results == null) {
            return;
        }

        const index = results.order.indexOf(post.id);
        if (index > -1) {
            delete results.posts[post.id];
            results.order.splice(index, 1);
        }
    }

    setLoading(loading) {
        this.loading = loading;
    }

    isLoading() {
        return this.loading;
    }
}

var SearchStore = new SearchStoreClass();

SearchStore.dispatchToken = AppDispatcher.register((payload) => {
    var action = payload.action;

    switch (action.type) {
    case ActionTypes.RECEIVED_SEARCH: {
        const results = SearchStore.getSearchResults() || {};
        const posts = Object.values(results.posts || {});
        const channelId = posts.length > 0 ? posts[0].channel_id : '';
        if (SearchStore.getIsPinnedPosts() === action.is_pinned_posts &&
            action.is_pinned_posts === true &&
            channelId !== '' &&
            ChannelStore.getCurrentId() !== channelId) {
            // ignore pin posts update after switch to a new channel
            return;
        }
        SearchStore.setLoading(false);
        SearchStore.storeSearchResults(action.results, action.is_mention_search, action.is_flagged_posts, action.is_pinned_posts);
        SearchStore.emitSearchChange();
        break;
    }
    case ActionTypes.RECEIVED_SEARCH_TERM:
        if (action.do_search) {
            // while a search is in progress, hide results from previous search
            SearchStore.setLoading(true);
            SearchStore.storeSearchResults(null, false, false, false);
            SearchStore.emitSearchChange();
        }
        SearchStore.storeSearchTerm(action.term);
        SearchStore.emitSearchTermChange(action.do_search, action.is_mention_search);
        break;
    case ActionTypes.SHOW_SEARCH:
        SearchStore.emitShowSearch();
        break;
    case ActionTypes.POST_DELETED:
        SearchStore.deletePost(action.post);
        SearchStore.emitSearchChange();
        break;
    case ActionTypes.POST_UPDATED:
        SearchStore.updatePost(action.post);
        SearchStore.emitSearchChange();
        break;
    case ActionTypes.RECEIVED_POST_PINNED:
        SearchStore.togglePinPost(action.postId, true);
        SearchStore.emitSearchChange();
        break;
    case ActionTypes.RECEIVED_POST_UNPINNED:
        SearchStore.togglePinPost(action.postId, false);
        SearchStore.emitSearchChange();
        break;
    case ActionTypes.REMOVE_POST:
        SearchStore.removePost(action.post);
        SearchStore.emitSearchChange();
        break;
    default:
    }
});

export default SearchStore;
