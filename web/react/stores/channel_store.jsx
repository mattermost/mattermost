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
    _current_id: null,
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
  findFirstBy: function(field, value) {
    var channels = this._getChannels();
    for (var i = 0; i < channels.length; i++) {
      if (channels[i][field] == value) {
        return channels[i];
      }
    }

    return null;
  },
  get: function(id) {
    return this.findFirstBy('id', id);
  },
  getMember: function(id) {
    return this.getAllMembers()[id];
  },
  getByName: function(name) {
    return this.findFirstBy('name', name);
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
      this._current_id = id;
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
      return this._current_id;
  },
  getCurrent: function() {
    var currentId = this.getCurrentId();

    if (currentId)
      return this.get(currentId);
    else
      return null;
  },
  getCurrentMember: function() {
    var currentId = ChannelStore.getCurrentId();

    if (currentId)
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

    if (currentId)
      extra = this._getExtraInfos()[currentId];

    if (extra == null)
      extra = {members: []};

    return extra;
  },
  getExtraInfo: function(channel_id) {
    var extra = null;

    if (channel_id)
      extra = this._getExtraInfos()[channel_id];

    if (extra == null)
      extra = {members: []};

    return extra;
  },
  _storeChannels: function(channels) {
    BrowserStore.setItem("channels", channels);
  },
  _getChannels: function() {
    return BrowserStore.getItem("channels", []);
  },
  _storeChannelMembers: function(channelMembers) {
    BrowserStore.setItem("channel_members", channelMembers);
  },
  _getChannelMembers: function() {
    return BrowserStore.getItem("channel_members", {});
  },
  _storeMoreChannels: function(channels) {
    BrowserStore.setItem("more_channels", channels);
  },
  _getMoreChannels: function() {
    var channels = BrowserStore.getItem("more_channels");

    if (channels == null) {
        channels = {};
        channels.loading = true;
    }

    return channels;
  },
  _storeExtraInfos: function(extraInfos) {
    BrowserStore.setItem("extra_infos", extraInfos);
  },
  _getExtraInfos: function() {
    return BrowserStore.getItem("extra_infos", {});
  },
  isDefault: function(channel) {
    return channel.name == Constants.DEFAULT_CHANNEL;
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