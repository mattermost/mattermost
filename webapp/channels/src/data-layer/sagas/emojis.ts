// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';
import {batchActions} from 'redux-batched-actions';
import {put, select} from 'redux-saga/effects';

import type {CustomEmoji} from '@mattermost/types/emojis';

import {EmojiTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';

import {getEmojiMap} from 'selectors/emojis';

import type EmojiMap from 'utils/emoji_map';

import {batchDebounce} from './helpers';

function* doFetchEmojisByName(actions: AnyAction[]) {
    console.log('doFetchEmojisByName', actions);
    const names = new Set<string>();

    const emojiMap: EmojiMap = yield select(getEmojiMap);

    for (const action of actions) {
        if (action.type === EmojiTypes.FETCH_EMOJI_BY_NAME) {
            if (!emojiMap.has(action.name)) {
                names.add(action.name);
            }
        } else if (action.type === EmojiTypes.FETCH_EMOJIS_BY_NAME) {
            for (const name of action.names) {
                if (!emojiMap.has(name)) {
                    names.add(name);
                }
            }
        }
    }

    console.log('doFetchEmojisByName fetching ' + names.size + ' emojis', names);

    if (names.size === 0) {
        console.log('doFetchEmojisByName nothing to fetch');
        return;
    }

    const data: CustomEmoji[] = yield Client4.getCustomEmojisByNames(Array.from(names));

    const resultingActions: AnyAction[] = [{
        type: EmojiTypes.RECEIVED_CUSTOM_EMOJIS,
        data,
    }];

    console.log('doFetchEmojisByName returned ' + data.length + ' emojis');

    if (data.length < names.size) {
        // HARRISON TODO do I care enough to make this not polynomial time?
        for (const name of names) {
            let found = false;

            for (const emoji of data) {
                if (emoji.name === name) {
                    found = true;
                    break;
                }
            }

            if (!found) {
                resultingActions.push({
                    type: EmojiTypes.CUSTOM_EMOJI_DOES_NOT_EXIST,
                    data: name,
                });
            }
        }

        console.log('doFetchEmojisByName could not find ' + (names.size - data.length) + ' emojis');
    }

    yield put(resultingActions.length > 1 ? batchActions(resultingActions) : resultingActions[0]);
}

export function* fetchEmojisByName() {
    // HARRISON TODO this makes us send extra requests while
    yield batchDebounce(100, [EmojiTypes.FETCH_EMOJI_BY_NAME, EmojiTypes.FETCH_EMOJIS_BY_NAME], doFetchEmojisByName);
}

