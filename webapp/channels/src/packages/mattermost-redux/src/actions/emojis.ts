// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {CustomEmoji} from '@mattermost/types/emojis';

import {EmojiTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import {getCustomEmojisByName as selectCustomEmojisByName} from 'mattermost-redux/selectors/entities/emojis';
import type {GetStateFunc, DispatchFunc, ActionFunc, ActionResult} from 'mattermost-redux/types/actions';
import {parseNeededCustomEmojisFromText} from 'mattermost-redux/utils/emoji_utils';

import {logError} from './errors';
import {bindClientFunc, forceLogoutIfNecessary} from './helpers';
import {getProfilesByIds} from './users';

import {General, Emoji} from '../constants';

export let systemEmojis: Set<string> = new Set();
export function setSystemEmojis(emojis: Set<string>) {
    systemEmojis = emojis;
}

export function createCustomEmoji(emoji: any, image: any): ActionFunc {
    return bindClientFunc({
        clientFunc: Client4.createCustomEmoji,
        onSuccess: EmojiTypes.RECEIVED_CUSTOM_EMOJI,
        params: [
            emoji,
            image,
        ],
    });
}

export function getCustomEmoji(emojiId: string): ActionFunc {
    return bindClientFunc({
        clientFunc: Client4.getCustomEmoji,
        onSuccess: EmojiTypes.RECEIVED_CUSTOM_EMOJI,
        params: [
            emojiId,
        ],
    });
}

export function getCustomEmojiByName(name: string): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
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

export function getCustomEmojisByName(names: string[]): ActionFunc {
    return async (dispatch: DispatchFunc) => {
        if (!names || names.length === 0) {
            return {data: true};
        }

        const promises: Array<Promise<ActionResult|ActionResult[]>> = [];
        names.forEach((name) => promises.push(dispatch(getCustomEmojiByName(name))));

        await Promise.all(promises);
        return {data: true};
    };
}

export function getCustomEmojisInText(text: string): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        if (!text) {
            return {data: true};
        }

        const state = getState();
        const nonExistentEmoji = state.entities.emojis.nonExistentEmoji;
        const customEmojisByName = selectCustomEmojisByName(state);

        const emojisToLoad = parseNeededCustomEmojisFromText(text, systemEmojis, customEmojisByName, nonExistentEmoji);

        return getCustomEmojisByName(Array.from(emojisToLoad))(dispatch, getState);
    };
}

export function getCustomEmojis(
    page = 0,
    perPage: number = General.PAGE_SIZE_DEFAULT,
    sort: string = Emoji.SORT_BY_NAME,
    loadUsers = false,
): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
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

export function loadProfilesForCustomEmojis(emojis: CustomEmoji[]): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
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

export function deleteCustomEmoji(emojiId: string): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
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

export function searchCustomEmojis(term: string, options: any = {}, loadUsers = false): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
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

export function autocompleteCustomEmojis(name: string): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
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
