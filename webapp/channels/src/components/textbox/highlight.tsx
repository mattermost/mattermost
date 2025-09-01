// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef, useState} from 'react';

import {Preferences} from 'mattermost-redux/constants';

/**
 * Mention overlay component that follows textarea scroll
 */
const MentionOverlay: React.FC<{
    textarea: HTMLTextAreaElement;
    mentionHighlights: Array<{start: number; end: number; username: string}>;
    displayValue: string;
}> = ({textarea, mentionHighlights, displayValue}) => {
    const overlayRef = useRef<HTMLDivElement>(null);
    const [scrollPosition, setScrollPosition] = useState({left: 0, top: 0});

    useEffect(() => {
        const overlay = overlayRef.current;
        if (!overlay || !textarea) {
            return () => {};
        }

        const computedStyle = window.getComputedStyle(textarea);
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.pointerEvents = 'none';
        overlay.style.color = 'transparent';
        overlay.style.backgroundColor = 'transparent';
        overlay.style.border = 'transparent';
        overlay.style.fontFamily = computedStyle.fontFamily;
        overlay.style.fontSize = computedStyle.fontSize;
        overlay.style.lineHeight = computedStyle.lineHeight;
        overlay.style.padding = computedStyle.padding;
        overlay.style.whiteSpace = 'pre-wrap';
        overlay.style.wordWrap = 'break-word';
        overlay.style.overflow = 'hidden';
        overlay.style.overflowX = 'hidden';
        overlay.style.overflowY = 'hidden';
        overlay.style.zIndex = '1';

        overlay.style.borderRadius = computedStyle.borderRadius;
        overlay.style.boxSizing = computedStyle.boxSizing;

        const updatePosition = () => {
            if (!textarea) {
                return;
            }

            setScrollPosition({
                left: textarea.scrollLeft,
                top: textarea.scrollTop,
            });
        };

        updatePosition();

        textarea.addEventListener('scroll', updatePosition, {passive: true});

        const handleResize = () => {
            const computedStyle = window.getComputedStyle(textarea);
            overlay.style.fontFamily = computedStyle.fontFamily;
            overlay.style.fontSize = computedStyle.fontSize;
            overlay.style.lineHeight = computedStyle.lineHeight;
            overlay.style.padding = computedStyle.padding;
            updatePosition();
        };

        window.addEventListener('resize', handleResize, {passive: true});

        let resizeObserver: ResizeObserver | null = null;
        if (window.ResizeObserver) {
            resizeObserver = new ResizeObserver(handleResize);
            resizeObserver.observe(textarea);
        }

        return () => {
            textarea.removeEventListener('scroll', updatePosition);
            window.removeEventListener('resize', handleResize);
            if (resizeObserver) {
                resizeObserver.disconnect();
            }
        };
    }, [textarea]);

    return (
        <div
            ref={overlayRef}
            className='mention-overlay'
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                pointerEvents: 'none',
            }}
        >
            <div
                style={{
                    transform: `translate(${-scrollPosition.left}px, ${-scrollPosition.top}px)`,
                }}
            >
                {renderHighlightedText(mentionHighlights, displayValue)}
            </div>
        </div>
    );
};

/**
 * Renders the mention overlay for the text box.
 * @param element - The text box element or preview div element.
 * @param mentionHighlights - The array of mention highlights.
 * @param displayValue - The current display value.
 * @returns The JSX element for the mention overlay.
 */
export const renderMentionOverlay = (
    element: HTMLTextAreaElement | HTMLDivElement | null,
    mentionHighlights: Array<{start: number; end: number; username: string}>,
    displayValue: string,
): JSX.Element | null => {
    if (!element || mentionHighlights.length === 0) {
        return null;
    }

    if (element instanceof HTMLTextAreaElement) {
        return (
            <MentionOverlay
                textarea={element}
                mentionHighlights={mentionHighlights}
                displayValue={displayValue}
            />
        );
    }

    const computedStyle = window.getComputedStyle(element);
    const overlayStyle: React.CSSProperties = {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        color: 'transparent',
        backgroundColor: 'transparent',
        border: 'transparent',
        fontFamily: computedStyle.fontFamily,
        fontSize: computedStyle.fontSize,
        lineHeight: computedStyle.lineHeight,
        padding: computedStyle.padding,
        whiteSpace: 'pre-wrap',
        wordWrap: 'break-word',
        overflow: 'hidden',
        zIndex: 1,
    };

    return (
        <div
            style={overlayStyle}
            className='mention-overlay'
        >
            {renderHighlightedText(mentionHighlights, displayValue)}
        </div>
    );
};

/**
 * Renders the highlighted text for mentions.
 * @param mentionHighlights - The array of mention highlights.
 * @param displayValue - The current display value.
 * @returns The JSX elements for the highlighted text.
 */
const renderHighlightedText = (mentionHighlights: Array<{start: number; end: number; username: string}>, displayValue: string) => {
    const parts: JSX.Element[] = [];
    let lastIndex = 0;

    mentionHighlights.forEach((highlight, index) => {
        if (highlight.start > lastIndex) {
            parts.push(
                <span
                    key={`text-${index}`}
                    style={{color: 'transparent'}}
                >
                    {displayValue.substring(lastIndex, highlight.start)}
                </span>,
            );
        }

        parts.push(
            <span
                key={`mention-${index}`}
                className='mention-highlight'
                style={{
                    color: Preferences.THEMES.denim.linkColor,
                }}
            >
                {displayValue.substring(highlight.start, highlight.end)}
            </span>,
        );

        lastIndex = highlight.end;
    });

    if (lastIndex < displayValue.length) {
        parts.push(
            <span
                key='text-final'
                style={{color: 'transparent'}}
            >
                {displayValue.substring(lastIndex)}
            </span>,
        );
    }

    return parts;
};
