// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MouseEvent, KeyboardEvent} from 'react';

const emptyEmojiStyle = {};

interface ComponentProps {
    emojiName: string;
    emojiImageURL?: string;
    size?: number;
    emojiStyle?: React.CSSProperties;
    onClick?: (event: MouseEvent<HTMLSpanElement> | KeyboardEvent<HTMLSpanElement>) => void;
}

const RenderEmoji = ({
    emojiName = '',
    emojiImageURL,
    emojiStyle = emptyEmojiStyle,
    size = 16,
    onClick,
}: ComponentProps) => {
    if (!emojiName || !emojiImageURL) {
        return null;
    }

    return (
        <span
            onClick={onClick}
            className='emoticon'
            aria-label={`:${emojiName}:`}
            data-emoticon={emojiName}
            style={{
                backgroundImage: `url(${emojiImageURL})`,
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
