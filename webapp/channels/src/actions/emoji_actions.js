// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as EmojiActions from 'mattermost-redux/actions/emojis';
import {savePreferences} from 'mattermost-redux/actions/preferences';
import {getCustomEmojisEnabled} from 'mattermost-redux/selectors/entities/emojis';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {getEmojiName} from 'mattermost-redux/utils/emoji_utils';

import {getEmojiMap, getRecentEmojisData, getRecentEmojisNames} from 'selectors/emojis';
import LocalStorageStore from 'stores/local_storage_store';

import Constants, {ActionTypes, Preferences} from 'utils/constants';

export function loadRecentlyUsedCustomEmojis() {
    return (dispatch, getState) => {
        const state = getState();

        if (!getCustomEmojisEnabled(state)) {
            return {data: true};
        }

        const recentEmojiNames = getRecentEmojisNames(state);

        return dispatch(EmojiActions.getCustomEmojisByNameBatched(recentEmojiNames));
    };
}

export function incrementEmojiPickerPage() {
    return async (dispatch) => {
        dispatch({
            type: ActionTypes.INCREMENT_EMOJI_PICKER_PAGE,
        });

        return {data: true};
    };
}

export function setUserSkinTone(skin) {
    return async (dispatch, getState) => {
        const state = getState();
        const currentUserId = getCurrentUserId(state);
        const skinTonePreference = [{
            user_id: currentUserId,
            name: Preferences.EMOJI_SKINTONE,
            category: Preferences.CATEGORY_EMOJI,
            value: skin,
        }];
        dispatch(savePreferences(currentUserId, skinTonePreference));
    };
}

export function addRecentEmoji(alias) {
    return addRecentEmojis([alias]);
}

export const MAXIMUM_RECENT_EMOJI = 27;

export function addRecentEmojis(aliases) {
    return (dispatch, getState) => {
        const state = getState();
        const currentUserId = getCurrentUserId(state);
        const recentEmojis = getRecentEmojisData(state);
        const emojiMap = getEmojiMap(state);

        let updatedRecentEmojis = [...recentEmojis];
        for (const alias of aliases) {
            const emoji = emojiMap.get(alias);
            if (!emoji) {
                continue;
            }

            const name = getEmojiName(emoji);

            const currentEmojiIndexInRecentList = updatedRecentEmojis.findIndex((recentEmoji) => recentEmoji.name === name);
            if (currentEmojiIndexInRecentList > -1) {
                const currentEmojiInRecentList = updatedRecentEmojis[currentEmojiIndexInRecentList];

                // If the emoji is already in the recent list, remove it and add it to the front with updated usage count
                const updatedCurrentEmojiData = {
                    name,
                    usageCount: currentEmojiInRecentList.usageCount + 1,
                };
                updatedRecentEmojis.splice(currentEmojiIndexInRecentList, 1);
                updatedRecentEmojis = [...updatedRecentEmojis, updatedCurrentEmojiData].slice(-MAXIMUM_RECENT_EMOJI);
            } else {
                const currentEmojiData = {
                    name,
                    usageCount: 1,
                };
                updatedRecentEmojis = [...updatedRecentEmojis, currentEmojiData].slice(-MAXIMUM_RECENT_EMOJI);
            }
        }

        // sort emojis by count in the ascending order
        updatedRecentEmojis.sort(
            (emojiA, emojiB) => emojiA.usageCount - emojiB.usageCount,
        );

        dispatch(savePreferences(currentUserId, [{category: Constants.Preferences.RECENT_EMOJIS, name: currentUserId, user_id: currentUserId, value: JSON.stringify(updatedRecentEmojis)}]));

        return {data: true};
    };
}

export function migrateRecentEmojis() {
    return async (dispatch, getState) => {
        const state = getState();
        const currentUserId = getCurrentUserId(state);
        const recentEmojisFromPreference = getRecentEmojisData(state);
        if (recentEmojisFromPreference.length === 0) {
            const recentEmojisFromLocalStorage = LocalStorageStore.getRecentEmojis(currentUserId);
            if (recentEmojisFromLocalStorage) {
                const parsedRecentEmojisFromLocalStorage = JSON.parse(recentEmojisFromLocalStorage);
                const toSetRecentEmojiData = parsedRecentEmojisFromLocalStorage.map((emojiName) => ({name: emojiName, usageCount: 1}));
                if (toSetRecentEmojiData.length > 0) {
                    dispatch(savePreferences(currentUserId, [{category: Constants.Preferences.RECENT_EMOJIS, name: currentUserId, user_id: currentUserId, value: JSON.stringify(toSetRecentEmojiData)}]));
                }
                return {data: parsedRecentEmojisFromLocalStorage};
            }
        }
        return {data: recentEmojisFromPreference};
    };
}
