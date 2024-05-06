// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import WithTooltip from 'components/with_tooltip';

interface Props {
    name: string;
    imageUrl: string;
}
declare module 'react' {
    interface HTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
        alt?: string;
    }
}

const PostEmoji = ({name, imageUrl}: Props) => {
    const emojiText = `:${name}:`;
    const backgroundImageUrl = `url(${imageUrl})`;

    if (!imageUrl) {
        return <>{emojiText}</>;
    }

    return (
        <WithTooltip
            id='postEmoji__tooltip'
            title={emojiText}
            emoji={name}
            emojiStyle='large'
            placement='top'
        >
            <span
                alt={emojiText}
                className='emoticon'
                data-testid={`postEmoji.${emojiText}`}
                style={{backgroundImage: backgroundImageUrl}}
            >
                {emojiText}
            </span>
        </WithTooltip>
    );
};

export default React.memo(PostEmoji);
