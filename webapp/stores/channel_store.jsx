// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import EventEmitter from 'events';

var Utils;
import {ActionTypes, Constants} from 'utils/constants.jsx';
const NotificationPrefs = Constants.NotificationPrefs;

const CHANGE_EVENT = 'change';
const STATS_EVENT = 'stats';
const LAST_VIEVED_EVENT = 'last_viewed';

class ChannelStoreClass extends EventEmitter {
    constructor(props) {
        super(props);

        this.setMaxListeners(600);

        this.currentId = null;
        this.postMode = this.POST_MODE_CHANNEL;
        this.channels = [];
        this.myChannelMembers = {};
        this.moreChannels = {};
        this.stats = {};
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

    emitStatsChange() {
        this.emit(STATS_EVENT);
    }

    addStatsChangeListener(callback) {
        this.on(STATS_EVENT, callback);
    }

    removeStatsChangeListener(callback) {
        this.removeListener(STATS_EVENT, callback);
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

    getMyMember(id) {
        return this.getMyMembers()[id];
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

    getMoreAll() {
        return this.getMoreChannels();
    }

    setCurrentId(id) {
        this.currentId = id;
    }

    resetCounts(id) {
        const cm = this.myChannelMembers;
        for (const cmid in cm) {
            if (cm[cmid].channel_id === id) {
                const channel = this.get(id);
                if (channel) {
                    cm[cmid].msg_count = channel.total_msg_count;
                    cm[cmid].mention_count = 0;
                    this.setUnreadCountByChannel(id);
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
            return this.getMyMembers()[currentId];
        }

        return null;
    }

    getCurrentStats() {
        return this.getStats(this.getCurrentId());
    }

    getStats(channelId) {
        let stats;

        if (channelId) {
            stats = this.stats[channelId];
        }

        if (stats) {
            // create a defensive copy
            stats = Object.assign({}, stats);
        } else {
            stats = {member_count: 0};
        }

        return stats;
    }

    storeChannel(channel) {
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

    storeMyChannelMember(channelMember) {
        const members = Object.assign({}, this.getMyMembers());
        members[channelMember.channel_id] = channelMember;
        this.storeMyChannelMembers(members);
    }

    storeMyChannelMembers(channelMembers) {
        this.myChannelMembers = channelMembers;
    }

    storeMyChannelMembersList(channelMembers) {
        channelMembers.forEach((m) => {
            this.myChannelMembers[m.channel_id] = m;
        });
    }

    getMyMembers() {
        return this.myChannelMembers;
    }

    storeMoreChannels(channels) {
        this.moreChannels = channels;
    }

    getMoreChannels() {
        return this.moreChannels;
    }

    storeStats(stats) {
        this.stats = stats;
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

    setUnreadCountsByMembers(members) {
        members.forEach((m) => {
            this.setUnreadCountByChannel(m.channel_id);
        });
    }

    setUnreadCountsByCurrentMembers() {
        Object.keys(this.myChannelMembers).forEach((key) => {
            this.setUnreadCountByChannel(this.myChannelMembers[key].channel_id);
        });
    }

    setUnreadCountsByChannels(channels) {
        channels.forEach((c) => {
            this.setUnreadCountByChannel(c.id);
        });
    }

    setUnreadCountByChannel(id) {
        const ch = this.get(id);
        const chMember = this.getMyMember(id);

        if (ch == null || chMember == null) {
            return;
        }

        const chMentionCount = chMember.mention_count;
        let chUnreadCount = ch.total_msg_count - chMember.msg_count;

        if (chMember.notify_props && chMember.notify_props.mark_unread === NotificationPrefs.MENTION) {
            chUnreadCount = 0;
        }

        this.unreadCounts[id] = {msgs: chUnreadCount, mentions: chMentionCount};
    }

    getUnreadCount(id) {
        return this.unreadCounts[id] || {msgs: 0, mentions: 0};
    }

    getUnreadCounts() {
        return this.unreadCounts;
    }

    getChannelNamesMap() {
        var channelNamesMap = {};

        var channels = this.getChannels();
        for (var key in channels) {
            if (channels.hasOwnProperty(key)) {
                var channel = channels[key];
                channelNamesMap[channel.name] = channel;
            }
        }

        var moreChannels = this.getMoreChannels();
        for (var moreKey in moreChannels) {
            if (moreChannels.hasOwnProperty(moreKey)) {
                var moreChannel = moreChannels[moreKey];
                channelNamesMap[moreChannel.name] = moreChannel;
            }
        }

        return channelNamesMap;
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
        ChannelStore.setUnreadCountsByChannels(action.channels);
        ChannelStore.emitChange();
        break;

    case ActionTypes.RECEIVED_CHANNEL:
        ChannelStore.storeChannel(action.channel);
        if (action.member) {
            ChannelStore.storeMyChannelMember(action.member);
        }
        currentId = ChannelStore.getCurrentId();
        if (currentId && window.isActive) {
            ChannelStore.resetCounts(currentId);
        }
        ChannelStore.setUnreadCountByChannel(action.channel.id);
        ChannelStore.emitChange();
        break;

    case ActionTypes.RECEIVED_MY_CHANNEL_MEMBERS:
        ChannelStore.storeMyChannelMembersList(action.members);
        currentId = ChannelStore.getCurrentId();
        if (currentId && window.isActive) {
            ChannelStore.resetCounts(currentId);
        }
        ChannelStore.setUnreadCountsByMembers(action.members);
        ChannelStore.emitChange();
        break;
    case ActionTypes.RECEIVED_CHANNEL_MEMBER:
        ChannelStore.storeMyChannelMember(action.member);
        currentId = ChannelStore.getCurrentId();
        if (currentId && window.isActive) {
            ChannelStore.resetCounts(currentId);
        }
        ChannelStore.setUnreadCountsByCurrentMembers();
        ChannelStore.emitChange();
        break;
    case ActionTypes.RECEIVED_MORE_CHANNELS:
        ChannelStore.storeMoreChannels(action.channels);
        ChannelStore.emitChange();
        break;

    case ActionTypes.RECEIVED_CHANNEL_STATS:
        var stats = Object.assign({}, ChannelStore.getStats());
        stats[action.stats.channel_id] = action.stats;
        ChannelStore.storeStats(stats);
        ChannelStore.emitStatsChange();
        break;

    default:
        break;
    }
});

export default ChannelStore;
