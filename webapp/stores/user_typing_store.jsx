// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import UserStore from 'stores/user_store.jsx';
import EventEmitter from 'events';
import * as Utils from 'utils/utils.jsx';

import Constants from 'utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;

const CHANGE_EVENT = 'change';

class UserTypingStoreClass extends EventEmitter {
    constructor() {
        super();

        // All typeing users by channel
        // this.typingUsers.[channelId+postParentId].user if present then user us typing
        // Value is timeout to remove user
        this.typingUsers = {};
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

    usernameFromId(userId) {
        let username = Utils.localizeMessage('msg_typing.someone', 'Someone');
        if (UserStore.hasProfile(userId)) {
            username = UserStore.getProfile(userId).username;
        }
        return username;
    }

    userTyping(channelId, userId, postParentId) {
        const username = this.usernameFromId(userId);

        // Key representing a location where users can type
        const loc = channelId + postParentId;

        // Create entry
        if (!this.typingUsers[loc]) {
            this.typingUsers[loc] = {};
        }

        // If we already have this user, clear it's timeout to be deleted
        if (this.typingUsers[loc][username]) {
            clearTimeout(this.typingUsers[loc][username].timeout);
        }

        // Set the user and a timeout to remove it
        this.typingUsers[loc][username] = setTimeout(() => {
            delete this.typingUsers[loc][username];
            if (this.typingUsers[loc] === {}) {
                delete this.typingUsers[loc];
            }
            this.emitChange();
        }, Constants.UPDATE_TYPING_MS);
        this.emitChange();
    }

    getUsersTyping(channelId, postParentId) {
        // Key representing a location where users can type
        const loc = channelId + postParentId;

        return this.typingUsers[loc];
    }

    userPosted(userId, channelId, postParentId) {
        const username = this.usernameFromId(userId);
        const loc = channelId + postParentId;

        if (this.typingUsers[loc]) {
            clearTimeout(this.typingUsers[loc][username]);
            delete this.typingUsers[loc][username];
            if (this.typingUsers[loc] === {}) {
                delete this.typingUsers[loc];
            }
            this.emitChange();
        }
    }
}

var UserTypingStore = new UserTypingStoreClass();

UserTypingStore.dispatchToken = AppDispatcher.register((payload) => {
    var action = payload.action;

    switch (action.type) {
    case ActionTypes.RECEIVED_POST:
        UserTypingStore.userPosted(action.post.user_id, action.post.channel_id, action.post.parent_id);
        break;
    case ActionTypes.USER_TYPING:
        UserTypingStore.userTyping(action.channelId, action.userId, action.postParentId);
        break;
    }
});

export default UserTypingStore;
