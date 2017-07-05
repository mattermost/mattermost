// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from 'dispatcher/app_dispatcher.jsx';
import EventEmitter from 'events';

import TeamStore from 'stores/team_store.jsx';
import UserStore from 'stores/user_store.jsx';

var ChannelUtils;
var Utils;
import {ActionTypes, Constants} from 'utils/constants.jsx';
import {isSystemMessage, isFromWebhook} from 'utils/post_utils.jsx';
const NotificationPrefs = Constants.NotificationPrefs;

const CHANGE_EVENT = 'change';
const STATS_EVENT = 'stats';
const LAST_VIEVED_EVENT = 'last_viewed';

import store from 'stores/redux_store.jsx';
import * as Selectors from 'mattermost-redux/selectors/entities/channels';
import {ChannelTypes, UserTypes} from 'mattermost-redux/action_types';
import {batchActions} from 'redux-batched-actions';

class ChannelStoreClass extends EventEmitter {
    constructor(props) {
        super(props);
        this.setMaxListeners(600);
        this.clear();

        this.entities = store.getState().entities.channels;

        store.subscribe(() => {
            const newEntities = store.getState().entities.channels;
            let doEmit = false;

            if (newEntities.currentChannelId !== this.entities.currentChannelId) {
                doEmit = true;
            }
            if (newEntities.channels !== this.entities.channels) {
                this.setUnreadCountsByChannels(Object.values(newEntities.channels));
                doEmit = true;
            }
            if (newEntities.myMembers !== this.entities.myMembers) {
                this.setUnreadCountsByMembers(Object.values(newEntities.myMembers));
                this.emitLastViewed();
                doEmit = true;
            }
            if (newEntities.membersInChannel !== this.entities.membersInChannel) {
                doEmit = true;
            }
            if (newEntities.stats !== this.entities.stats) {
                this.emitStatsChange();
            }

            if (doEmit) {
                this.emitChange();
            }

            this.entities = newEntities;
        });
    }

    clear() {
        this.postMode = this.POST_MODE_CHANNEL;
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

    emitLastViewed() {
        this.emit(LAST_VIEVED_EVENT);
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
        store.dispatch({
            type: ChannelTypes.SELECT_CHANNEL,
            data: id,
            member: this.getMyMember(id)
        });
    }

    resetCounts(ids) {
        const membersToStore = [];
        ids.forEach((id) => {
            const member = this.getMyMember(id);
            const channel = this.get(id);
            if (member && channel) {
                const memberToStore = {...member};
                memberToStore.msg_count = channel.total_msg_count;
                memberToStore.mention_count = 0;
                membersToStore.push(memberToStore);
                this.setUnreadCountByChannel(id);
            }
        });

        this.storeMyChannelMembersList(membersToStore);
    }

    getCurrentId() {
        return Selectors.getCurrentChannelId(store.getState());
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
            stats = Selectors.getAllChannelStats(store.getState())[channelId];
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

        if (!ChannelUtils) {
            ChannelUtils = require('utils/channel_utils.jsx'); //eslint-disable-line global-require
        }

        channels = channels.sort(ChannelUtils.sortChannelsByDisplayName);
        this.storeChannels(channels);
    }

    storeChannels(channels) {
        store.dispatch({
            type: ChannelTypes.RECEIVED_CHANNELS,
            data: channels,
            teamId: channels[0].team_id
        });
    }

    getChannels() {
        return Selectors.getMyChannels(store.getState());
    }

    getChannelById(id) {
        return this.get(id);
    }

    storeMyChannelMember(channelMember) {
        store.dispatch({
            type: ChannelTypes.RECEIVED_MY_CHANNEL_MEMBER,
            data: channelMember
        });
    }

    storeMyChannelMembers(channelMembers) {
        store.dispatch({
            type: ChannelTypes.RECEIVED_MY_CHANNEL_MEMBERS,
            data: Object.values(channelMembers)
        });
    }

    storeMyChannelMembersList(channelMembers) {
        store.dispatch({
            type: ChannelTypes.RECEIVED_MY_CHANNEL_MEMBERS,
            data: channelMembers
        });
    }

    getMyMembers() {
        return Selectors.getMyChannelMemberships(store.getState());
    }

    saveMembersInChannel(channelId = this.getCurrentId(), members) {
        store.dispatch({
            type: ChannelTypes.RECEIVED_CHANNEL_MEMBERS,
            data: Object.values(members)
        });
    }

    removeMemberInChannel(channelId = this.getCurrentId(), userId) {
        store.dispatch({
            type: UserTypes.RECEIVED_PROFILE_NOT_IN_CHANNEL,
            data: {id: channelId, user_id: userId}
        });
    }

    getMembersInChannel(channelId = this.getCurrentId()) {
        return Selectors.getChannelMembersInChannels(store.getState())[channelId] || {};
    }

    hasActiveMemberInChannel(channelId = this.getCurrentId(), userId) {
        const members = this.getMembersInChannel(channelId);
        if (members && members[userId]) {
            return true;
        }

        return false;
    }

    storeMoreChannels(channels, teamId = TeamStore.getCurrentId()) {
        store.dispatch({
            type: ChannelTypes.RECEIVED_CHANNELS,
            data: channels,
            teamId
        });
    }

    getMoreChannels() {
        const channels = Selectors.getOtherChannels(store.getState());
        const channelMap = {};
        channels.forEach((c) => {
            channelMap[c.id] = c;
        });
        return channelMap;
    }

    getMoreChannelsList() {
        return Selectors.getOtherChannels(store.getState());
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
        Object.keys(this.getMyMembers()).forEach((key) => {
            this.setUnreadCountByChannel(this.getMyMember(key).channel_id);
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

    isChannelAdminForCurrentChannel() {
        if (!Utils) {
            Utils = require('utils/utils.jsx'); //eslint-disable-line global-require
        }

        const member = this.getMyMember(this.getCurrentId());

        if (!member) {
            return false;
        }

        return Utils.isChannelAdmin(member.roles);
    }

    isChannelAdmin(userId, channelId) {
        if (!Utils) {
            Utils = require('utils/utils.jsx'); //eslint-disable-line global-require
        }

        const channelMembers = this.getMembersInChannel(channelId);
        const channelMember = channelMembers[userId];

        if (channelMember) {
            return Utils.isChannelAdmin(channelMember.roles);
        }

        return false;
    }

    incrementMessages(id, markRead = false) {
        if (!this.unreadCounts[id]) {
            // Should never happen
            console.log(`Missing channel_id=${id} in unreads object`); //eslint-disable-line no-console
        }

        const member = this.getMyMember(id);
        if (member && member.notify_props && member.notify_props.mark_unread === NotificationPrefs.MENTION) {
            return;
        }

        const channel = {...this.get(id)};
        channel.total_msg_count++;

        const actions = [];
        if (markRead) {
            actions.push({
                type: ChannelTypes.RECEIVED_MY_CHANNEL_MEMBER,
                data: {...member, msg_count: channel.total_msg_count}
            });
        }

        actions.push(
            {
                type: ChannelTypes.RECEIVED_CHANNEL,
                data: channel
            }
        );
        store.dispatch(batchActions(actions));
    }

    incrementMentionsIfNeeded(id, msgProps) {
        let mentions = [];
        if (msgProps && msgProps.mentions) {
            mentions = JSON.parse(msgProps.mentions);
        }

        if (!this.unreadCounts[id]) {
            // Should never happen
            console.log(`Missing channel_id=${id} in unreads object`); //eslint-disable-line no-console
        }

        if (mentions.indexOf(UserStore.getCurrentId()) !== -1) {
            const member = {...this.getMyMember(id)};
            member.mention_count++;
            store.dispatch({
                type: ChannelTypes.RECEIVED_MY_CHANNEL_MEMBER,
                data: member
            });
        }
    }
}

var ChannelStore = new ChannelStoreClass();

ChannelStore.dispatchToken = AppDispatcher.register((payload) => {
    var action = payload.action;

    switch (action.type) {
    case ActionTypes.CLICK_CHANNEL:
        ChannelStore.setCurrentId(action.id);
        ChannelStore.setPostMode(ChannelStore.POST_MODE_CHANNEL);
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
        break;

    case ActionTypes.RECEIVED_CHANNEL:
        ChannelStore.storeChannel(action.channel);
        if (action.member) {
            ChannelStore.storeMyChannelMember(action.member);
        }
        break;

    case ActionTypes.RECEIVED_MY_CHANNEL_MEMBERS:
        ChannelStore.storeMyChannelMembersList(action.members);
        break;
    case ActionTypes.RECEIVED_CHANNEL_MEMBER:
        ChannelStore.storeMyChannelMember(action.member);
        break;
    case ActionTypes.RECEIVED_MORE_CHANNELS:
        ChannelStore.storeMoreChannels(action.channels);
        break;
    case ActionTypes.RECEIVED_MEMBERS_IN_CHANNEL:
        ChannelStore.saveMembersInChannel(action.channel_id, action.channel_members);
        break;
    case ActionTypes.RECEIVED_CHANNEL_STATS:
        store.dispatch({
            type: ChannelTypes.RECEIVED_CHANNEL_STATS,
            data: action.stats
        });
        break;

    case ActionTypes.RECEIVED_POST:
        if (Constants.IGNORE_POST_TYPES.indexOf(action.post.type) !== -1) {
            return;
        }

        if (action.post.user_id === UserStore.getCurrentId() && !isSystemMessage(action.post) && !isFromWebhook(action.post)) {
            return;
        }

        var id = action.post.channel_id;
        var teamId = action.websocketMessageProps ? action.websocketMessageProps.team_id : null;
        var markRead = id === ChannelStore.getCurrentId() && window.isActive;

        if (TeamStore.getCurrentId() === teamId || teamId === '') {
            if (!markRead) {
                ChannelStore.incrementMentionsIfNeeded(id, action.websocketMessageProps);
            }
            ChannelStore.incrementMessages(id, markRead);
        }
        break;

    case ActionTypes.CREATE_POST:
        ChannelStore.incrementMessages(action.post.channel_id, true);
        break;

    case ActionTypes.CREATE_COMMENT:
        ChannelStore.incrementMessages(action.post.channel_id, true);
        break;

    default:
        break;
    }
});

export default ChannelStore;
