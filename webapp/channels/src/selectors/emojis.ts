// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getCustomEmojisByName} from 'mattermost-redux/selectors/entities/emojis';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {get} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {Preferences} from 'utils/constants';
import {EmojiIndicesByAlias, Emojis} from 'utils/emoji';
import EmojiMap from 'utils/emoji_map';
import {convertEmojiSkinTone} from 'utils/emoji_utils';

import type {RecentEmojiData} from '@mattermost/types/emojis';
import type {GlobalState} from 'types/store';

export const getEmojiMap = createSelector(
    'getEmojiMap',
    getCustomEmojisByName,
    (customEmojisByName) => {
        return new EmojiMap(customEmojisByName);
    },
);

export const getShortcutReactToLastPostEmittedFrom = (state: GlobalState) =>
    state.views.emoji.shortcutReactToLastPostEmittedFrom;

export const getRecentEmojisData = createSelector(
    'getRecentEmojisData',
    (state: GlobalState) => {
        return get(
            state,
            Preferences.RECENT_EMOJIS,
            getCurrentUserId(state),
            '[]',
        );
    },
    getUserSkinTone,
    (recentEmojis: string, userSkinTone: string) => {
        if (!recentEmojis) {
            return [];
        }

        const parsedEmojiData: RecentEmojiData[] = JSON.parse(recentEmojis);
        return normalizeRecentEmojisData(parsedEmojiData, userSkinTone);
    },
);

export function normalizeRecentEmojisData(data: RecentEmojiData[], userSkinTone: string) {
    const usageCounts = new Map<string, number>();

    for (const recentEmoji of data) {
        const emojiIndex = EmojiIndicesByAlias.get(recentEmoji.name) ?? -1;
        const systemEmoji = Emojis[emojiIndex];

        let normalizedName;
        if (systemEmoji) {
            // This is a system emoji, so we may need to change its skin tone
            normalizedName = convertEmojiSkinTone(systemEmoji, userSkinTone).short_name;
        } else {
            // This is a custom emoji, so its name will never change
            normalizedName = recentEmoji.name;
        }

        // Dedupe and sum up the usage counts of any duplicated entries
        const currentCount = usageCounts.get(normalizedName) ?? 0;
        usageCounts.set(normalizedName, currentCount + recentEmoji.usageCount);
    }

    const normalizedData = [];
    for (const [name, usageCount] of usageCounts.entries()) {
        normalizedData.push({name, usageCount});
    }

    // Sort emojis by count in the ascending order, matching addRecentEmoji
    normalizedData.sort((emojiA: RecentEmojiData, emojiB: RecentEmojiData) => emojiA.usageCount - emojiB.usageCount);

    return normalizedData;
}

export const getRecentEmojisNames = createSelector(
    'getRecentEmojisNames',
    getRecentEmojisData,
    (recentEmojisData: RecentEmojiData[]) => {
        return recentEmojisData.map((emoji) => emoji.name);
    },
);

export function getUserSkinTone(state: GlobalState): string {
    return get(state, Preferences.CATEGORY_EMOJI, Preferences.EMOJI_SKINTONE, 'default');
}

export function isCustomEmojiEnabled(state: GlobalState) {
    const config = getConfig(state);
    return config && config.EnableCustomEmoji === 'true';
}

export const getOneClickReactionEmojis = createSelector(
    'getOneClickReactionEmojis',
    getEmojiMap,
    getRecentEmojisNames,
    (emojiMap, recentEmojis: string[]) => {
        if (recentEmojis.length === 0) {
            return [];
        }

        return (recentEmojis).
            map((recentEmoji) => emojiMap.get(recentEmoji)).
            filter(isDefined).
            slice(-3).
            reverse();
    },
);

function isDefined<T>(t: T | undefined): t is T {
    return Boolean(t);
}
