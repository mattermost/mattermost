// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import React from 'react';
import styled, {css} from 'styled-components';

import type {ChannelBookmark} from '@mattermost/types/channel_bookmarks';

import BookmarkItemContent from './bookmark_item_content';

interface BookmarksSortableItemProps {
    id: string;
    bookmark: ChannelBookmark;
    disabled?: boolean;
    isDragging?: boolean;
}

function BookmarksSortableItem({
    id,
    bookmark,
    disabled = false,
    isDragging: globalIsDragging = false,
}: BookmarksSortableItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id,
        disabled,
        data: {
            bookmark,
        },
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 1000 : undefined,
    };

    return (
        <SortableChip
            ref={setNodeRef}
            style={style}
            $isDragging={isDragging}
            data-testid={`bookmark-item-${id}`}
        >
            <DragHandle
                {...attributes}
                {...listeners}
                $disabled={disabled}
            >
                <BookmarkItemContent
                    bookmark={bookmark}
                    disableInteractions={isDragging || globalIsDragging}
                />
            </DragHandle>
        </SortableChip>
    );
}

const SortableChip = styled.div<{
    $isDragging: boolean;
}>`
    position: relative;
    border-radius: 12px;
    overflow: hidden;
    flex-shrink: 0;
    min-width: 5rem;
    max-width: 25rem;
    touch-action: none;

    ${({$isDragging}) => $isDragging && css`
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        cursor: grabbing;
    `}
`;

const DragHandle = styled.div<{$disabled: boolean}>`
    display: flex;
    width: 100%;
    cursor: ${({$disabled}) => ($disabled ? 'default' : 'grab')};

    &:active {
        cursor: ${({$disabled}) => ($disabled ? 'default' : 'grabbing')};
    }
`;

export default BookmarksSortableItem;
