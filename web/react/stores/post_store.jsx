// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var EventEmitter = require('events').EventEmitter;
var assign = require('object-assign');

var ChannelStore = require('../stores/channel_store.jsx');
var UserStore = require('../stores/user_store.jsx');
var BrowserStore = require('../stores/browser_store.jsx');

var Constants = require('../utils/constants.jsx');
var ActionTypes = Constants.ActionTypes;

var CHANGE_EVENT = 'change';
var SEARCH_CHANGE_EVENT = 'search_change';
var SEARCH_TERM_CHANGE_EVENT = 'search_term_change';
var SELECTED_POST_CHANGE_EVENT = 'selected_post_change';
var MENTION_DATA_CHANGE_EVENT = 'mention_data_change';
var ADD_MENTION_EVENT = 'add_mention';
var ACTIVE_THREAD_CHANGED_EVENT = 'active_thread_changed';

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

  emitActiveThreadChanged: function(rootId, parentId) {
    this.emit(ACTIVE_THREAD_CHANGED_EVENT, rootId, parentId);
  },

  addActiveThreadChangedListener: function(callback) {
    this.on(ACTIVE_THREAD_CHANGED_EVENT, callback);
  },

  removeActiveThreadChangedListener: function(callback) {
    this.removeListener(ACTIVE_THREAD_CHANGED_EVENT, callback);
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
    BrowserStore.setItem("posts_" + channelId, posts);
  },
  getPosts: function(channelId) {
    return BrowserStore.getItem("posts_" + channelId);
  },
  storeSearchResults: function(results, is_mention_search) {
    BrowserStore.setItem("search_results", results);
    is_mention_search = is_mention_search ? true : false; // force to bool
    BrowserStore.setItem("is_mention_search", is_mention_search);
  },
  getSearchResults: function() {
    return BrowserStore.getItem("search_results");
  },
  getIsMentionSearch: function() {
    return BrowserStore.getItem("is_mention_search");
  },
  storeSelectedPost: function(post_list) {
    BrowserStore.setItem("select_post", post_list);
  },
  getSelectedPost: function() {
    return BrowserStore.getItem("select_post");
  },
  storeSearchTerm: function(term) {
    BrowserStore.setItem("search_term", term);
  },
  getSearchTerm: function() {
    return BrowserStore.getItem("search_term");
  },
  storeCurrentDraft: function(draft) {
    var channel_id = ChannelStore.getCurrentId();
    BrowserStore.setItem("draft_" + channel_id, draft);
  },
  getCurrentDraft: function() {
    var channel_id = ChannelStore.getCurrentId();
    return BrowserStore.getItem("draft_" + channel_id);
  },
  storeDraft: function(channel_id, draft) {
    BrowserStore.setItem("draft_" + channel_id, draft);
  },
  getDraft: function(channel_id) {
    return BrowserStore.getItem("draft_" + channel_id);
  },
  storeCommentDraft: function(parent_post_id, draft) {
    BrowserStore.setItem("comment_draft_" + parent_post_id, draft);
  },
  getCommentDraft: function(parent_post_id) {
    return BrowserStore.getItem("comment_draft_" + parent_post_id);
  },
  clearDraftUploads: function() {
      BrowserStore.actionOnItemsWithPrefix("draft_", function (key, value) {
          if (value) {
              value.uploadsInProgress = 0;
              BrowserStore.setItem(key, value);
          }
      });
  },
  clearCommentDraftUploads: function() {
    BrowserStore.actionOnItemsWithPrefix("comment_draft_", function (key, value) {
      if (value) {
        value.uploadsInProgress = 0;
        BrowserStore.setItem(key, value);
      }
    });
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
    case ActionTypes.RECEIVED_ACTIVE_THREAD_CHANGED:
      PostStore.emitActiveThreadChanged(action.root_id, action.parent_id);
      break;

    default:
  }
});

module.exports = PostStore;
