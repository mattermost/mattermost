// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Emoji} from '@mattermost/types/emojis';

import {getCustomEmojisByNameBatched} from 'mattermost-redux/actions/emojis';

import {getEmojiMap} from 'selectors/emojis';

import {makeUseEntity} from './useEntity';

export const useEmoji = makeUseEntity<Emoji>({
    name: 'useEmoji',
    fetch: (userId) => getCustomEmojisByNameBatched([userId]),
    selector: (state, name) => getEmojiMap(state).get(name),

    shouldFetch: (state, name) => {
        if (getEmojiMap(state).has(name)) {
            // This is a system emoji or it's already been loaded
            return false;
        }

        if (state.entities.emojis.nonExistentEmoji.has(name)) {
            // We've already tried to load this emoji before
            return false;
        }

        return true;
    },
});
