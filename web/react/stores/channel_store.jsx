// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import EventEmitter from 'events';

var Utils;
import Constants from '../utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;
const NotificationPrefs = Constants.NotificationPrefs;

const CHANGE_EVENT = 'change';
const LEAVE_EVENT = 'leave';
const MORE_CHANGE_EVENT = 'change';
const EXTRA_INFO_EVENT = 'extra_info';

class ChannelStoreClass extends EventEmitter {
    constructor(props) {
        super(props);

        this.setMaxListeners(11);

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
        this.findFirstBy = this.findFirstBy.bind(this);
        this.get = this.get.bind(this);
        this.getMember = this.getMember.bind(this);
        this.getByName = this.getByName.bind(this);
        this.pSetPostMode = this.pSetPostMode.bind(this);
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
        var members = this.pGetChannelMembers();
        members[member.channel_id] = member;
        this.pStoreChannelMembers(members);
        this.emitChange();
    }
    getCurrentExtraInfo() {
        return this.getExtraInfo(this.getCurrentId());
    }
    getExtraInfo(channelId) {
        var extra = null;

        if (channelId) {
            extra = this.pGetExtraInfos()[channelId];
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

        if (!Utils) {
            Utils = require('../utils/utils.jsx'); //eslint-disable-line global-require
        }

        channels.sort(Utils.sortByDisplayName);
        this.pStoreChannels(channels);
    }
    pStoreChannels(channels) {
        this.channels = channels;
    }
    pGetChannels() {
        return this.channels;
    }
    pStoreChannelMember(channelMember) {
        var members = this.pGetChannelMembers();
        members[channelMember.channel_id] = channelMember;
        this.pStoreChannelMembers(members);
    }
    pStoreChannelMembers(channelMembers) {
        this.channelMembers = channelMembers;
    }
    pGetChannelMembers() {
        return this.channelMembers;
    }
    pStoreMoreChannels(channels) {
        this.moreChannels = channels;
    }
    pGetMoreChannels() {
        return this.moreChannels;
    }
    pStoreExtraInfos(extraInfos) {
        this.extraInfos = extraInfos;
    }
    pGetExtraInfos() {
        return this.extraInfos;
    }
    isDefault(channel) {
        return channel.name === Constants.DEFAULT_CHANNEL;
    }

    pSetPostMode(mode) {
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
}

var ChannelStore = new ChannelStoreClass();

ChannelStore.dispatchToken = AppDispatcher.register((payload) => {
    var action = payload.action;
    var currentId;

    switch (action.type) {
    case ActionTypes.CLICK_CHANNEL:
        ChannelStore.setCurrentId(action.id);
        ChannelStore.resetCounts(action.id);
        ChannelStore.pSetPostMode(ChannelStore.POST_MODE_CHANNEL);
        ChannelStore.emitChange();
        break;

    case ActionTypes.RECIEVED_FOCUSED_POST: {
        const post = action.post_list.posts[action.postId];
        ChannelStore.setCurrentId(post.channel_id);
        ChannelStore.pSetPostMode(ChannelStore.POST_MODE_FOCUS);
        ChannelStore.emitChange();
        break;
    }

    case ActionTypes.RECIEVED_CHANNELS:
        ChannelStore.pStoreChannels(action.channels);
        ChannelStore.pStoreChannelMembers(action.members);
        currentId = ChannelStore.getCurrentId();
        if (currentId) {
            ChannelStore.resetCounts(currentId);
        }
        ChannelStore.setUnreadCounts();
        ChannelStore.emitChange();
        break;

    case ActionTypes.RECIEVED_CHANNEL:
        ChannelStore.pStoreChannel(action.channel);
        if (action.member) {
            ChannelStore.pStoreChannelMember(action.member);
        }
        currentId = ChannelStore.getCurrentId();
        if (currentId) {
            ChannelStore.resetCounts(currentId);
        }
        ChannelStore.setUnreadCount(action.channel.id);
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
