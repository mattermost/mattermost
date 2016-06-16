// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import Constants from 'utils/constants.jsx';
import EventEmitter from 'events';

const ActionTypes = Constants.ActionTypes;

const CHANGE_EVENT = 'changed';

class EmojiStore extends EventEmitter {
    constructor() {
        super();

        this.dispatchToken = AppDispatcher.register(this.handleEventPayload.bind(this));

        this.receivedCustomEmojis = false;
        this.customEmojis = new Map();
    }

    addChangeListener(callback) {
        this.on(CHANGE_EVENT, callback);
    }

    removeChangeListener(callback) {
        this.removeListener(CHANGE_EVENT, callback);
    }

    emitChange() {
        this.emit(CHANGE_EVENT);
    }

    hasReceivedCustomEmojis() {
        return this.receivedCustomEmojis;
    }

    getCustomEmojis() {
        return Array.from(this.customEmojis.values());
    }

    setCustomEmojis(customEmojis) {
        this.customEmojis = new Map();

        for (const emoji of customEmojis) {
            this.addCustomEmoji(emoji);
        }
    }

    addCustomEmoji(emoji) {
        this.customEmojis.set(emoji.name, emoji);
    }

    removeCustomEmoji(id) {
        for (const [name, emoji] of this.customEmojis) {
            if (emoji.id === id) {
                this.customEmojis.delete(name);
                break;
            }
        }
    }

    handleEventPayload(payload) {
        const action = payload.action;

        switch (action.type) {
        case ActionTypes.RECEIVED_CUSTOM_EMOJIS:
            this.setCustomEmojis(action.emojis);
            this.receivedCustomEmojis = true;
            this.emitChange();
            break;
        case ActionTypes.RECEIVED_CUSTOM_EMOJI:
            this.addCustomEmoji(action.emoji);
            this.emitChange();
            break;
        case ActionTypes.REMOVED_CUSTOM_EMOJI:
            this.removeCustomEmoji(action.id);
            this.emitChange();
            break;
        }
    }
}

export default new EmojiStore();