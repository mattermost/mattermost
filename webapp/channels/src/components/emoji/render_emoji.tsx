// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MouseEvent, KeyboardEvent} from 'react';
import {useSelector} from 'react-redux';

import {Emoji} from '@mattermost/shared/components/emoji';

import {getEmojiMap} from 'selectors/emojis';

import type {GlobalState} from 'types/store';

interface ComponentProps {
    emojiName: string;
    size?: number;
    emojiStyle?: React.CSSProperties;
    onClick?: (event: MouseEvent<HTMLSpanElement> | KeyboardEvent<HTMLSpanElement>) => void;
}

const RenderEmoji = ({
    emojiName = '',
    emojiStyle,
    size,
    onClick,
}: ComponentProps) => {
    const emojiMap = useSelector((state: GlobalState) => getEmojiMap(state));

    if (!emojiName) {
        return null;
    }

    const emojiFromMap = emojiMap.get(emojiName);

    return (
        <Emoji
            emoji={emojiFromMap}
            emojiStyle={emojiStyle}
            size={size}
            onClick={onClick}
        />
    );
};

export default React.memo(RenderEmoji);
