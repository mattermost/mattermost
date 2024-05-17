// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {getEmojiImageUrl} from 'mattermost-redux/utils/emoji_utils';

import {useEmojiByName} from 'data-layer/hooks/emojis';

interface ComponentProps {
    emojiName: string;
    size?: number;
    emojiStyle?: React.CSSProperties;
    onClick?: () => void;
}

const RenderEmoji = ({emojiName, emojiStyle, size, onClick}: ComponentProps) => {
    const emoji = useEmojiByName(emojiName);

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

RenderEmoji.defaultProps = {
    emoji: '',
    emojiStyle: {},
    size: 16,
};

export default React.memo(RenderEmoji);
