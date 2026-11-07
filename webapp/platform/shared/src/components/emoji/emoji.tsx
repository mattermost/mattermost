// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {CSSProperties} from 'react';
import React from 'react';

import {useEmojiByName} from '../../context/useEmojiByName';
import {useEmojiUrl} from '../../context/useEmojiUrl';

import './emoji.css';

const emptyEmojiStyle = {};

export interface EmojiProps {
    emojiName: string;
    size?: number;
    emojiStyle?: CSSProperties;
}

export function Emoji({
    emojiName,
    emojiStyle = emptyEmojiStyle,
    size = 16,
}: EmojiProps) {
    const emoji = useEmojiByName(emojiName);
    const emojiImageUrl = useEmojiUrl(emoji);

    if (!emoji || !emojiImageUrl) {
        return null;
    }

    return (
        <span
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
