// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combine} from '@atlaskit/pragmatic-drag-and-drop/combine';
import {draggable, dropTargetForElements} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import {setCustomNativeDragPreview} from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview';
import type {Edge} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import {attachClosestEdge, extractClosestEdge} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import {DropIndicator} from '@atlaskit/pragmatic-drag-and-drop-react-drop-indicator/box';
import React, {useEffect, useRef, useState} from 'react';
import styled, {css} from 'styled-components';

import type {ChannelBookmark} from '@mattermost/types/channel_bookmarks';

import BookmarkItemContent from './bookmark_item_content';
import {createBookmarkDragPreview} from './drag_preview';
import type {KeyboardReorderItemProps} from './hooks';

interface BookmarksBarItemProps {
    id: string;
    bookmark: ChannelBookmark;
    disabled: boolean;
    isDraggingGlobal: boolean;
    keyboardReorderProps?: KeyboardReorderItemProps;
    isKeyboardReordering?: boolean;
}

function BookmarksBarItem({id, bookmark, disabled, isDraggingGlobal, keyboardReorderProps, isKeyboardReordering}: BookmarksBarItemProps) {
    const ref = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [closestEdge, setClosestEdge] = useState<Edge | null>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el || disabled) {
            return undefined;
        }

        return combine(
            draggable({
                element: el,
                getInitialData: () => ({type: 'bookmark', bookmarkId: id, container: 'bar'}),
                onGenerateDragPreview: ({nativeSetDragImage}) => {
                    setCustomNativeDragPreview({
                        nativeSetDragImage,
                        render: ({container}) => {
                            container.appendChild(createBookmarkDragPreview(bookmark.display_name));
                        },
                    });
                },
                onDragStart: () => setIsDragging(true),
                onDrop: () => setIsDragging(false),
            }),
            dropTargetForElements({
                element: el,
                getData: ({input, element}) =>
                    attachClosestEdge(
                        {type: 'bookmark', bookmarkId: id, container: 'bar'},
                        {input, element, allowedEdges: ['left', 'right']},
                    ),
                canDrop: ({source}) =>
                    source.data.type === 'bookmark' && source.data.bookmarkId !== id,
                onDrag: ({self}) => setClosestEdge(extractClosestEdge(self.data)),
                onDragLeave: () => setClosestEdge(null),
                onDrop: () => setClosestEdge(null),
            }),
        );
    }, [id, disabled, bookmark]);

    // Prevent Space from bubbling to message input
    const disableInteractions = isDragging || isDraggingGlobal;

    return (
        <BarItemWrapper
            ref={ref}
            data-testid={`bookmark-item-${id}`}
        >
            <BarChip
                $isDragging={isDragging}
                $isKeyboardReordering={isKeyboardReordering}
            >
                <BookmarkItemContent
                    bookmark={bookmark}
                    disableInteractions={disableInteractions}
                    keyboardReorderProps={keyboardReorderProps}
                />
            </BarChip>
            {closestEdge && (
                <DropIndicator
                    edge={closestEdge}
                    gap='0px'
                    type='no-terminal'
                />)}
        </BarItemWrapper>
    );
}

export default BookmarksBarItem;

// Outer wrapper: position relative for the drop indicator, no overflow clipping.
// This is the draggable/drop-target element. Horizontal padding extends the
// drop target hitbox into the visual gap between items (no dead zones).
const BarItemWrapper = styled.div`
    position: relative;
    flex-shrink: 0;
    min-width: 5rem;
    max-width: 25rem;
    padding: 0 3px;
`;

// Inner chip: border-radius + overflow hidden for visual clipping.
const BarChip = styled.div<{$isDragging: boolean; $isKeyboardReordering?: boolean}>`
    border-radius: 12px;
    overflow: hidden;

    ${({$isDragging}) => $isDragging && css`
        opacity: 0.4;
    `}

    ${({$isKeyboardReordering}) => $isKeyboardReordering && css`
        outline: 2px solid rgb(var(--button-bg-rgb));
        outline-offset: -2px;
    `}
`;

