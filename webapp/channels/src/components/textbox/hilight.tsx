// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Preferences} from 'mattermost-redux/constants';

/**
 * Renders the mention overlay for the text box.
 * @param textbox - The text box element.
 * @param mentionHighlights - The array of mention highlights.
 * @param displayValue - The current display value.
 * @returns The JSX element for the mention overlay.
 */
export const renderMentionOverlay = (
    textbox: HTMLTextAreaElement | null,
    mentionHighlights: Array<{start: number; end: number; username: string}>,
    displayValue: string,
): JSX.Element | null => {
    if (!textbox || mentionHighlights.length === 0) {
        return null;
    }

    const computedStyle = window.getComputedStyle(textbox);
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
