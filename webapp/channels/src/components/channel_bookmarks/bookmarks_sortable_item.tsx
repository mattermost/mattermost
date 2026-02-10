// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useDndContext} from '@dnd-kit/core';
import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import React, {useCallback} from 'react';
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
    const {activatorEvent} = useDndContext();
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

    const isKeyboardDrag = isDragging && activatorEvent instanceof KeyboardEvent;

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging && !isKeyboardDrag ? 0.5 : 1,
        zIndex: isDragging ? 1000 : undefined,
    };

    // Prevent Space from bubbling to the message input which would steal focus
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === ' ') {
            e.stopPropagation();
        }
    }, []);

    return (
        <SortableChip
            ref={setNodeRef}
            style={style}
            $isDragging={isDragging}
            $isKeyboardDrag={isKeyboardDrag}
            data-testid={`bookmark-item-${id}`}
            onKeyDown={handleKeyDown}
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
    $isKeyboardDrag: boolean;
}>`
    position: relative;
    border-radius: 12px;
    overflow: hidden;
    flex-shrink: 0;
    min-width: 5rem;
    max-width: 25rem;
    touch-action: none;

    ${({$isDragging, $isKeyboardDrag}) => $isDragging && css`
        cursor: grabbing;
        ${$isKeyboardDrag ? css`
            background: rgba(var(--button-bg-rgb), 0.08);
        ` : css`
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        `}
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
