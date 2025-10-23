// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import WithTooltip from '@mattermost/design-system/src/components/primitives/with_tooltip';

import {useEmojiImageUrl} from 'utils/emoji_utils';

export interface Props {
    children: React.ReactNode;
    name: string;
    imageUrl: string;
}

const PostEmoji = ({children, name, imageUrl}: Props) => {
    const emojiText = `:${name}:`;
    const emojiImageUrl = useEmojiImageUrl(name);
    const backgroundImageUrl = `url(${imageUrl})`;

    if (!imageUrl) {
        return <>{children}</>;
    }

    return (
        <WithTooltip
            title={emojiText}
            emoji={name}
            emojiImageUrl={emojiImageUrl}
            isEmojiLarge={true}
        >
            <span
                className='emoticon'
                data-testid={`postEmoji.${emojiText}`}
                style={{backgroundImage: backgroundImageUrl}}
                aria-label={emojiText}
            >
                {children}
            </span>
        </WithTooltip>
    );
};

export default React.memo(PostEmoji);
