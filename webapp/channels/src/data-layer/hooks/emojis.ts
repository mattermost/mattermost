// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import type {SagaMiddleware} from 'redux-saga';

import {EmojiTypes} from 'mattermost-redux/action_types';

import {getEmojiMap} from 'selectors/emojis';
import {sagaMiddleware} from 'stores/redux_store';

import {fetchEmojisByName} from 'data-layer/sagas/emojis';

import type {GlobalState} from 'types/store';

export function useEmojiByName(name: string) {
    const emojiMap = useSelector((state: GlobalState) => getEmojiMap(state));
    const emoji = emojiMap.get(name);

    const dispatch = useDispatch();
    useEffect(() => {
        if (emoji) {
            return;
        }

        dispatch({
            type: EmojiTypes.FETCH_EMOJI_BY_NAME,
            name,
        });
    }, [dispatch, emoji, name]);

    return emoji;
}

(sagaMiddleware as SagaMiddleware).run(fetchEmojisByName);
