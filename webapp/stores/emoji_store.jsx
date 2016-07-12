// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import Constants from 'utils/constants.jsx';
import EventEmitter from 'events';

import EmojiJson from 'utils/emoji.json';

const ActionTypes = Constants.ActionTypes;

const CHANGE_EVENT = 'changed';

class EmojiStore extends EventEmitter {
    constructor() {
        super();

        this.dispatchToken = AppDispatcher.register(this.handleEventPayload.bind(this));

        this.emojis = new Map(EmojiJson);
        this.systemEmojis = new Map(EmojiJson);

        this.unicodeEmojis = new Map();
        for (const [, emoji] of this.systemEmojis) {
            if (emoji.unicode) {
                this.unicodeEmojis.set(emoji.unicode, emoji);
            }
        }

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

    setCustomEmojis(customEmojis) {
        this.customEmojis = new Map();

        for (const emoji of customEmojis) {
            this.addCustomEmoji(emoji);
        }

        this.updateEmojiMap();
    }

    addCustomEmoji(emoji) {
        this.customEmojis.set(emoji.name, emoji);

        // this doesn't update this.emojis, but it's only called by setCustomEmojis which does that afterwards
    }

    removeCustomEmoji(id) {
        for (const [name, emoji] of this.customEmojis) {
            if (emoji.id === id) {
                this.customEmojis.delete(name);
                break;
            }
        }

        this.updateEmojiMap();
    }

    updateEmojiMap() {
        // add custom emojis to the map first so that they can't override system ones
        this.emojis = new Map([...this.customEmojis, ...this.systemEmojis]);
    }

    getSystemEmojis() {
        return this.systemEmojis;
    }

    getCustomEmojiMap() {
        return this.customEmojis;
    }

    getEmojis() {
        return this.emojis;
    }

    has(name) {
        return this.emojis.has(name);
    }

    get(name) {
        // prioritize system emojis so that custom ones can't override them
        return this.emojis.get(name);
    }

    hasUnicode(codepoint) {
        return this.unicodeEmojis.has(codepoint);
    }

    getUnicode(codepoint) {
        return this.unicodeEmojis.get(codepoint);
    }

    getEmojiImageUrl(emoji) {
        if (emoji.id) {
            // must match Client.getCustomEmojiImageUrl
            return `/api/v3/emoji/${emoji.id}`;
        }

        const filename = emoji.unicode || emoji.filename || emoji.name;

        return Constants.EMOJI_PATH + '/' + filename + '.png';
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
