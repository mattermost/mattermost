// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import EmojiTooltip from 'components/emoji_tooltip';

export interface Props {
    children: React.ReactNode;
    name: string;
    imageUrl: string;
    emojiDescription?: string;
}

const PostEmoji = ({children, name, imageUrl, emojiDescription}: Props) => {
    const emojiText = `:${name}:`;
    const backgroundImageUrl = `url(${imageUrl})`;

    if (!imageUrl) {
        return <>{children}</>;
    }

    return (
        <EmojiTooltip
            emojiName={name}
            emojiDescription={emojiDescription}
            title={emojiText}
        >
            <span
                className='emoticon'
                data-testid={`postEmoji.${emojiText}`}
                style={{backgroundImage: backgroundImageUrl}}
                aria-label={emojiText}
            >
                {children}
            </span>
        </EmojiTooltip>
    );
};

export default React.memo(PostEmoji);
