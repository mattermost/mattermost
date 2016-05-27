// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import EventEmitter from 'events';
import Constants from 'utils/constants.jsx';
import UserStore from './user_store.jsx';
import ChannelStore from './channel_store.jsx';
import * as Utils from 'utils/utils.jsx';
import * as PostUtils from 'utils/post_utils.jsx';
const ActionTypes = Constants.ActionTypes;

const CHANGE_EVENT = 'change';

class NotificationStoreClass extends EventEmitter {
    emitChange() {
        this.emit(CHANGE_EVENT);
    }

    addChangeListener(callback) {
        this.on(CHANGE_EVENT, callback);
    }

    removeChangeListener(callback) {
        this.removeListener(CHANGE_EVENT, callback);
    }

    handleRecievedPost(post, msgProps) {
        // Send desktop notification
        if ((UserStore.getCurrentId() !== post.user_id || post.props.from_webhook === 'true') && !PostUtils.isSystemMessage(post)) {
            let mentions = [];
            if (msgProps.mentions) {
                mentions = JSON.parse(msgProps.mentions);
            }

            const channel = ChannelStore.get(post.channel_id);
            const user = UserStore.getCurrentUser();
            const member = ChannelStore.getMember(post.channel_id);

            let notifyLevel = member && member.notify_props ? member.notify_props.desktop : 'default';
            if (notifyLevel === 'default') {
                notifyLevel = user.notify_props.desktop;
            }

            if (notifyLevel === 'none') {
                return;
            } else if (notifyLevel === 'mention' && mentions.indexOf(user.id) === -1 && msgProps.channel_type !== Constants.DM_CHANNEL) {
                return;
            }

            let username = Utils.localizeMessage('channel_loader.someone', 'Someone');
            if (post.props.override_username && global.window.mm_config.EnablePostUsernameOverride === 'true') {
                username = post.props.override_username;
            } else if (UserStore.hasProfile(post.user_id)) {
                username = UserStore.getProfile(post.user_id).username;
            }

            let title = Utils.localizeMessage('channel_loader.posted', 'Posted');
            if (channel) {
                title = channel.display_name;
            }

            let notifyText = post.message.replace(/\n+/g, ' ');
            if (notifyText.length > 50) {
                notifyText = notifyText.substring(0, 49) + '...';
            }

            if (notifyText.length === 0) {
                if (msgProps.image) {
                    Utils.notifyMe(title, username + Utils.localizeMessage('channel_loader.uploadedImage', ' uploaded an image'), channel);
                } else if (msgProps.otherFile) {
                    Utils.notifyMe(title, username + Utils.localizeMessage('channel_loader.uploadedFile', ' uploaded a file'), channel);
                } else {
                    Utils.notifyMe(title, username + Utils.localizeMessage('channel_loader.something', ' did something new'), channel);
                }
            } else {
                Utils.notifyMe(title, username + Utils.localizeMessage('channel_loader.wrote', ' wrote: ') + notifyText, channel);
            }
            if (!user.notify_props || user.notify_props.desktop_sound === 'true') {
                Utils.ding();
            }
        }
    }
}

var NotificationStore = new NotificationStoreClass();

NotificationStore.dispatchToken = AppDispatcher.register((payload) => {
    const action = payload.action;

    switch (action.type) {
    case ActionTypes.RECEIVED_POST:
        NotificationStore.handleRecievedPost(action.post, action.websocketMessageProps);
        NotificationStore.emitChange();
        break;
    }
});

export default NotificationStore;
