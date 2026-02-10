// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useRef} from 'react';
import styled from 'styled-components';

import type {ChannelBookmark} from '@mattermost/types/channel_bookmarks';

import BookmarkIcon from './bookmark_icon';

interface BookmarkMeasureItemProps {
    id: string;
    bookmark: ChannelBookmark;
    onMount: (id: string, element: HTMLElement | null) => void;
}

/**
 * Lightweight measurement-only component that matches the visual width
 * of a bar bookmark chip but has zero hooks/interactivity.
 * Used for hidden overflow items that need width measurement.
 */
function BookmarkMeasureItem({id, bookmark, onMount}: BookmarkMeasureItemProps) {
    const elementRef = useRef<HTMLDivElement>(null);

    // Report element on mount
    useEffect(() => {
        onMount(id, elementRef.current);
        return () => {
            onMount(id, null);
        };
    }, [id, onMount]);

    // Re-report on display_name change (affects width)
    useEffect(() => {
        if (elementRef.current) {
            onMount(id, elementRef.current);
        }
    }, [bookmark.display_name, id, onMount]);

    // Memoize icon to avoid unnecessary re-renders
    const icon = useCallback(() => (
        <BookmarkIcon
            type={bookmark.type}
            emoji={bookmark.emoji}
            imageUrl={bookmark.image_url}
        />
    ), [bookmark.type, bookmark.emoji, bookmark.image_url]);

    return (
        <MeasureChip
            ref={elementRef}
            data-testid={`bookmark-measure-${id}`}
        >
            <MeasureContent>
                {icon()}
                <Label>{bookmark.display_name}</Label>
            </MeasureContent>
        </MeasureChip>
    );
}

export default BookmarkMeasureItem;

const MeasureChip = styled.div`
    position: absolute;
    visibility: hidden;
    pointer-events: none;
    flex-shrink: 0;
    min-width: 5rem;
    max-width: 25rem;
`;

const MeasureContent = styled.div`
    display: flex;
    padding: 0 12px 0 6px;
    gap: 5px;
    font-family: Open Sans;
    font-size: 12px;
    font-weight: 600;
    line-height: 16px;
`;

const Label = styled.span`
    white-space: nowrap;
    padding: 4px 0;
    text-overflow: ellipsis;
    overflow: hidden;
`;
