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
    currentId: null,
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
        var channels = this.pGetChannels();
        for (var i = 0; i < channels.length; i++) {
            if (channels[i][field] === value) {
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
        return this.pGetChannels();
    },
    getAllMembers: function() {
        return this.pGetChannelMembers();
    },
    getMoreAll: function() {
        return this.pGetMoreChannels();
    },
    setCurrentId: function(id) {
        this.currentId = id;
    },
    setLastVisitedName: function(name) {
        if (name == null) {
            BrowserStore.removeItem('last_visited_name');
        } else {
            BrowserStore.setItem('last_visited_name', name);
        }
    },
    getLastVisitedName: function() {
        return BrowserStore.getItem('last_visited_name');
    },
    resetCounts: function(id) {
        var cm = this.pGetChannelMembers();
        for (var cmid in cm) {
            if (cm[cmid].channel_id === id) {
                var c = this.get(id);
                if (c) {
                    cm[cmid].msg_count = this.get(id).total_msg_count;
                    cm[cmid].mention_count = 0;
                }
                break;
            }
        }
        this.pStoreChannelMembers(cm);
    },
    getCurrentId: function() {
        return this.currentId;
    },
    getCurrent: function() {
        var currentId = this.getCurrentId();

        if (currentId) {
            return this.get(currentId);
        } else {
            return null;
        }
    },
    getCurrentMember: function() {
        var currentId = ChannelStore.getCurrentId();

        if (currentId) {
            return this.getAllMembers()[currentId];
        } else {
            return null;
        }
    },
    setChannelMember: function(member) {
        var members = this.pGetChannelMembers();
        members[member.channel_id] = member;
        this.pStoreChannelMembers(members);
        this.emitChange();
    },
    getCurrentExtraInfo: function() {
        var currentId = ChannelStore.getCurrentId();
        var extra = null;

        if (currentId) {
            extra = this.pGetExtraInfos()[currentId];
        }

        if (extra == null) {
            extra = {members: []};
        }

        return extra;
    },
    getExtraInfo: function(channelId) {
        var extra = null;

        if (channelId) {
            extra = this.pGetExtraInfos()[channelId];
        }

        if (extra == null) {
            extra = {members: []};
        }

        return extra;
    },
    pStoreChannel: function(channel) {
        var channels = this.pGetChannels();
        var found;

        for (var i = 0; i < channels.length; i++) {
            if (channels[i].id === channel.id) {
                channels[i] = channel;
                found = true;
                break;
            }
        }

        if (!found) {
            channels.push(channel);
        }

        channels.sort(function chanSort(a, b) {
            if (a.display_name.toLowerCase() < b.display_name.toLowerCase()) {
                return -1;
            }
            if (a.display_name.toLowerCase() > b.display_name.toLowerCase()) {
                return 1;
            }
            return 0;
        });

        this.pStoreChannels(channels);
    },
    pStoreChannels: function(channels) {
        BrowserStore.setItem('channels', channels);
    },
    pGetChannels: function() {
        return BrowserStore.getItem('channels', []);
    },
    pStoreChannelMember: function(channelMember) {
        var members = this.pGetChannelMembers();
        members[channelMember.channel_id] = channelMember;
        this.pStoreChannelMembers(members);
    },
    pStoreChannelMembers: function(channelMembers) {
        BrowserStore.setItem('channel_members', channelMembers);
    },
    pGetChannelMembers: function() {
        return BrowserStore.getItem('channel_members', {});
    },
    pStoreMoreChannels: function(channels) {
        BrowserStore.setItem('more_channels', channels);
    },
    pGetMoreChannels: function() {
        var channels = BrowserStore.getItem('more_channels');

        if (channels == null) {
            channels = {};
            channels.loading = true;
        }

        return channels;
    },
    pStoreExtraInfos: function(extraInfos) {
        BrowserStore.setItem('extra_infos', extraInfos);
    },
    pGetExtraInfos: function() {
        return BrowserStore.getItem('extra_infos', {});
    },
    isDefault: function(channel) {
        return channel.name === Constants.DEFAULT_CHANNEL;
    }
});

ChannelStore.dispatchToken = AppDispatcher.register(function(payload) {
    var action = payload.action;
    var currentId;

    switch(action.type) {

        case ActionTypes.CLICK_CHANNEL:
            ChannelStore.setCurrentId(action.id);
            ChannelStore.setLastVisitedName(action.name);
            ChannelStore.resetCounts(action.id);
            ChannelStore.emitChange();
            break;

        case ActionTypes.RECIEVED_CHANNELS:
            ChannelStore.pStoreChannels(action.channels);
            ChannelStore.pStoreChannelMembers(action.members);
            currentId = ChannelStore.getCurrentId();
            if (currentId) {
                ChannelStore.resetCounts(currentId);
            }
            ChannelStore.emitChange();
            break;

        case ActionTypes.RECIEVED_CHANNEL:
            ChannelStore.pStoreChannel(action.channel);
            ChannelStore.pStoreChannelMember(action.member);
            currentId = ChannelStore.getCurrentId();
            if (currentId) {
                ChannelStore.resetCounts(currentId);
            }
            ChannelStore.emitChange();
            break;

        case ActionTypes.RECIEVED_MORE_CHANNELS:
            ChannelStore.pStoreMoreChannels(action.channels);
            ChannelStore.emitMoreChange();
            break;

        case ActionTypes.RECIEVED_CHANNEL_EXTRA_INFO:
            var extraInfos = ChannelStore.pGetExtraInfos();
            extraInfos[action.extra_info.id] = action.extra_info;
            ChannelStore.pStoreExtraInfos(extraInfos);
            ChannelStore.emitExtraInfoChange();
            break;

        default:
    }
});

module.exports = ChannelStore;
