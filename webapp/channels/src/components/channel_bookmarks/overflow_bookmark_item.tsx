// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Edge} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import {DropIndicator} from '@atlaskit/pragmatic-drag-and-drop-react-drop-indicator/box';
import classNames from 'classnames';
import React, {useCallback, useContext, useState} from 'react';

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

const edges: Edge[] = ['top', 'bottom'];

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

    const [liElement, setLiElement] = useState<HTMLLIElement | null>(null);

    const [isLabelOverflowing, labelRef] = useTextOverflow();

    const {isDragSelf, closestEdge} = useBookmarkDragDrop({
        id,
        container: 'overflow',
        allowedEdges: edges,
        displayName: bookmark.display_name,
        canReorder,
        element: liElement,
    });

    // Compose keyboard handlers: reorder first, then ArrowRight to open dot menu
    const handleItemKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (keyboardReorderProps?.onKeyDown) {
            keyboardReorderProps.onKeyDown(e);
            if (e.defaultPrevented) {
                return;
            }
        }

        if (e.key === 'ArrowRight') {
            e.preventDefault();
            e.stopPropagation();
            const button = liElement?.querySelector('.channelBookmarksDotMenuButton--overflow') as HTMLElement;
            button?.click();
        }
    }, [keyboardReorderProps, liElement]);

    const linksDisabled = isDragging || isDragSelf;
    const {openBookmark, icon} = useBookmarkLink(bookmark, linksDisabled, handleNavigate);

    // ArrowLeft from the open dot menu closes it and returns focus to the item
    const handleDotMenuKeyDown = useCallback((_event: React.KeyboardEvent<HTMLDivElement>, closeMenu?: () => void) => {
        if (_event.key === 'ArrowLeft') {
            _event.preventDefault();
            _event.stopPropagation();
            closeMenu?.();
            liElement?.focus();
        }
    }, [liElement]);

    const itemClassName = classNames('overflowBookmarkItem', {
        'is-dragging-self': isDragSelf,
        'is-keyboard-reordering': isKeyboardReordering,
    });

    return (
        <Menu.Item
            ref={setLiElement}
            id={`overflow-bookmark-${id}`}
            className={itemClassName}
            data-bookmark-id={id}
            data-testid={`overflow-bookmark-item-${id}`}
            onClick={isKeyboardReordering ? undefined : openBookmark}
            disableCloseOnSelect={isKeyboardReordering}
            onKeyDown={handleItemKeyDown}
            leadingElement={icon}
            labels={(
                <WithTooltip
                    id={`overflow-bookmark-tooltip-${id}`}
                    title={bookmark.display_name}
                    disabled={!isLabelOverflowing || isDragging}
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
                    onMenuKeyDown={handleDotMenuKeyDown}
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
