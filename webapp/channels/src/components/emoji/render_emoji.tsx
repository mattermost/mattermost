// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import {getEmojiImageUrl} from 'mattermost-redux/utils/emoji_utils';
import {getEmojiMap} from 'selectors/emojis';

import {GlobalState} from 'types/store';

interface ComponentProps {
    emojiName: string;
    size?: number;
    emojiStyle?: React.CSSProperties;
    onClick?: () => void;
}

const RenderEmoji = ({emojiName, emojiStyle, size, onClick}: ComponentProps) => {
    const emojiMap = useSelector((state: GlobalState) => getEmojiMap(state));

    if (!emojiName) {
        return null;
    }

    const emojiFromMap = emojiMap.get(emojiName);
    if (!emojiFromMap) {
        return null;
    }
    const emojiImageUrl = getEmojiImageUrl(emojiFromMap);

    return (
        <span
            onClick={onClick}
            className='emoticon'
            alt={`:${emojiName}:`}
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
