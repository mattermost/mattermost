// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {WithTooltip} from '@mattermost/shared/components/tooltip';
import {useFreezableImageUrl} from '@mattermost/shared/utils/animated_image';

export interface Props {
    children: React.ReactNode;
    name: string;
    imageUrl: string;
}

const PostEmoji = ({children, name, imageUrl}: Props) => {
    const emojiText = `:${name}:`;
    const displayUrl = useFreezableImageUrl(imageUrl);
    const backgroundImageUrl = `url(${displayUrl})`;

    if (!imageUrl) {
        return <>{children}</>;
    }

    return (
        <WithTooltip
            title={emojiText}
            emoji={name}
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
