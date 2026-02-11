// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combine} from '@atlaskit/pragmatic-drag-and-drop/combine';
import {draggable, dropTargetForElements} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import {setCustomNativeDragPreview} from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview';
import type {Edge} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import {attachClosestEdge, extractClosestEdge} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import {DropIndicator} from '@atlaskit/pragmatic-drag-and-drop-react-drop-indicator/box';
import React, {useCallback, useContext, useEffect, useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import styled, {css} from 'styled-components';

import type {ChannelBookmark} from '@mattermost/types/channel_bookmarks';

import {MenuContext} from 'components/menu/menu_context';

import BookmarkItemDotMenu from './bookmark_dot_menu';
import {useBookmarkLink, DynamicLink} from './bookmark_item_content';
import {createBookmarkDragPreview} from './drag_preview';

interface OverflowBookmarkItemProps {
    id: string;
    bookmark: ChannelBookmark;
    canReorder: boolean;
    isDragging: boolean;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
}

function OverflowBookmarkItem({id, bookmark, canReorder, isDragging, onMoveUp, onMoveDown}: OverflowBookmarkItemProps) {
    const {formatMessage} = useIntl();
    const moveUpLabel = formatMessage({id: 'channel_bookmarks.moveUp', defaultMessage: 'Move up'});
    const moveDownLabel = formatMessage({id: 'channel_bookmarks.moveDown', defaultMessage: 'Move down'});

    const menuContext = useContext(MenuContext);
    const handleNavigate = useCallback(() => {
        menuContext.close?.();
    }, [menuContext]);

    const ref = useRef<HTMLLIElement>(null);
    const [isDragSelf, setIsDragSelf] = useState(false);
    const [closestEdge, setClosestEdge] = useState<Edge | null>(null);

    const linksDisabled = isDragging || isDragSelf;
    const {href, onClick, linkRef, isFile, icon, displayName, open} = useBookmarkLink(bookmark, linksDisabled, handleNavigate);

    useEffect(() => {
        const el = ref.current;
        if (!el || !canReorder) {
            return undefined;
        }

        return combine(
            draggable({
                element: el,
                getInitialData: () => ({type: 'bookmark', bookmarkId: id, container: 'overflow'}),
                onGenerateDragPreview: ({nativeSetDragImage}) => {
                    setCustomNativeDragPreview({
                        nativeSetDragImage,
                        render: ({container}) => {
                            container.appendChild(createBookmarkDragPreview(bookmark.display_name));
                        },
                    });
                },
                onDragStart: () => setIsDragSelf(true),
                onDrop: () => setIsDragSelf(false),
            }),
            dropTargetForElements({
                element: el,
                getData: ({input, element}) =>
                    attachClosestEdge(
                        {type: 'bookmark', bookmarkId: id, container: 'overflow'},
                        {input, element, allowedEdges: ['top', 'bottom']},
                    ),
                canDrop: ({source}) =>
                    source.data.type === 'bookmark' && source.data.bookmarkId !== id,
                onDrag: ({self}) => setClosestEdge(extractClosestEdge(self.data)),
                onDragLeave: () => setClosestEdge(null),
                onDrop: () => setClosestEdge(null),
            }),
        );
    }, [id, canReorder, bookmark.display_name]);

    return (
        <ItemContainer
            ref={ref}
            $isDragSelf={isDragSelf}
            data-testid={`overflow-bookmark-item-${id}`}
        >
            <OverflowLink $canReorder={canReorder}>
                <DynamicLink
                    href={href}
                    onClick={onClick}
                    ref={linkRef}
                    isFile={isFile}
                    draggable={false}
                >
                    {icon}
                    <Label>{displayName}</Label>
                </DynamicLink>
            </OverflowLink>
            <TrailingElement>
                <BookmarkItemDotMenu
                    bookmark={bookmark}
                    open={open}
                    buttonClassName='channelBookmarksDotMenuButton--overflow'
                    onMoveBefore={onMoveUp}
                    onMoveAfter={onMoveDown}
                    moveBeforeLabel={moveUpLabel}
                    moveAfterLabel={moveDownLabel}
                    moveDirection='vertical'
                />
            </TrailingElement>
            {closestEdge && (
                <DropIndicator
                    edge={closestEdge}
                    type='no-terminal'
                />
            )}
        </ItemContainer>
    );
}

export default OverflowBookmarkItem;

const ItemContainer = styled.li<{$isDragSelf: boolean}>`
    position: relative;
    display: flex;
    align-items: center;
    padding: 0 20px;
    min-height: 36px;

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
    }

    /* Show dot menu on hover, focus-within, or when its dropdown is open */
    &:hover,
    &:focus-within,
    &:has([aria-expanded="true"]) {
        > div:last-of-type {
            opacity: 1;
        }
    }

    ${({$isDragSelf}) => $isDragSelf && css`
        opacity: 0.4;
    `}
`;

// Wrapper that applies overflow-specific link styles and acts as drag handle
const OverflowLink = styled.div<{$canReorder: boolean}>`
    display: flex;
    flex: 1;
    align-items: center;
    min-width: 0;
    overflow: hidden;

    ${({$canReorder}) => $canReorder && css`
        cursor: grab;

        &:active {
            cursor: grabbing;
        }
    `}

    /* Overflow link styles — different from bar chip (larger, lighter weight) */
    a, span {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
        min-width: 0;
        overflow: hidden;
        padding: 6px 0;
        color: var(--center-channel-color);
        font-family: Open Sans;
        font-size: 14px;
        font-weight: 400;
        line-height: 20px;
        text-decoration: none;

        &:hover {
            text-decoration: none;
        }

        &:focus {
            outline: none;
        }

        &:focus-visible {
            text-decoration: underline;
        }
    }
`;

const TrailingElement = styled.div`
    margin-left: 8px;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 150ms ease;
`;

const Label = styled.span`
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
    flex: 1;
`;
