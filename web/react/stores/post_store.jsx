// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var EventEmitter = require('events').EventEmitter;
var assign = require('object-assign');

var ChannelStore = require('../stores/channel_store.jsx');
var UserStore = require('../stores/user_store.jsx');

var Constants = require('../utils/constants.jsx');
var ActionTypes = Constants.ActionTypes;

var CHANGE_EVENT = 'change';
var SEARCH_CHANGE_EVENT = 'search_change';
var SEARCH_TERM_CHANGE_EVENT = 'search_term_change';
var SELECTED_POST_CHANGE_EVENT = 'selected_post_change';
var MENTION_DATA_CHANGE_EVENT = 'mention_data_change';
var ADD_MENTION_EVENT = 'add_mention';

var PostStore = assign({}, EventEmitter.prototype, {

  emitChange: function() {
    this.emit(CHANGE_EVENT);
  },

  addChangeListener: function(callback) {
    this.on(CHANGE_EVENT, callback);
  },

  removeChangeListener: function(callback) {
    this.removeListener(CHANGE_EVENT, callback);
  },

  emitSearchChange: function() {
    this.emit(SEARCH_CHANGE_EVENT);
  },

  addSearchChangeListener: function(callback) {
    this.on(SEARCH_CHANGE_EVENT, callback);
  },

  removeSearchChangeListener: function(callback) {
    this.removeListener(SEARCH_CHANGE_EVENT, callback);
  },

  emitSearchTermChange: function(doSearch, isMentionSearch) {
    this.emit(SEARCH_TERM_CHANGE_EVENT, doSearch, isMentionSearch);
  },

  addSearchTermChangeListener: function(callback) {
    this.on(SEARCH_TERM_CHANGE_EVENT, callback);
  },

  removeSearchTermChangeListener: function(callback) {
    this.removeListener(SEARCH_TERM_CHANGE_EVENT, callback);
  },

  emitSelectedPostChange: function(from_search) {
    this.emit(SELECTED_POST_CHANGE_EVENT, from_search);
  },

  addSelectedPostChangeListener: function(callback) {
    this.on(SELECTED_POST_CHANGE_EVENT, callback);
  },

  removeSelectedPostChangeListener: function(callback) {
    this.removeListener(SELECTED_POST_CHANGE_EVENT, callback);
  },

  emitMentionDataChange: function(id, mentionText, excludeList) {
    this.emit(MENTION_DATA_CHANGE_EVENT, id, mentionText, excludeList);
  },

  addMentionDataChangeListener: function(callback) {
    this.on(MENTION_DATA_CHANGE_EVENT, callback);
  },

  removeMentionDataChangeListener: function(callback) {
    this.removeListener(MENTION_DATA_CHANGE_EVENT, callback);
  },

  emitAddMention: function(id, username) {
    this.emit(ADD_MENTION_EVENT, id, username);
  },

  addAddMentionListener: function(callback) {
    this.on(ADD_MENTION_EVENT, callback);
  },

  removeAddMentionListener: function(callback) {
    this.removeListener(ADD_MENTION_EVENT, callback);
  },

  getCurrentPosts: function() {
    var currentId = ChannelStore.getCurrentId();

    if (currentId != null)
      return this.getPosts(currentId);
    else
      return null;
  },
  storePosts: function(channelId, posts) {
    this._storePosts(channelId, posts);
    this.emitChange();
  },
  _storePosts: function(channelId, posts) {
    sessionStorage.setItem("posts_" + channelId, JSON.stringify(posts));
  },
  getPosts: function(channelId) {
    var posts = null;
    try {
        posts = JSON.parse(sessionStorage.getItem("posts_" + channelId));
    }
    catch (err) {
    }

    return posts;
  },
  storeSearchResults: function(results, is_mention_search) {
    sessionStorage.setItem("search_results", JSON.stringify(results));
    is_mention_search = is_mention_search ? true : false; // force to bool
    sessionStorage.setItem("is_mention_search", JSON.stringify(is_mention_search));
  },
  getSearchResults: function() {
    var results = null;
    try {
        results = JSON.parse(sessionStorage.getItem("search_results"));
    }
    catch (err) {
    }

    return results;
  },
  getIsMentionSearch: function() {
    var result = false;
    try {
        result = JSON.parse(sessionStorage.getItem("is_mention_search"));
    }
    catch (err) {
    }

    return result;
  },
  storeSelectedPost: function(post_list) {
    sessionStorage.setItem("select_post", JSON.stringify(post_list));
  },
  getSelectedPost: function() {
    var post_list = null;
    try {
        post_list = JSON.parse(sessionStorage.getItem("select_post"));
    }
    catch (err) {
    }

    return post_list;
  },
  storeSearchTerm: function(term) {
    sessionStorage.setItem("search_term", term);
  },
  getSearchTerm: function() {
    return sessionStorage.getItem("search_term");
  },
  storeCurrentDraft: function(draft) {
    var channel_id = ChannelStore.getCurrentId();
    var user_id = UserStore.getCurrentId();
    localStorage.setItem("draft_" + channel_id + "_" + user_id, JSON.stringify(draft));
  },
  getCurrentDraft: function() {
    var channel_id = ChannelStore.getCurrentId();
    var user_id = UserStore.getCurrentId();
    return JSON.parse(localStorage.getItem("draft_" + channel_id + "_" + user_id));
  },
  storeDraft: function(channel_id, user_id, draft) {
    localStorage.setItem("draft_" + channel_id + "_" + user_id, JSON.stringify(draft));
  },
  getDraft: function(channel_id, user_id) {
    return JSON.parse(localStorage.getItem("draft_" + channel_id + "_" + user_id));
  },
  clearDraftUploads: function() {
    for (key in localStorage) {
        if (key.substring(0,6) === "draft_") {
            var d = JSON.parse(localStorage.getItem(key));
            if (d) {
                d['uploadsInProgress'] = 0;
                localStorage.setItem(key, JSON.stringify(d));
            }
        }
    }
  }
});

PostStore.dispatchToken = AppDispatcher.register(function(payload) {
  var action = payload.action;

  switch(action.type) {
    case ActionTypes.RECIEVED_POSTS:
      PostStore._storePosts(action.id, action.post_list);
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
      PostStore.emitMentionDataChange(action.id, action.mention_text, action.exclude_list);
      break;
    case ActionTypes.RECIEVED_ADD_MENTION:
      PostStore.emitAddMention(action.id, action.username);
      break;

    default:
  }
});

module.exports = PostStore;
