// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var EventEmitter = require('events').EventEmitter;
var assign = require('object-assign');

var Constants = require('../utils/constants.jsx');
var ActionTypes = Constants.ActionTypes;

var BrowserStore = require('../stores/browser_store.jsx');


var CHANGE_EVENT = 'change';
var MORE_CHANGE_EVENT = 'change';
var EXTRA_INFO_EVENT = 'extra_info';

var ChannelStore = assign({}, EventEmitter.prototype, {
  emitChange: function() {
    this.emit(CHANGE_EVENT);
  },
  addChangeListener: function(callback) {
    this.on(CHANGE_EVENT, callback);
  },
  removeChangeListener: function(callback) {
    this.removeListener(CHANGE_EVENT, callback);
  },
  emitMoreChange: function() {
    this.emit(MORE_CHANGE_EVENT);
  },
  addMoreChangeListener: function(callback) {
    this.on(MORE_CHANGE_EVENT, callback);
  },
  removeMoreChangeListener: function(callback) {
    this.removeListener(MORE_CHANGE_EVENT, callback);
  },
  emitExtraInfoChange: function() {
    this.emit(EXTRA_INFO_EVENT);
  },
  addExtraInfoChangeListener: function(callback) {
    this.on(EXTRA_INFO_EVENT, callback);
  },
  removeExtraInfoChangeListener: function(callback) {
    this.removeListener(EXTRA_INFO_EVENT, callback);
  },
  get: function(id) {
    var current = null;
    var c = this._getChannels();

    c.some(function(channel) {
      if (channel.id == id) {
        current = channel;
        return true;
      }
      return false;
    });

    return current;
  },
  getMember: function(id) {
    var current = null;
    return this.getAllMembers()[id];
  },
  getByName: function(name) {
    var current = null;
    var c = this._getChannels();

    c.some(function(channel) {
      if (channel.name == name) {
        current = channel;
        return true;
      }

      return false;

    });

    return current;

  },
  getAll: function() {
    return this._getChannels();
  },
  getAllMembers: function() {
    return this._getChannelMembers();
  },
  getMoreAll: function() {
    return this._getMoreChannels();
  },
  setCurrentId: function(id) {
    if (id == null)
      BrowserStore.removeItem("current_channel_id");
    else
      BrowserStore.setItem("current_channel_id", id);
  },
  setLastVisitedName: function(name) {
    if (name == null)
      BrowserStore.removeItem("last_visited_name");
    else
      BrowserStore.setItem("last_visited_name", name);
  },
  getLastVisitedName: function() {
    return BrowserStore.getItem("last_visited_name");
  },
  resetCounts: function(id) {
      var cm = this._getChannelMembers();
      for (var cmid in cm) {
          if (cm[cmid].channel_id == id) {
              var c = this.get(id);
              if (c) {
                  cm[cmid].msg_count = this.get(id).total_msg_count;
                  cm[cmid].mention_count = 0;
              }
              break;
          }
      }
      this._storeChannelMembers(cm);
  },
  getCurrentId: function() {
    return BrowserStore.getItem("current_channel_id");
  },
  getCurrent: function() {
    var currentId = ChannelStore.getCurrentId();

    if (currentId != null)
      return this.get(currentId);
    else
      return null;
  },
  getCurrentMember: function() {
    var currentId = ChannelStore.getCurrentId();

    if (currentId != null)
      return this.getAllMembers()[currentId];
    else
      return null;
  },
  setChannelMember: function(member) {
    var members = this._getChannelMembers();
    members[member.channel_id] = member;
    this._storeChannelMembers(members);
    this.emitChange();
  },
  getCurrentExtraInfo: function() {
    var currentId = ChannelStore.getCurrentId();
    var extra = null;

    if (currentId != null)
      extra = this._getExtraInfos()[currentId];

    if (extra == null)
      extra = {members: []};

    return extra;
  },
  getExtraInfo: function(channel_id) {
    var extra = null;

    if (channel_id != null)
      extra = this._getExtraInfos()[channel_id];

    if (extra == null)
      extra = {members: []};

    return extra;
  },
  _storeChannels: function(channels) {
    BrowserStore.setItem("channels", JSON.stringify(channels));
  },
  _getChannels: function() {
    var channels = [];
    try {
        channels = JSON.parse(BrowserStore.getItem("channels"));
    }
    catch (err) {
    }

	if (channels == null) {
		channels = [];
	}

    return channels;
  },
  _storeChannelMembers: function(channelMembers) {
    BrowserStore.setItem("channel_members", JSON.stringify(channelMembers));
  },
  _getChannelMembers: function() {
    var members = {};
    try {
        members = JSON.parse(BrowserStore.getItem("channel_members"));
    }
    catch (err) {
    }

	if (members  == null) {
		members = {};
	}

    return members;
  },
  _storeMoreChannels: function(channels) {
    BrowserStore.setItem("more_channels", JSON.stringify(channels));
  },
  _getMoreChannels: function() {
    var channels = [];
    try {
        channels = JSON.parse(BrowserStore.getItem("more_channels"));
    }
    catch (err) {
	}

	if (channels == null) {
		channels = [];
	}

    return channels;
  },
  _storeExtraInfos: function(extraInfos) {
    BrowserStore.setItem("extra_infos", JSON.stringify(extraInfos));
  },
  _getExtraInfos: function() {
    var members = {};
    try {
        members = JSON.parse(BrowserStore.getItem("extra_infos"));
    }
    catch (err) {
	}

	if (members  == null) {
		members = {};
	}

    return members;
  }
});

ChannelStore.dispatchToken = AppDispatcher.register(function(payload) {
  var action = payload.action;

  switch(action.type) {

    case ActionTypes.CLICK_CHANNEL:
      ChannelStore.setCurrentId(action.id);
      ChannelStore.setLastVisitedName(action.name);
      ChannelStore.resetCounts(action.id);
      ChannelStore.emitChange();
      break;

    case ActionTypes.RECIEVED_CHANNELS:
      ChannelStore._storeChannels(action.channels);
      ChannelStore._storeChannelMembers(action.members);
      var currentId = ChannelStore.getCurrentId();
      if (currentId) ChannelStore.resetCounts(currentId);
      ChannelStore.emitChange();
      break;

    case ActionTypes.RECIEVED_MORE_CHANNELS:
      ChannelStore._storeMoreChannels(action.channels);
      ChannelStore.emitMoreChange();
      break;

    case ActionTypes.RECIEVED_CHANNEL_EXTRA_INFO:
      var extra_infos = ChannelStore._getExtraInfos();
      extra_infos[action.extra_info.id] = action.extra_info;
      ChannelStore._storeExtraInfos(extra_infos);
      ChannelStore.emitExtraInfoChange();
      break;

    default:
  }
});

module.exports = ChannelStore;
