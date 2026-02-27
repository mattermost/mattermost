// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Edge} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import {DropIndicator} from '@atlaskit/pragmatic-drag-and-drop-react-drop-indicator/box';
import classNames from 'classnames';
import React, {useCallback, useContext, useRef} from 'react';

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
    keyboardReorderProps?: {
        tabIndex: number;
        onKeyDown: (e: React.KeyboardEvent) => void;
    };
}

function OverflowBookmarkItem({
    id,
    bookmark,
    canReorder,
    isDragging,
    isKeyboardReordering,
    keyboardReorderProps,
}: OverflowBookmarkItemProps) {
    const menuContext = useContext(MenuContext);
    const handleNavigate = useCallback(() => {
        menuContext.close?.();
    }, [menuContext]);

    const liRef = useRef<HTMLLIElement>(null);

    const labelRef = useRef<HTMLSpanElement>(null);
    const isLabelOverflowing = useTextOverflow(labelRef);

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
            ref={liRef}
            id={`overflow-bookmark-${id}`}
            className={itemClassName}
            data-bookmark-id={id}
            data-testid={`overflow-bookmark-item-${id}`}
            onClick={openBookmark}
            onKeyDown={keyboardReorderProps?.onKeyDown}
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
        >
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
