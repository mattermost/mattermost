// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';
import {batchActions} from 'redux-batched-actions';

import type {CustomEmoji} from '@mattermost/types/emojis';
import type {GlobalState} from '@mattermost/types/store';

import {EmojiTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import {getCustomEmojisByName as selectCustomEmojisByName} from 'mattermost-redux/selectors/entities/emojis';
import type {ActionFuncAsync} from 'mattermost-redux/types/actions';
import {parseEmojiNamesFromText} from 'mattermost-redux/utils/emoji_utils';

import {logError} from './errors';
import {bindClientFunc, forceLogoutIfNecessary} from './helpers';
import {getProfilesByIds} from './users';

import {General, Emoji} from '../constants';

export let systemEmojis: Set<string> = new Set();
export function setSystemEmojis(emojis: Set<string>) {
    systemEmojis = emojis;
}

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
    return bindClientFunc({
        clientFunc: Client4.getCustomEmoji,
        onSuccess: EmojiTypes.RECEIVED_CUSTOM_EMOJI,
        params: [
            emojiId,
        ],
    });
}

export function getCustomEmojiByName(name: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        let data;

        try {
            data = await Client4.getCustomEmojiByName(name);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);

            if (error.status_code === 404) {
                dispatch({type: EmojiTypes.CUSTOM_EMOJI_DOES_NOT_EXIST, data: name});
            } else {
                dispatch(logError(error));
            }

            return {error};
        }

        dispatch({
            type: EmojiTypes.RECEIVED_CUSTOM_EMOJI,
            data,
        });

        return {data};
    };
}

export function getCustomEmojisByName(names: string[]): ActionFuncAsync {
    return async (dispatch, getState) => {
        const neededNames = filterNeededCustomEmojis(getState(), names);

        if (neededNames.length === 0) {
            return {data: true};
        }

        // If necessary, split up the list of names into batches based on api4.GetEmojisByNamesMax on the server
        const batchSize = 200;

        const batches = [];
        for (let i = 0; i < names.length; i += batchSize) {
            batches.push(neededNames.slice(i, i + batchSize));
        }

        let results;
        try {
            results = await Promise.all(batches.map((batch) => {
                return Client4.getCustomEmojisByNames(batch);
            }));
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        const data = results.flat();
        const actions: AnyAction[] = [{
            type: EmojiTypes.RECEIVED_CUSTOM_EMOJIS,
            data,
        }];

        if (data.length !== neededNames.length) {
            const foundNames = new Set(data.map((emoji) => emoji.name));

            for (const name of neededNames) {
                if (foundNames.has(name)) {
                    continue;
                }

                actions.push({
                    type: EmojiTypes.CUSTOM_EMOJI_DOES_NOT_EXIST,
                    data: name,
                });
            }
        }

        dispatch(actions.length > 1 ? batchActions(actions) : actions[0]);

        return {data: true};
    };
}

function filterNeededCustomEmojis(state: GlobalState, names: string[]) {
    const nonExistentEmoji = state.entities.emojis.nonExistentEmoji;
    const customEmojisByName = selectCustomEmojisByName(state);

    return names.filter((name) => {
        return !systemEmojis.has(name) && !nonExistentEmoji.has(name) && !customEmojisByName.has(name);
    });
}

export function getCustomEmojisInText(text: string): ActionFuncAsync {
    return async (dispatch) => {
        if (!text) {
            return {data: true};
        }

        return dispatch(getCustomEmojisByName(parseEmojiNamesFromText(text)));
    };
}

export function getCustomEmojis(
    page = 0,
    perPage: number = General.PAGE_SIZE_DEFAULT,
    sort: string = Emoji.SORT_BY_NAME,
    loadUsers = false,
): ActionFuncAsync<CustomEmoji[]> {
    return async (dispatch, getState) => {
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
