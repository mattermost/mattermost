// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from 'dispatcher/app_dispatcher.jsx';
import Constants from 'utils/constants.jsx';
import EventEmitter from 'events';
import * as Emoji from 'utils/emoji.jsx';

import store from 'stores/redux_store.jsx';
import {getCustomEmojisByName} from 'mattermost-redux/selectors/entities/emojis';
import {Client4} from 'mattermost-redux/client';

const ActionTypes = Constants.ActionTypes;

const CHANGE_EVENT = 'changed';
const MAXIMUM_RECENT_EMOJI = 27;

// Wrap the contents of the store so that we don't need to construct an ES6 map where most of the content
// (the system emojis) will never change. It provides the get/has functions of a map and an iterator so
// that it can be used in for..of loops
export class EmojiMap {
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

        this.map = new EmojiMap(getCustomEmojisByName(store.getState()));

        this.entities = {};

        store.subscribe(() => {
            const newEntities = store.getState().entities.emojis.customEmoji;

            if (newEntities !== this.entities) {
                this.map = new EmojiMap(getCustomEmojisByName(store.getState()));
                this.emitChange();
            }

            this.entities = newEntities;
        });
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

    hasSystemEmoji(name) {
        return Emoji.EmojiIndicesByAlias.has(name);
    }

    getCustomEmojiMap() {
        return getCustomEmojisByName(store.getState());
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

    addRecentEmoji(alias) {
        const recentEmojis = this.getRecentEmojis();

        let name;
        const emoji = this.get(alias);
        if (!emoji) {
            return;
        } else if (emoji.name) {
            name = emoji.name;
        } else {
            name = emoji.aliases[0];
        }

        const index = recentEmojis.indexOf(name);
        if (index !== -1) {
            recentEmojis.splice(index, 1);
        }

        recentEmojis.push(name);

        if (recentEmojis.length > MAXIMUM_RECENT_EMOJI) {
            recentEmojis.splice(0, recentEmojis.length - MAXIMUM_RECENT_EMOJI);
        }

        localStorage.setItem(Constants.RECENT_EMOJI_KEY, JSON.stringify(recentEmojis));
    }

    getRecentEmojis() {
        let recentEmojis;
        try {
            recentEmojis = JSON.parse(localStorage.getItem(Constants.RECENT_EMOJI_KEY));
        } catch (e) {
            // Errors are handled below
        }

        if (!recentEmojis) {
            return [];
        }

        if (recentEmojis.length > 0 && typeof recentEmojis[0] === 'object') {
            // Prior to PLT-7267, recent emojis were stored with the entire object for the emoji, but this
            // has been changed to store only the names of the emojis, so we need to change that
            recentEmojis = recentEmojis.map((emoji) => {
                return emoji.name || emoji.aliases[0];
            });
        }

        return recentEmojis;
    }

    hasUnicode(codepoint) {
        return Emoji.EmojiIndicesByUnicode.has(codepoint);
    }

    getUnicode(codepoint) {
        return Emoji.Emojis[Emoji.EmojiIndicesByUnicode.get(codepoint)];
    }

    getEmojiImageUrl(emoji) {
        if (emoji.id) {
            return Client4.getUrlVersion() + '/emoji/' + emoji.id + '/image';
        }

        const filename = emoji.filename || emoji.aliases[0];

        return Constants.EMOJI_PATH + '/' + filename + '.png';
    }

    handleEventPayload(payload) {
        const action = payload.action;

        switch (action.type) {
        case ActionTypes.EMOJI_POSTED:
            this.addRecentEmoji(action.alias);
            this.emitChange();
            break;
        }
    }
}

export default new EmojiStore();
