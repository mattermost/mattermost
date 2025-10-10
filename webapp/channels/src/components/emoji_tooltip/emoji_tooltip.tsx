// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useRef, useEffect} from 'react';
import type {ReactElement} from 'react';

import WithTooltip from 'components/with_tooltip';

interface Props {
    emojiName: string;
    emojiDescription?: string;
    title: string | React.ReactNode;
    hint?: string | React.ReactNode;
    children: ReactElement;
    onOpen?: () => void;
    showImmediately?: boolean;
}

const EmojiTooltip: React.FC<Props> = ({
    emojiName,
    emojiDescription,
    title,
    hint,
    children,
    onOpen,
    showImmediately = false,
}: Props) => {
    const [isEmojiVeryLarge, setIsEmojiVeryLarge] = useState(showImmediately);
    const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isTooltipOpenRef = useRef(false);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (hoverTimerRef.current) {
                clearTimeout(hoverTimerRef.current);
            }
        };
    }, []);

    const handleTooltipOpen = () => {
        isTooltipOpenRef.current = true;

        if (onOpen) {
            onOpen();
        }

        // If showImmediately is true, enlarge immediately, otherwise wait 5 seconds
        if (showImmediately) {
            setIsEmojiVeryLarge(true);
        } else {
            hoverTimerRef.current = setTimeout(() => {
                if (isTooltipOpenRef.current) {
                    setIsEmojiVeryLarge(true);
                }
            }, 5000);
        }
    };

    // Monitor when children are no longer hovered to reset state
    const wrappedChildren = React.cloneElement(children, {
        onMouseLeave: (...args: any[]) => {
            // Reset state when mouse leaves
            isTooltipOpenRef.current = false;
            if (hoverTimerRef.current) {
                clearTimeout(hoverTimerRef.current);
                hoverTimerRef.current = null;
            }
            // Only reset if not showing immediately
            if (!showImmediately) {
                setIsEmojiVeryLarge(false);
            }

            // Call original onMouseLeave if it exists
            if (children.props.onMouseLeave) {
                children.props.onMouseLeave(...args);
            }
        },
    });

    // Create custom title that includes description when very large
    const tooltipTitle = isEmojiVeryLarge && emojiDescription ? (
        <div className='emoji-tooltip__content'>
            <div className='emoji-tooltip__title'>{title}</div>
            <div className={showImmediately ? 'emoji-tooltip__description emoji-tooltip__description--no-fade' : 'emoji-tooltip__description'}>
                {emojiDescription}
            </div>
        </div>
    ) : title;

    return (
        <WithTooltip
            title={tooltipTitle}
            emoji={emojiName}
            isEmojiLarge={true}
            hint={hint}
            onOpen={handleTooltipOpen}
            className={isEmojiVeryLarge ? 'emoji-tooltip--very-large' : undefined}
        >
            {wrappedChildren}
        </WithTooltip>
    );
};

export default EmojiTooltip;
