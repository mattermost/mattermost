// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

interface PostEmojiProps {
    name: string;
    imageUrl: string;
}
declare module 'react' {
    interface HTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
        alt?: string;
    }
}

const PostEmoji = ({name, imageUrl}: PostEmojiProps): JSX.Element => {
    const emojiText = ':' + name + ':';

    if (!imageUrl) {
        return <span>{emojiText}</span>;
    }

    return (
        <span
            alt={emojiText}
            className='emoticon'
            title={emojiText}
            style={{backgroundImage: 'url(' + imageUrl + ')'}}
        >
            {emojiText}
        </span>
    );
};

export default React.memo(PostEmoji);
