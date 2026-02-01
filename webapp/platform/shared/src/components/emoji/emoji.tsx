// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/*
Notes:
- To avoid having the shared package know about mattermost-redux yet, I changed the props of this to take an Emoji
  instead of taking the emoji's name and a URL because that caused problems when Maria did the same migration during
  the build event.
- While I tried to limit the other changes, I changed the way that the component is defined to use a plain function
  to ensure it has a display name, its props to use an interface since that seems like it's considered a best practice,
  and I removed memo from this component since it's simple and because neither RN or react-spectrum use it.
*/

import type {KeyboardEvent, MouseEvent} from 'react';
import React from 'react';

import {isSystemEmoji, type Emoji as EmojiType} from '@mattermost/types/emojis';

import {useEmojiUrl} from '../../context/useEmojiUrl';

import './emoji.css';

const emptyEmojiStyle = {};

export interface EmojiProps {
    emoji?: EmojiType;
    size?: number;
    emojiStyle?: React.CSSProperties;

    // TODO remove this prop and move the click handler a proper button
    onClick?: (event: MouseEvent<HTMLSpanElement> | KeyboardEvent<HTMLSpanElement>) => void;
}

export function Emoji({
    emoji,
    emojiStyle = emptyEmojiStyle,
    size = 16,
    onClick,
}: EmojiProps) {
    const emojiImageUrl = useEmojiUrl(emoji);

    if (!emoji || !emojiImageUrl) {
        return null;
    }

    // TODO this duplicates getEmojiName from mattermost-redux/utils/emoji_utils
    const emojiName = isSystemEmoji(emoji) ? emoji.short_name : emoji.name;

    return (
        <span
            onClick={onClick}
            className='emoticon'
            aria-label={`:${emojiName}:`}
            data-emoticon={emojiName}
            style={{
                backgroundImage: `url(${emojiImageUrl})`,
                backgroundSize: 'contain',
                height: size,
                width: size,
                maxHeight: size,
                maxWidth: size,
                minHeight: size,
                minWidth: size,
                overflow: 'hidden',
                ...emojiStyle,
            }}
        />
    );
}
