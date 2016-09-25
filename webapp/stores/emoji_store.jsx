// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import Constants from 'utils/constants.jsx';
import EventEmitter from 'events';

import * as Emoji from 'utils/emoji.jsx';

const ActionTypes = Constants.ActionTypes;

const CHANGE_EVENT = 'changed';

// Wrap the contents of the store so that we don't need to construct an ES6 map where most of the content
// (the system emojis) will never change. It provides the get/has functions of a map and an iterator so
// that it can be used in for..of loops
class EmojiMap {
    constructor(customEmojis) {
        this.customEmojis = customEmojis;

        // Store customEmojis to an array so we can iterate it more easily
        this.customEmojisArray = [...customEmojis];
    }

    has(name) {
        return Emoji.EmojiIndicesByAlias.has(name) || this.customEmojis.has(name);
    }

    get(name) {
        if (Emoji.EmojiIndicesByAlias.has(name)) {
            return Emoji.Emojis[Emoji.EmojiIndicesByAlias.get(name)];
        }

        return this.customEmojis.get(name);
    }

    [Symbol.iterator]() {
        const customEmojisArray = this.customEmojisArray;

        return {
            systemIndex: 0,
            customIndex: 0,
            next() {
                if (this.systemIndex < Emoji.Emojis.length) {
                    const emoji = Emoji.Emojis[this.systemIndex];

                    this.systemIndex += 1;

                    return {value: [emoji.aliases[0], emoji]};
                }

                if (this.customIndex < customEmojisArray.length) {
                    const emoji = customEmojisArray[this.customIndex][1];

                    this.customIndex += 1;

                    return {value: [emoji.name, emoji]};
                }

                return {done: true};
            }
        };
    }
}

class EmojiStore extends EventEmitter {
    constructor() {
        super();

        this.dispatchToken = AppDispatcher.register(this.handleEventPayload.bind(this));

        this.setMaxListeners(600);

        this.receivedCustomEmojis = false;
        this.customEmojis = new Map();

        this.map = new EmojiMap(this.customEmojis);
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
        customEmojis.sort((a, b) => a.name[0].localeCompare(b.name[0]));

        this.customEmojis = new Map();

        for (const emoji of customEmojis) {
            this.addCustomEmoji(emoji);
        }

        this.map = new EmojiMap(this.customEmojis);
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

    hasSystemEmoji(name) {
        return Emoji.EmojiIndicesByAlias.has(name);
    }

    getCustomEmojiMap() {
        return this.customEmojis;
    }

    getEmojis() {
        return this.map;
    }

    has(name) {
        return this.map.has(name);
    }

    get(name) {
        return this.map.get(name);
    }

    hasUnicode(codepoint) {
        return Emoji.EmojiIndicesByUnicode.has(codepoint);
    }

    getUnicode(codepoint) {
        return Emoji.Emojis[Emoji.EmojiIndicesByUnicode.get(codepoint)];
    }

    getEmojiImageUrl(emoji) {
        if (emoji.id) {
            // must match Client.getCustomEmojiImageUrl
            return `/api/v3/emoji/${emoji.id}`;
        }

        const filename = emoji.filename || emoji.aliases[0];

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
