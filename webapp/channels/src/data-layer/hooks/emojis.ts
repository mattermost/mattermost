// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect} from 'react';
import {useSelector} from 'react-redux';

import {getCustomEmojisByName} from 'mattermost-redux/actions/emojis';
import type {DispatchFunc} from 'mattermost-redux/types/actions';

import {getEmojiMap} from 'selectors/emojis';
import store from 'stores/redux_store';

import type {GlobalState} from 'types/store';

export function useEmojiByName(name: string) {
    const emojiMap = useSelector((state: GlobalState) => getEmojiMap(state));
    const emoji = emojiMap.get(name);

    // HARRISON TODO replace this with redux-sagas
    useEffect(() => {
        // HARRISON TODO don't try to load emojis that we already know don't exist
        if (emoji/* || nonExistentEmojis.has(name)*/) {
            return;
        }

        emojisToLoad.add(name);

        console.log('LOADING', name);
        if (!emojiLoadTimeout) {
            emojiLoadTimeout = setTimeout(loadEmojis, 5000);
        }
    }, [name]);

    return emoji;
}

let emojiLoadTimeout: NodeJS.Timeout | undefined;
const emojisToLoad = new Set<string>();

// const nonExistentEmojis = new Set<string>();

function loadEmojis() {
    console.log('timeout fired', emojisToLoad);
    const emojis = new Set(emojisToLoad);

    // These should be done at the same time, before entering the thunk, to ensure we're never waiting on a timeout that already happened
    emojisToLoad.clear();
    emojiLoadTimeout = undefined;

    store.dispatch((dispatch: DispatchFunc) => {
        console.log('loading', [...emojis]);
        dispatch(getCustomEmojisByName([...emojis]));
    });
}
