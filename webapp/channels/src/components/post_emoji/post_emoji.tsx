// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

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
        <span
            alt={emojiText}
            className='emoticon'
            title={emojiText}
            style={{backgroundImage: backgroundImageUrl}}
        >
            {emojiText}
        </span>
    );
};

export default React.memo(PostEmoji);
