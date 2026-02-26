// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Emoji} from '@mattermost/types/emojis';

import type {EmojiCursor} from '../types';

export interface EmojiPickerContextValue {
    cursorRowIndex: number;
    cursorEmojiId: string;
    onEmojiClick: (emoji: Emoji) => void;
    onEmojiMouseOver: (cursor: EmojiCursor) => void;
}

export const EmojiPickerContext = React.createContext<EmojiPickerContextValue>({
    cursorRowIndex: -1,
    cursorEmojiId: '',
    onEmojiClick: () => {},
    onEmojiMouseOver: () => {},
});
EmojiPickerContext.displayName = 'EmojiPickerContext';
