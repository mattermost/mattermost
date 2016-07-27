// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import EventEmitter from 'events';

import Constants from 'utils/constants.jsx';
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
        this.searchTerm = '';
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

    storeSearchTerm(term) {
        this.searchTerm = term;
    }

    getSearchTerm() {
        return this.searchTerm;
    }

    storeSearchResults(results, isMentionSearch, isFlaggedPosts) {
        this.searchResults = results;
        this.isMentionSearch = isMentionSearch;
        this.isFlaggedPosts = isFlaggedPosts;
    }
}

var SearchStore = new SearchStoreClass();

SearchStore.dispatchToken = AppDispatcher.register((payload) => {
    var action = payload.action;

    switch (action.type) {
    case ActionTypes.RECEIVED_SEARCH:
        SearchStore.storeSearchResults(action.results, action.is_mention_search, action.is_flagged_posts);
        SearchStore.emitSearchChange();
        break;
    case ActionTypes.RECEIVED_SEARCH_TERM:
        SearchStore.storeSearchTerm(action.term);
        SearchStore.emitSearchTermChange(action.do_search, action.is_mention_search);
        break;
    case ActionTypes.SHOW_SEARCH:
        SearchStore.emitShowSearch();
        break;
    default:
    }
});

export default SearchStore;
