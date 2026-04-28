// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {KeyboardEvent, MouseEvent} from 'react';
import React from 'react';

import {useEmojiByName} from '../../context/useEmojiByName';
import {useEmojiUrl} from '../../context/useEmojiUrl';

import './emoji.css';

const emptyEmojiStyle = {};

export interface EmojiProps {
    emojiName: string;
    size?: number;
    emojiStyle?: React.CSSProperties;

    // TODO remove this prop and move the click handler a proper button
    onClick?: (event: MouseEvent<HTMLSpanElement> | KeyboardEvent<HTMLSpanElement>) => void;
}

export function Emoji({
    emojiName,
    emojiStyle = emptyEmojiStyle,
    size = 16,
    onClick,
}: EmojiProps) {
    const emoji = useEmojiByName(emojiName);
    const emojiImageUrl = useEmojiUrl(emoji);

    if (!emoji || !emojiImageUrl) {
        return null;
    }

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
