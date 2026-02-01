// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import React, {useCallback, useEffect, useRef} from 'react';
import styled, {css} from 'styled-components';

import type {ChannelBookmark} from '@mattermost/types/channel_bookmarks';

import BookmarkItemContent from './bookmark_item_content';

interface BookmarksSortableItemProps {
    id: string;
    bookmark: ChannelBookmark;
    disabled?: boolean;
    onMount?: (id: string, element: HTMLElement | null) => void;
    hidden?: boolean;
    isInOverflow?: boolean;
    isDragging?: boolean;
}

function BookmarksSortableItem({
    id,
    bookmark,
    disabled = false,
    onMount,
    hidden = false,
    isInOverflow = false,
    isDragging: globalIsDragging = false,
}: BookmarksSortableItemProps) {
    const elementRef = useRef<HTMLDivElement>(null);

    // Track pointer sessions to detect if a click originated from a drag
    const pointerSessionRef = useRef<{isDragSession: boolean} | null>(null);

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
            isInOverflow,
        },
    });

    // Mark current pointer session as a drag session when dragging starts
    useEffect(() => {
        if ((isDragging || globalIsDragging) && pointerSessionRef.current) {
            pointerSessionRef.current.isDragSession = true;
        }
    }, [isDragging, globalIsDragging]);

    // Track pointer down to start a new session
    const handlePointerDown = useCallback(() => {
        pointerSessionRef.current = {isDragSession: false};
    }, []);

    // Clear session after click event has fired
    const handlePointerUp = useCallback(() => {
        // Use requestAnimationFrame to ensure click event fires first
        requestAnimationFrame(() => {
            pointerSessionRef.current = null;
        });
    }, []);

    // Combine refs and report mount
    const setRefs = useCallback((node: HTMLDivElement | null) => {
        setNodeRef(node);
        (elementRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        if (onMount) {
            onMount(id, node);
        }
    }, [setNodeRef, onMount, id]);

    // Re-report on bookmark changes (name changes can affect width)
    useEffect(() => {
        if (elementRef.current && onMount) {
            onMount(id, elementRef.current);
        }
    }, [bookmark.display_name, id, onMount]);

    // Prevent click if this pointer session was a drag
    const handleClick = useCallback((e: React.MouseEvent) => {
        if (globalIsDragging || isDragging || pointerSessionRef.current?.isDragSession) {
            e.preventDefault();
            e.stopPropagation();
        }
    }, [globalIsDragging, isDragging]);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 1000 : undefined,
    };

    return (
        <SortableChip
            ref={setRefs}
            style={style}
            $isDragging={isDragging}
            $isInOverflow={isInOverflow}
            $hidden={hidden}
            data-testid={`bookmark-item-${id}`}
            onClick={handleClick}
            onClickCapture={handleClick}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
        >
            <DragHandle
                {...attributes}
                {...listeners}
                $disabled={disabled}
            >
                <BookmarkItemContent
                    bookmark={bookmark}
                    disableInteractions={isDragging || globalIsDragging}
                    isInOverflow={isInOverflow}
                />
            </DragHandle>
        </SortableChip>
    );
}

const SortableChip = styled.div<{
    $isDragging: boolean;
    $isInOverflow: boolean;
    $hidden: boolean;
}>`
    position: relative;
    border-radius: ${({$isInOverflow}) => ($isInOverflow ? '4px' : '12px')};
    overflow: hidden;
    flex-shrink: 0;
    min-width: ${({$isInOverflow}) => ($isInOverflow ? 'auto' : '5rem')};
    max-width: ${({$isInOverflow}) => ($isInOverflow ? 'none' : '25rem')};
    touch-action: none;

    ${({$hidden}) => $hidden && css`
        position: absolute;
        visibility: hidden;
        pointer-events: none;
    `}

    ${({$isDragging}) => $isDragging && css`
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        cursor: grabbing;
    `}

    ${({$isInOverflow}) => $isInOverflow && css`
        width: 100%;
        margin: 0;
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
