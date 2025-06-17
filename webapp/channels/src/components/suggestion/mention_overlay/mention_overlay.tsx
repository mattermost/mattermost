// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ReactNode} from 'react';

import AtMention from 'components/at_mention';

import {getMentionRanges} from 'utils/mention_utils';
import type {MentionRange} from 'utils/mention_utils';

export type Props = {
    value: string;
    className?: string;
};

type ParsedMentionPart = {
    type: 'text' | 'mention';
    content: string;
    range?: MentionRange;
};

/**
 * MentionOverlay renders text with highlighted mentions using AtMention components.
 * This component parses the input text and replaces @mentions with interactive AtMention components
 * while preserving other text as-is.
 * 
 * Based on the patterns established in at_mention_provider for consistent mention handling.
 */
const MentionOverlay = React.memo<Props>(({value, className}) => {
    if (!value) {
        return null;
    }

    const parseMentionText = (text: string): ParsedMentionPart[] => {
        if (!text || typeof text !== 'string') {
            return [];
        }

        let mentionRanges: MentionRange[] = [];
        try {
            mentionRanges = getMentionRanges(text);
        } catch (error) {
            // Fallback to plain text rendering on parsing errors
            console.warn('Error parsing mention ranges:', error);
            return [{type: 'text', content: text}];
        }

        if (mentionRanges.length === 0) {
            return [{type: 'text', content: text}];
        }

        const parts: ParsedMentionPart[] = [];
        let lastIndex = 0;

        for (const range of mentionRanges) {
            // Add text before the mention
            if (range.start > lastIndex) {
                parts.push({
                    type: 'text',
                    content: text.substring(lastIndex, range.start),
                });
            }

            // Add the mention part
            parts.push({
                type: 'mention',
                content: range.text.substring(1), // Remove @ symbol
                range,
            });

            lastIndex = range.end;
        }

        // Add remaining text after the last mention
        if (lastIndex < text.length) {
            parts.push({
                type: 'text',
                content: text.substring(lastIndex),
            });
        }

        return parts;
    };

    const renderParts = (parts: ParsedMentionPart[]): ReactNode[] => {
        return parts.map((part, index) => {
            if (part.type === 'mention') {
                return (
                    <AtMention
                        key={`mention-${part.range?.start ?? index}`}
                        mentionName={part.content}
                        displayMode='fullname'
                    />
                );
            }

            // Return text parts with a key for React reconciliation
            return (
                <React.Fragment key={`text-${index}`}>
                    {part.content}
                </React.Fragment>
            );
        });
    };

    try {
        const parsedParts = parseMentionText(value);
        const renderedParts = renderParts(parsedParts);

        return (
            <div className={`suggestion-box-mention-overlay ${className || ''}`}>
                {renderedParts.length > 0 ? renderedParts : value}
            </div>
        );
    } catch (error) {
        // Fallback to plain text rendering on any rendering errors
        console.warn('Error rendering mention overlay:', error);
        return (
            <div className={`suggestion-box-mention-overlay ${className || ''}`}>
                {value}
            </div>
        );
    }
});

MentionOverlay.displayName = 'MentionOverlay';

export default MentionOverlay;
