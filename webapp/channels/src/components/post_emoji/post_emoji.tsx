// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';

import {getEmojiImageUrl} from 'mattermost-redux/utils/emoji_utils';

import WithTooltip from 'components/with_tooltip';

import {useEmojiByName} from 'data-layer/hooks/emojis';

interface Props {
    name: string;
}

export default function PostEmoji(props: Props) {
    const emoji = useEmojiByName(props.name);
    const emojiText = ':' + props.name + ':';

    const style = useMemo(() => {
        if (!emoji) {
            return {};
        }

        return {
            backgroundImage: 'url(' + getEmojiImageUrl(emoji) + ')',
        };
    }, [emoji]);

    if (!emoji) {
        return <>{emojiText}</>;
    }
    return (
        <WithTooltip
            id='postEmoji__tooltip'
            title={emojiText}
            emoji={props.name}
            emojiStyle='large'
            placement='top'
        >
            <span
                className='emoticon'
                style={style}
            >
                {emojiText}
            </span>
        </WithTooltip>
    );
}
