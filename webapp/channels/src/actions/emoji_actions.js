// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as EmojiActions from 'mattermost-redux/actions/emojis';
import {savePreferences} from 'mattermost-redux/actions/preferences';
import {Preferences as ReduxPreferences} from 'mattermost-redux/constants';
import {getCustomEmojisByName as selectCustomEmojisByName, getCustomEmojisEnabled} from 'mattermost-redux/selectors/entities/emojis';
import {get} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {getEmojiName} from 'mattermost-redux/utils/emoji_utils';

import {getEmojiMap, getRecentEmojisData, getRecentEmojisNames, isCustomEmojiEnabled} from 'selectors/emojis';
import {isCustomStatusEnabled, makeGetCustomStatus} from 'selectors/views/custom_status';
import LocalStorageStore from 'stores/local_storage_store';

import Constants, {ActionTypes, Preferences} from 'utils/constants';
import {EmojiIndicesByAlias} from 'utils/emoji';

export function loadRecentlyUsedCustomEmojis() {
    return (dispatch, getState) => {
        const state = getState();

        if (!getCustomEmojisEnabled(state)) {
            return {data: true};
        }

        const recentEmojiNames = getRecentEmojisNames(state);

        return dispatch(EmojiActions.getCustomEmojisByName(recentEmojiNames));
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

export function loadCustomEmojisForCustomStatusesByUserIds(userIds) {
    const getCustomStatus = makeGetCustomStatus();
    return (dispatch, getState) => {
        const state = getState();
        const customEmojiEnabled = isCustomEmojiEnabled(state);
        const customStatusEnabled = isCustomStatusEnabled(state);
        if (!customEmojiEnabled || !customStatusEnabled) {
            return {data: false};
        }

        const emojisToLoad = new Set();

        userIds.forEach((userId) => {
            const customStatus = getCustomStatus(state, userId);
            if (!customStatus || !customStatus.emoji) {
                return;
            }

            emojisToLoad.add(customStatus.emoji);
        });

        return dispatch(loadCustomEmojisIfNeeded(Array.from(emojisToLoad)));
    };
}

export function loadCustomEmojisForRecentCustomStatuses() {
    return (dispatch, getState) => {
        const state = getState();
        const customEmojiEnabled = isCustomEmojiEnabled(state);
        const customStatusEnabled = isCustomStatusEnabled(state);
        if (!customEmojiEnabled || !customStatusEnabled) {
            return {data: false};
        }

        const recentCustomStatusesValue = get(state, ReduxPreferences.CATEGORY_CUSTOM_STATUS, ReduxPreferences.NAME_RECENT_CUSTOM_STATUSES);
        if (!recentCustomStatusesValue) {
            return {data: false};
        }

        const recentCustomStatuses = JSON.parse(recentCustomStatusesValue);
        const emojisToLoad = new Set();

        for (const customStatus of recentCustomStatuses) {
            if (!customStatus || !customStatus.emoji) {
                continue;
            }

            emojisToLoad.add(customStatus.emoji);
        }

        return dispatch(loadCustomEmojisIfNeeded(Array.from(emojisToLoad)));
    };
}

export function loadCustomEmojisIfNeeded(emojis) {
    return (dispatch, getState) => {
        if (!emojis || emojis.length === 0) {
            return {data: false};
        }

        const state = getState();
        const customEmojiEnabled = isCustomEmojiEnabled(state);
        if (!customEmojiEnabled) {
            return {data: false};
        }

        const systemEmojis = EmojiIndicesByAlias;
        const customEmojisByName = selectCustomEmojisByName(state);
        const nonExistentCustomEmoji = state.entities.emojis.nonExistentEmoji;
        const emojisToLoad = [];

        emojis.forEach((emoji) => {
            if (!emoji) {
                return;
            }

            if (systemEmojis.has(emoji)) {
                // It's a system emoji, no need to fetch
                return;
            }

            if (nonExistentCustomEmoji.has(emoji)) {
                // We've previously confirmed this is not a custom emoji
                return;
            }

            if (customEmojisByName.has(emoji)) {
                // We have the emoji, no need to fetch
                return;
            }

            emojisToLoad.push(emoji);
        });

        return dispatch(EmojiActions.getCustomEmojisByName(emojisToLoad));
    };
}

export function loadCustomStatusEmojisForPostList(posts) {
    return (dispatch) => {
        if (!posts || posts.length === 0) {
            return {data: false};
        }

        const userIds = new Set();
        Object.keys(posts).forEach((postId) => {
            const post = posts[postId];
            if (post.user_id) {
                userIds.add(post.user_id);
            }
        });
        return dispatch(loadCustomEmojisForCustomStatusesByUserIds(userIds));
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
