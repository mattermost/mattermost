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

    removeRecentEmoji(id) {
        const recentEmojis = this.getRecentEmojis();
        for (let i = recentEmojis.length - 1; i >= 0; i--) {
            if (recentEmojis[i].id === id) {
                recentEmojis.splice(i, 1);
                break;
            }
        }
        localStorage.setItem(Constants.RECENT_EMOJI_KEY, JSON.stringify(recentEmojis));
    }

    addRecentEmoji(rawAlias) {
        const recentEmojis = this.getRecentEmojis();

        const alias = rawAlias.split(':').join('');

        let emoji = this.getCustomEmojiMap().get(alias);

        if (!emoji) {
            const emojiIndex = Emoji.EmojiIndicesByAlias.get(alias);
            emoji = Emoji.Emojis[emojiIndex];
        }

        if (!emoji) {
            // something is wrong, so we return
            return;
        }

        // odd workaround to the lack of array.findLastIndex - reverse looping & splice
        for (let i = recentEmojis.length - 1; i >= 0; i--) {
            if ((emoji.name && recentEmojis[i].name === emoji.name) ||
                (emoji.filename && recentEmojis[i].filename === emoji.filename)) {
                recentEmojis.splice(i, 1);
                break;
            }
        }
        recentEmojis.push(emoji);

        // cut off the _top_ if it's over length (since new are added to end)
        if (recentEmojis.length > MAXIMUM_RECENT_EMOJI) {
            recentEmojis.splice(0, recentEmojis.length - MAXIMUM_RECENT_EMOJI);
        }
        localStorage.setItem(Constants.RECENT_EMOJI_KEY, JSON.stringify(recentEmojis));
    }

    getRecentEmojis() {
        const result = JSON.parse(localStorage.getItem(Constants.RECENT_EMOJI_KEY));
        if (!result) {
            return [];
        }
        return result;
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
