// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

export interface Props {
    children: React.ReactNode;
    name: string;
    imageUrl: string;
}
declare module 'react' {
    interface HTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
        alt?: string;
    }
}

const PostEmoji = ({children, name, imageUrl}: Props) => {
    const emojiText = `:${name}:`;
    const backgroundImageUrl = `url(${imageUrl})`;

    if (!imageUrl) {
        return <>{children}</>;
    }

    return (
        <span
            alt={emojiText}
            className='emoticon'
            title={emojiText}
            style={{backgroundImage: backgroundImageUrl}}
        >
            {children}
        </span>
    );
};

export default React.memo(PostEmoji);
