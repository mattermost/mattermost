// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef} from 'react';

import WithTooltip from 'components/with_tooltip';

export interface Props {
    children: React.ReactNode;
    name: string;
    imageUrl: string;
    autoplayGifsAndEmojis: string;
}

const PostEmoji = ({children, name, imageUrl, autoplayGifsAndEmojis}: Props) => {
    const emojiText = `:${name}:`;
    const backgroundImageUrl = `url(${imageUrl})`;

    const staticAnimatedEmojiRef: React.RefObject<HTMLCanvasElement> = useRef(null);
    const imageRef: React.RefObject<HTMLImageElement> = useRef(null);

    if (!imageUrl) {
        return <>{children}</>;
    }

    const isAnimatedEmoji = !(/\/static\//).test(imageUrl);
    const shouldShowStaticAnimatedEmoji = autoplayGifsAndEmojis === 'false' && isAnimatedEmoji;

    const emoticonWidthAndHeight = 32;

    const handleImageLoad = () => {
        if (isAnimatedEmoji && staticAnimatedEmojiRef.current && imageRef.current) {
            const context = staticAnimatedEmojiRef.current.getContext('2d');

            // 32px is the height and width specified in the 'emoticon' CSS rule.
            context?.drawImage(imageRef.current, 0, 0, emoticonWidthAndHeight, emoticonWidthAndHeight);
        }
    };

    return (
        <WithTooltip
            title={emojiText}
            emoji={name}
            isEmojiLarge={true}
        >
            {
                shouldShowStaticAnimatedEmoji ?
                    <span data-testid='static-animated-post-emoji-container'>
                        <img
                            ref={imageRef}
                            src={imageUrl}
                            data-testid='canvas-image-reference'
                            style={{display: 'none'}}
                            onLoad={handleImageLoad}
                        />
                        <canvas
                            ref={staticAnimatedEmojiRef}
                            id='static-animated-emoji'

                            // 32px is the height and width specified in the 'emoticon' CSS rule.
                            width={emoticonWidthAndHeight}
                            height={emoticonWidthAndHeight}
                        >
                            {emojiText}
                        </canvas>
                    </span> :
                    <span
                        className='emoticon'
                        data-testid={`postEmoji.${emojiText}`}
                        style={{backgroundImage: backgroundImageUrl}}
                    >
                        {children}
                    </span>
            }
        </WithTooltip>
    );
};

export default React.memo(PostEmoji);
