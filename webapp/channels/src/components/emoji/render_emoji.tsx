// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MouseEvent, KeyboardEvent} from 'react';

import {getEmojiImageUrl} from 'mattermost-redux/utils/emoji_utils';

import {useEmoji} from 'components/common/hooks/useEmoji';

const emptyEmojiStyle = {};

interface ComponentProps {
    emojiName: string;
    size?: number;
    emojiStyle?: React.CSSProperties;
    onClick?: (event: MouseEvent<HTMLSpanElement> | KeyboardEvent<HTMLSpanElement>) => void;
}

const RenderEmoji = ({
    emojiName = '',
    emojiStyle = emptyEmojiStyle,
    size = 16,
    onClick,
}: ComponentProps) => {
    const emoji = useEmoji(emojiName);
    if (!emoji) {
        return null;
    }

    const emojiImageUrl = getEmojiImageUrl(emoji);

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
};

export default React.memo(RenderEmoji);
