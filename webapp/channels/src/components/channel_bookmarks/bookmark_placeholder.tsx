// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import type {ChannelBookmark} from '@mattermost/types/channel_bookmarks';

import BookmarkIcon from './bookmark_icon';

interface BookmarkPlaceholderProps {
    bookmark: ChannelBookmark;
}

function BookmarkPlaceholder({bookmark}: BookmarkPlaceholderProps) {
    return (
        <PlaceholderChip data-testid={`bookmark-placeholder-${bookmark.id}`}>
            <PlaceholderContent>
                <BookmarkIcon
                    type={bookmark.type}
                    emoji={bookmark.emoji}
                    imageUrl={bookmark.image_url}
                />
                <Label>{bookmark.display_name}</Label>
            </PlaceholderContent>
        </PlaceholderChip>
    );
}

export default BookmarkPlaceholder;

const PlaceholderChip = styled.div`
    position: relative;
    border-radius: 12px;
    flex-shrink: 0;
    min-width: 5rem;
    max-width: 25rem;
    overflow: hidden;
    background: rgba(var(--center-channel-color-rgb), 0.08);
    opacity: 0.6;
`;

const PlaceholderContent = styled.div`
    display: flex;
    padding: 0 12px 0 6px;
    gap: 5px;
    min-width: 0;
    overflow: hidden;
    color: rgba(var(--center-channel-color-rgb), 0.56);
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
