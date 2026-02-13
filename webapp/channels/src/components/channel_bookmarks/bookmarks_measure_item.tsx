// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef, useEffect} from 'react';
import styled from 'styled-components';

import type {ChannelBookmark} from '@mattermost/types/channel_bookmarks';

import BookmarkIcon from './bookmark_icon';

interface BookmarkMeasureItemProps {
    id: string;
    bookmark: ChannelBookmark;
    onMount: (id: string, element: HTMLElement | null) => void;
}

const HiddenContainer = styled.div`
    position: absolute;
    visibility: hidden;
    pointer-events: none;
    flex-shrink: 0;
    min-width: 5rem;
    max-width: 25rem;
`;

const InnerContent = styled.div`
    display: flex;
    padding: 0 12px 0 6px;
    gap: 5px;
    font-family: 'Open Sans', sans-serif;
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

const BookmarkMeasureItem: React.FC<BookmarkMeasureItemProps> = ({
    id,
    bookmark,
    onMount,
}) => {
    const elementRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        onMount(id, elementRef.current);

        return () => {
            onMount(id, null);
        };
    }, [id, onMount, bookmark.display_name]);

    return (
        <HiddenContainer ref={elementRef}>
            <InnerContent>
                <BookmarkIcon
                    type={bookmark.type}
                    emoji={bookmark.emoji}
                    imageUrl={bookmark.image_url}
                />
                <Label>{bookmark.display_name}</Label>
            </InnerContent>
        </HiddenContainer>
    );
};

export default BookmarkMeasureItem;
