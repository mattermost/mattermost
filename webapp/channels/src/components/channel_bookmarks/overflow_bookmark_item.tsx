// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combine} from '@atlaskit/pragmatic-drag-and-drop/combine';
import {draggable, dropTargetForElements} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import {setCustomNativeDragPreview} from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview';
import type {Edge} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import {attachClosestEdge, extractClosestEdge} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import {DropIndicator} from '@atlaskit/pragmatic-drag-and-drop-react-drop-indicator/box';
import React, {useCallback, useContext, useEffect, useRef, useState} from 'react';

import type {ChannelBookmark} from '@mattermost/types/channel_bookmarks';

import * as Menu from 'components/menu';
import {MenuContext} from 'components/menu/menu_context';
import WithTooltip from 'components/with_tooltip';

import BookmarkItemDotMenu from './bookmark_dot_menu';
import {useBookmarkLink} from './bookmark_item_content';
import {createBookmarkDragPreview} from './drag_preview';
import {useTextOverflow} from './hooks';

import './channel_bookmarks.scss';

interface OverflowBookmarkItemProps {
    id: string;
    bookmark: ChannelBookmark;
    canReorder: boolean;
    isDragging: boolean;
    isKeyboardReordering?: boolean;
    [key: string]: unknown;
}

function OverflowBookmarkItem({
    id,
    bookmark,
    canReorder,
    isDragging,
    isKeyboardReordering,
    ...otherProps
}: OverflowBookmarkItemProps) {
    const menuContext = useContext(MenuContext);
    const handleNavigate = useCallback(() => {
        menuContext.close?.();
    }, [menuContext]);

    // Sentinel ref to find the <li> rendered by Menu.Item for DnD registration
    const sentinelRef = useRef<HTMLSpanElement>(null);
    const liRef = useRef<HTMLLIElement | null>(null);
    const [isDragSelf, setIsDragSelf] = useState(false);
    const [closestEdge, setClosestEdge] = useState<Edge | null>(null);

    const labelRef = useRef<HTMLSpanElement>(null);
    const isLabelOverflowing = useTextOverflow(labelRef);

    const linksDisabled = isDragging || isDragSelf;
    const {openBookmark, icon} = useBookmarkLink(bookmark, linksDisabled, handleNavigate);

    // Resolve the parent <li> from the sentinel after mount
    useEffect(() => {
        if (sentinelRef.current) {
            liRef.current = sentinelRef.current.closest('li');
        }
    }, []);

    // Register DnD on the <li>
    useEffect(() => {
        const el = liRef.current;
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

    // Apply dynamic styles to the <li>
    useEffect(() => {
        const el = liRef.current;
        if (!el) {
            return;
        }
        el.style.position = 'relative';
        el.style.opacity = isDragSelf ? '0.4' : '';
        if (isKeyboardReordering) {
            el.style.outline = '2px solid rgb(var(--button-bg-rgb))';
            el.style.outlineOffset = '-2px';
        } else {
            el.style.outline = '';
            el.style.outlineOffset = '';
        }
    }, [isDragSelf, isKeyboardReordering]);

    return (
        <Menu.Item
            id={`overflow-bookmark-${id}`}
            className='overflowBookmarkItem'
            data-testid={`overflow-bookmark-item-${id}`}
            onClick={openBookmark}
            leadingElement={icon}
            labels={(
                <WithTooltip
                    id={`overflow-bookmark-tooltip-${id}`}
                    title={bookmark.display_name}
                    disabled={!isLabelOverflowing}
                >
                    <span ref={labelRef}>
                        {bookmark.display_name}
                    </span>
                </WithTooltip>
            )}
            trailingElements={(
                <BookmarkItemDotMenu
                    bookmark={bookmark}
                    open={openBookmark}
                    buttonClassName='channelBookmarksDotMenuButton--overflow'
                    onBeforeAction={handleNavigate}
                />
            )}
            {...otherProps}
        >
            {/* Sentinel for finding the parent <li> + drop indicator */}
            <span
                ref={sentinelRef}
                style={{position: 'absolute', width: 0, height: 0, overflow: 'hidden'}}
            />
            {closestEdge && (
                <DropIndicator
                    edge={closestEdge}
                    type='no-terminal'
                />
            )}
        </Menu.Item>
    );
}

export default OverflowBookmarkItem;
