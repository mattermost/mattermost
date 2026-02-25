// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Edge} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import {DropIndicator} from '@atlaskit/pragmatic-drag-and-drop-react-drop-indicator/box';
import classNames from 'classnames';
import React, {useCallback, useContext, useEffect, useRef} from 'react';

import type {ChannelBookmark} from '@mattermost/types/channel_bookmarks';

import * as Menu from 'components/menu';
import {MenuContext} from 'components/menu/menu_context';
import WithTooltip from 'components/with_tooltip';

import BookmarkItemDotMenu from './bookmark_dot_menu';
import {useBookmarkLink} from './bookmark_item_content';
import {useBookmarkDragDrop, useTextOverflow} from './hooks';

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

    const labelRef = useRef<HTMLSpanElement>(null);
    const isLabelOverflowing = useTextOverflow(labelRef);

    // Resolve the parent <li> from the sentinel after mount
    useEffect(() => {
        if (sentinelRef.current) {
            liRef.current = sentinelRef.current.closest('li');
        }
    }, []);

    const {isDragSelf, closestEdge} = useBookmarkDragDrop({
        id,
        container: 'overflow',
        allowedEdges: ['top', 'bottom'] as Edge[],
        displayName: bookmark.display_name,
        canReorder,
        getElement: () => liRef.current,
    });

    const linksDisabled = isDragging || isDragSelf;
    const {openBookmark, icon} = useBookmarkLink(bookmark, linksDisabled, handleNavigate);

    const itemClassName = classNames('overflowBookmarkItem', {
        'is-dragging-self': isDragSelf,
        'is-keyboard-reordering': isKeyboardReordering,
    });

    return (
        <Menu.Item
            id={`overflow-bookmark-${id}`}
            className={itemClassName}
            data-bookmark-id={id}
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
