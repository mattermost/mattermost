// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {CustomEmoji} from '@mattermost/types/emojis';

import {EmojiTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import {General, Emoji} from 'mattermost-redux/constants';
import {getShouldFetchEmojiByName} from 'mattermost-redux/selectors/entities/emojis';
import type {ActionFunc, ActionFuncAsync} from 'mattermost-redux/types/actions';
import {parseEmojiNamesFromText} from 'mattermost-redux/utils/emoji_utils';

import {logError} from './errors';
import {bindClientFunc, forceLogoutIfNecessary} from './helpers';
import {getProfilesByIds} from './users';

export let systemEmojis: Set<string> = new Set();
export function setSystemEmojis(emojis: Set<string>) {
    systemEmojis = emojis;
}

// HARRISON TODO figure out where to put the fetchEmojisByName saga

export function createCustomEmoji(emoji: any, image: any) {
    return bindClientFunc({
        clientFunc: Client4.createCustomEmoji,
        onSuccess: EmojiTypes.RECEIVED_CUSTOM_EMOJI,
        params: [
            emoji,
            image,
        ],
    });
}

export function getCustomEmoji(emojiId: string) {
    console.log('HARRISON getCustomEmoji', emojiId);

    return bindClientFunc({
        clientFunc: Client4.getCustomEmoji,
        onSuccess: EmojiTypes.RECEIVED_CUSTOM_EMOJI,
        params: [
            emojiId,
        ],
    });
}

export function fetchCustomEmojiByName(name: string) {
    return {
        type: EmojiTypes.FETCH_EMOJI_BY_NAME,
        name,
    };
}

export function fetchEmojisByNameIfNeeded(names: string[]): ActionFunc {
    return (dispatch, getState) => {
        const state = getState();

        const filteredNames = names.filter((name) => getShouldFetchEmojiByName(state, name));

        if (filteredNames.length === 0) {
            return {data: true};
        }

        dispatch(fetchCustomEmojisByName(filteredNames));

        return {data: true};
    };
}

function fetchCustomEmojisByName(names: string[]) {
    return {
        type: EmojiTypes.FETCH_EMOJIS_BY_NAME,
        names,
    };
}

export function getCustomEmojisInText(text: string): ActionFunc {
    return (dispatch) => {
        if (!text) {
            return {data: true};
        }

        const emojisToLoad = parseEmojiNamesFromText(text);

        dispatch(fetchCustomEmojisByName(Array.from(emojisToLoad)));

        return {data: true};
    };
}

export function getCustomEmojis(
    page = 0,
    perPage: number = General.PAGE_SIZE_DEFAULT,
    sort: string = Emoji.SORT_BY_NAME,
    loadUsers = false,
): ActionFuncAsync<CustomEmoji[]> {
    return async (dispatch, getState) => {
        return {data: false};
        let data;
        try {
            data = await Client4.getCustomEmojis(page, perPage, sort);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);

            dispatch(logError(error));
            return {error};
        }

        if (loadUsers) {
            dispatch(loadProfilesForCustomEmojis(data));
        }

        dispatch({
            type: EmojiTypes.RECEIVED_CUSTOM_EMOJIS,
            data,
        });

        return {data};
    };
}

export function loadProfilesForCustomEmojis(emojis: CustomEmoji[]): ActionFuncAsync {
    return async (dispatch, getState) => {
        const usersToLoad: Record<string, boolean> = {};
        emojis.forEach((emoji: CustomEmoji) => {
            if (!getState().entities.users.profiles[emoji.creator_id]) {
                usersToLoad[emoji.creator_id] = true;
            }
        });

        const userIds = Object.keys(usersToLoad);

        if (userIds.length > 0) {
            await dispatch(getProfilesByIds(userIds));
        }

        return {data: true};
    };
}

export function deleteCustomEmoji(emojiId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        try {
            await Client4.deleteCustomEmoji(emojiId);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);

            dispatch(logError(error));
            return {error};
        }

        dispatch({
            type: EmojiTypes.DELETED_CUSTOM_EMOJI,
            data: {id: emojiId},
        });

        return {data: true};
    };
}

export function searchCustomEmojis(term: string, options: any = {}, loadUsers = false): ActionFuncAsync<CustomEmoji[]> {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.searchCustomEmoji(term, options);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);

            dispatch(logError(error));
            return {error};
        }

        if (loadUsers) {
            dispatch(loadProfilesForCustomEmojis(data));
        }

        dispatch({
            type: EmojiTypes.RECEIVED_CUSTOM_EMOJIS,
            data,
        });

        return {data};
    };
}

export function autocompleteCustomEmojis(name: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.autocompleteCustomEmoji(name);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);

            dispatch(logError(error));
            return {error};
        }

        dispatch({
            type: EmojiTypes.RECEIVED_CUSTOM_EMOJIS,
            data,
        });

        return {data};
    };
}
