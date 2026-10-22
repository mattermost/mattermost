// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Edge} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import {DropIndicator} from '@atlaskit/pragmatic-drag-and-drop-react-drop-indicator/box';
import React, {useCallback, useState} from 'react';
import styled, {css} from 'styled-components';

import type {ChannelBookmark} from '@mattermost/types/channel_bookmarks';

import BookmarkItemContent from './bookmark_item_content';
import {useBookmarkDragDrop, type KeyboardReorderItemProps} from './hooks';

interface BookmarksBarItemProps {
    id: string;
    bookmark: ChannelBookmark;
    disabled: boolean;
    isDraggingGlobal: boolean;
    keyboardReorderProps?: KeyboardReorderItemProps;
    isKeyboardReordering?: boolean;
    hidden?: boolean;
    onMount?: (id: string, element: HTMLElement | null) => void;
}

const edges: Edge[] = ['left', 'right'];
function BookmarksBarItem({id, bookmark, disabled, isDraggingGlobal, keyboardReorderProps, isKeyboardReordering, hidden, onMount}: BookmarksBarItemProps) {
    const [element, setElement] = useState<HTMLDivElement | null>(null);
    const ref = useCallback((node: HTMLDivElement | null) => {
        setElement(node);
        onMount?.(id, node);
    }, [id, onMount]);

    const {isDragSelf, closestEdge} = useBookmarkDragDrop({
        id,
        container: 'bar',
        allowedEdges: edges,
        displayName: bookmark.display_name,
        canReorder: !disabled && !hidden,
        element,
    });

    // Prevent Space from bubbling to message input
    const disableInteractions = isDragSelf || isDraggingGlobal || Boolean(hidden);

    if (hidden) {
        return (
            <BarItemWrapper
                ref={ref}
                data-bookmark-id={id}
                data-testid={`bookmark-item-${id}`}
                aria-hidden='true'
                className='bookmarkMeasureItem'
            >
                <BarChip
                    $isDragging={false}
                >
                    <BookmarkItemContent
                        bookmark={bookmark}
                        disableInteractions={true}
                    />
                </BarChip>
            </BarItemWrapper>
        );
    }

    return (
        <BarItemWrapper
            ref={ref}
            data-bookmark-id={id}
            data-testid={`bookmark-item-${id}`}
        >
            <BarChip
                $isDragging={isDragSelf}
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
        outline: 3px solid rgb(var(--button-bg-rgb));
        outline-offset: -3px;
    `}
`;

