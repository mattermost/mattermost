// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var EventEmitter = require('events').EventEmitter;

var Constants = require('../utils/constants.jsx');
var ActionTypes = Constants.ActionTypes;

var BrowserStore = require('../stores/browser_store.jsx');

var CHANGE_EVENT = 'change';
var LEAVE_EVENT = 'leave';
var MORE_CHANGE_EVENT = 'change';
var EXTRA_INFO_EVENT = 'extra_info';

class ChannelStoreClass extends EventEmitter {
    constructor(props) {
        super(props);

        this.setMaxListeners(11);

        this.currentId = null;
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
    emitMoreChange() {
        this.emit(MORE_CHANGE_EVENT);
    }
    addMoreChangeListener(callback) {
        this.on(MORE_CHANGE_EVENT, callback);
    }
    removeMoreChangeListener(callback) {
        this.removeListener(MORE_CHANGE_EVENT, callback);
    }
    emitExtraInfoChange() {
        this.emit(EXTRA_INFO_EVENT);
    }
    addExtraInfoChangeListener(callback) {
        this.on(EXTRA_INFO_EVENT, callback);
    }
    removeExtraInfoChangeListener(callback) {
        this.removeListener(EXTRA_INFO_EVENT, callback);
    }
    emitLeave(id) {
        this.emit(LEAVE_EVENT, id);
    }
    addLeaveListener(callback) {
        this.on(LEAVE_EVENT, callback);
    }
    removeLeaveListener(callback) {
        this.removeListener(LEAVE_EVENT, callback);
    }
    findFirstBy(field, value) {
        var channels = this.pGetChannels();
        for (var i = 0; i < channels.length; i++) {
            if (channels[i][field] === value) {
                return channels[i];
            }
        }

        return null;
    }
    get(id) {
        return this.findFirstBy('id', id);
    }
    getMember(id) {
        return this.getAllMembers()[id];
    }
    getByName(name) {
        return this.findFirstBy('name', name);
    }
    getAll() {
        return this.pGetChannels();
    }
    getAllMembers() {
        return this.pGetChannelMembers();
    }
    getMoreAll() {
        return this.pGetMoreChannels();
    }
    setCurrentId(id) {
        this.currentId = id;
    }
    setLastVisitedName(name) {
        if (name == null) {
            BrowserStore.removeItem('last_visited_name');
        } else {
            BrowserStore.setItem('last_visited_name', name);
        }
    }
    getLastVisitedName() {
        return BrowserStore.getItem('last_visited_name');
    }
    resetCounts(id) {
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
    }
    getCurrentId() {
        return this.currentId;
    }
    getCurrent() {
        var currentId = this.getCurrentId();

        if (currentId) {
            return this.get(currentId);
        }

        return null;
    }
    getCurrentMember() {
        var currentId = this.getCurrentId();

        if (currentId) {
            return this.getAllMembers()[currentId];
        }

        return null;
    }
    setChannelMember(member) {
        var members = this.pGetChannelMembers();
        members[member.channel_id] = member;
        this.pStoreChannelMembers(members);
        this.emitChange();
    }
    getCurrentExtraInfo() {
        var currentId = this.getCurrentId();
        var extra = null;

        if (currentId) {
            extra = this.pGetExtraInfos()[currentId];
        }

        if (extra == null) {
            extra = {members: []};
        }

        return extra;
    }
    getExtraInfo(channelId) {
        var extra = null;

        if (channelId) {
            extra = this.pGetExtraInfos()[channelId];
        }

        if (extra == null) {
            extra = {members: []};
        }

        return extra;
    }
    pStoreChannel(channel) {
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
    }
    pStoreChannels(channels) {
        BrowserStore.setItem('channels', channels);
    }
    pGetChannels() {
        return BrowserStore.getItem('channels', []);
    }
    pStoreChannelMember(channelMember) {
        var members = this.pGetChannelMembers();
        members[channelMember.channel_id] = channelMember;
        this.pStoreChannelMembers(members);
    }
    pStoreChannelMembers(channelMembers) {
        BrowserStore.setItem('channel_members', channelMembers);
    }
    pGetChannelMembers() {
        return BrowserStore.getItem('channel_members', {});
    }
    pStoreMoreChannels(channels) {
        BrowserStore.setItem('more_channels', channels);
    }
    pGetMoreChannels() {
        var channels = BrowserStore.getItem('more_channels');

        if (channels == null) {
            channels = {};
            channels.loading = true;
        }

        return channels;
    }
    pStoreExtraInfos(extraInfos) {
        BrowserStore.setItem('extra_infos', extraInfos);
    }
    pGetExtraInfos() {
        return BrowserStore.getItem('extra_infos', {});
    }
    isDefault(channel) {
        return channel.name === Constants.DEFAULT_CHANNEL;
    }
}

var ChannelStore = new ChannelStoreClass();

ChannelStore.dispatchToken = AppDispatcher.register(function handleAction(payload) {
    var action = payload.action;
    var currentId;

    switch (action.type) {
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

    case ActionTypes.LEAVE_CHANNEL:
        ChannelStore.emitLeave(action.id);
        break;

    default:
        break;
    }
});

export default ChannelStore;
