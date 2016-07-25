// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import EventEmitter from 'events';

var Utils;
import Constants from 'utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;
const NotificationPrefs = Constants.NotificationPrefs;

const CHANGE_EVENT = 'change';
const LEAVE_EVENT = 'leave';
const MORE_CHANGE_EVENT = 'change';
const EXTRA_INFO_EVENT = 'extra_info';
const LAST_VIEVED_EVENT = 'last_viewed';

class ChannelStoreClass extends EventEmitter {
    constructor(props) {
        super(props);

        this.setMaxListeners(15);

        this.emitChange = this.emitChange.bind(this);
        this.addChangeListener = this.addChangeListener.bind(this);
        this.removeChangeListener = this.removeChangeListener.bind(this);
        this.emitMoreChange = this.emitMoreChange.bind(this);
        this.addMoreChangeListener = this.addMoreChangeListener.bind(this);
        this.removeMoreChangeListener = this.removeMoreChangeListener.bind(this);
        this.emitExtraInfoChange = this.emitExtraInfoChange.bind(this);
        this.addExtraInfoChangeListener = this.addExtraInfoChangeListener.bind(this);
        this.removeExtraInfoChangeListener = this.removeExtraInfoChangeListener.bind(this);
        this.emitLeave = this.emitLeave.bind(this);
        this.addLeaveListener = this.addLeaveListener.bind(this);
        this.removeLeaveListener = this.removeLeaveListener.bind(this);
        this.emitLastViewed = this.emitLastViewed.bind(this);
        this.addLastViewedListener = this.addLastViewedListener.bind(this);
        this.removeLastViewedListener = this.removeLastViewedListener.bind(this);
        this.findFirstBy = this.findFirstBy.bind(this);
        this.get = this.get.bind(this);
        this.getMember = this.getMember.bind(this);
        this.getByName = this.getByName.bind(this);
        this.getByDisplayName = this.getByDisplayName.bind(this);
        this.setPostMode = this.setPostMode.bind(this);
        this.getPostMode = this.getPostMode.bind(this);
        this.setUnreadCount = this.setUnreadCount.bind(this);
        this.setUnreadCounts = this.setUnreadCounts.bind(this);
        this.getUnreadCount = this.getUnreadCount.bind(this);
        this.getUnreadCounts = this.getUnreadCounts.bind(this);

        this.currentId = null;
        this.postMode = this.POST_MODE_CHANNEL;
        this.channels = [];
        this.channelMembers = {};
        this.moreChannels = {};
        this.moreChannels.loading = true;
        this.extraInfos = {};
        this.unreadCounts = {};
    }

    get POST_MODE_CHANNEL() {
        return 1;
    }

    get POST_MODE_FOCUS() {
        return 2;
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

    emitLastViewed(lastViewed, ownNewMessage) {
        this.emit(LAST_VIEVED_EVENT, lastViewed, ownNewMessage);
    }

    addLastViewedListener(callback) {
        this.on(LAST_VIEVED_EVENT, callback);
    }

    removeLastViewedListener(callback) {
        this.removeListener(LAST_VIEVED_EVENT, callback);
    }

    findFirstBy(field, value) {
        return this.doFindFirst(field, value, this.getChannels());
    }

    findFirstMoreBy(field, value) {
        return this.doFindFirst(field, value, this.getMoreChannels());
    }

    doFindFirst(field, value, channels) {
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

    getByDisplayName(displayName) {
        return this.findFirstBy('display_name', displayName);
    }

    getMoreByName(name) {
        return this.findFirstMoreBy('name', name);
    }

    getAll() {
        return this.getChannels();
    }

    getAllMembers() {
        return this.getChannelMembers();
    }

    getMoreAll() {
        return this.getMoreChannels();
    }

    setCurrentId(id) {
        this.currentId = id;
    }

    resetCounts(id) {
        const cm = this.channelMembers;
        for (var cmid in cm) {
            if (cm[cmid].channel_id === id) {
                var c = this.get(id);
                if (c) {
                    cm[cmid].msg_count = this.get(id).total_msg_count;
                    cm[cmid].mention_count = 0;
                    this.setUnreadCount(id);
                }
                break;
            }
        }
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
        var members = this.getChannelMembers();
        members[member.channel_id] = member;
        this.storeChannelMembers(members);
        this.emitChange();
    }

    getCurrentExtraInfo() {
        return this.getExtraInfo(this.getCurrentId());
    }

    getExtraInfo(channelId) {
        var extra = null;

        if (channelId) {
            extra = this.getExtraInfos()[channelId];
        }

        if (extra) {
            // create a defensive copy
            extra = JSON.parse(JSON.stringify(extra));
        } else {
            extra = {members: []};
        }

        return extra;
    }

    pStoreChannel(channel) {
        var channels = this.getChannels();
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

        if (!Utils) {
            Utils = require('utils/utils.jsx'); //eslint-disable-line global-require
        }

        channels.sort(Utils.sortByDisplayName);
        this.storeChannels(channels);
    }

    storeChannels(channels) {
        this.channels = channels;
    }

    getChannels() {
        return this.channels;
    }

    pStoreChannelMember(channelMember) {
        var members = this.getChannelMembers();
        members[channelMember.channel_id] = channelMember;
        this.storeChannelMembers(members);
    }

    storeChannelMembers(channelMembers) {
        this.channelMembers = channelMembers;
    }

    getChannelMembers() {
        return this.channelMembers;
    }

    storeMoreChannels(channels) {
        this.moreChannels = channels;
    }

    getMoreChannels() {
        return this.moreChannels;
    }

    storeExtraInfos(extraInfos) {
        this.extraInfos = extraInfos;
    }

    getExtraInfos() {
        return this.extraInfos;
    }

    isDefault(channel) {
        return channel.name === Constants.DEFAULT_CHANNEL;
    }

    setPostMode(mode) {
        this.postMode = mode;
    }

    getPostMode() {
        return this.postMode;
    }

    setUnreadCount(id) {
        const ch = this.get(id);
        const chMember = this.getMember(id);

        let chMentionCount = chMember.mention_count;
        let chUnreadCount = ch.total_msg_count - chMember.msg_count - chMentionCount;

        if (ch.type === 'D') {
            chMentionCount = chUnreadCount;
            chUnreadCount = 0;
        } else if (chMember.notify_props && chMember.notify_props.mark_unread === NotificationPrefs.MENTION) {
            chUnreadCount = 0;
        }

        this.unreadCounts[id] = {msgs: chUnreadCount, mentions: chMentionCount};
    }

    setUnreadCounts() {
        const channels = this.getAll();
        channels.forEach((ch) => {
            this.setUnreadCount(ch.id);
        });
    }

    getUnreadCount(id) {
        return this.unreadCounts[id] || {msgs: 0, mentions: 0};
    }

    getUnreadCounts() {
        return this.unreadCounts;
    }

    leaveChannel(id) {
        Reflect.deleteProperty(this.channelMembers, id);
        const element = this.channels.indexOf(id);
        if (element > -1) {
            this.channels.splice(element, 1);
        }
    }
}

var ChannelStore = new ChannelStoreClass();

ChannelStore.dispatchToken = AppDispatcher.register((payload) => {
    var action = payload.action;
    var currentId;

    switch (action.type) {
    case ActionTypes.CLICK_CHANNEL:
        ChannelStore.setCurrentId(action.id);
        ChannelStore.resetCounts(action.id);
        ChannelStore.setPostMode(ChannelStore.POST_MODE_CHANNEL);
        ChannelStore.emitChange();
        break;

    case ActionTypes.RECEIVED_FOCUSED_POST: {
        const post = action.post_list.posts[action.postId];
        ChannelStore.setCurrentId(post.channel_id);
        ChannelStore.setPostMode(ChannelStore.POST_MODE_FOCUS);
        ChannelStore.emitChange();
        break;
    }

    case ActionTypes.RECEIVED_CHANNELS:
        ChannelStore.storeChannels(action.channels);
        ChannelStore.storeChannelMembers(action.members);
        currentId = ChannelStore.getCurrentId();
        if (currentId && window.isActive) {
            ChannelStore.resetCounts(currentId);
        }
        ChannelStore.setUnreadCounts();
        ChannelStore.emitChange();
        break;

    case ActionTypes.RECEIVED_CHANNEL:
        ChannelStore.pStoreChannel(action.channel);
        if (action.member) {
            ChannelStore.pStoreChannelMember(action.member);
        }
        currentId = ChannelStore.getCurrentId();
        if (currentId && window.isActive) {
            ChannelStore.resetCounts(currentId);
        }
        ChannelStore.setUnreadCount(action.channel.id);
        ChannelStore.emitChange();
        break;

    case ActionTypes.RECEIVED_MORE_CHANNELS:
        ChannelStore.storeMoreChannels(action.channels);
        ChannelStore.emitMoreChange();
        break;

    case ActionTypes.RECEIVED_CHANNEL_EXTRA_INFO:
        var extraInfos = ChannelStore.getExtraInfos();
        extraInfos[action.extra_info.id] = action.extra_info;
        ChannelStore.storeExtraInfos(extraInfos);
        ChannelStore.emitExtraInfoChange();
        break;

    case ActionTypes.LEAVE_CHANNEL:
        ChannelStore.leaveChannel(action.id);
        ChannelStore.emitLeave(action.id);
        break;

    default:
        break;
    }
});

export default ChannelStore;
