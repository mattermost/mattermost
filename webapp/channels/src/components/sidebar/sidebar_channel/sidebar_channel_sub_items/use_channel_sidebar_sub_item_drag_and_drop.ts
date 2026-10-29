// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type React from 'react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useStore} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';

import {
    canDropChannelSidebarSubItem,
    dropChannelSidebarSubItem,
} from 'selectors/channel_sidebar_sub_items';
import type {ResolvedChannelSidebarSubItem} from 'selectors/channel_sidebar_sub_items';

import type {GlobalState} from 'types/store';
import type {ChannelSidebarSubItemDropPosition} from 'types/store/plugins';

import type {ChannelSidebarSubItemExpansion} from './use_channel_sidebar_sub_item_expansion';

export const CHANNEL_SIDEBAR_SUB_ITEM_DRAG_TYPE = 'application/x-mattermost-sidebar-sub-item';

export const EXPAND_ON_DRAG_HOVER_DELAY = 600;

const EDGE_RATIO = 0.25;

export type ChannelSidebarSubItemDropTarget = {
    key: string;
    position: ChannelSidebarSubItemDropPosition;
};

export type ChannelSidebarSubItemDragHandlers = {
    onDragStart: (item: ResolvedChannelSidebarSubItem, event: React.DragEvent<HTMLElement>) => void;
    onDragOver: (item: ResolvedChannelSidebarSubItem, event: React.DragEvent<HTMLElement>) => void;
    onDragLeave: (item: ResolvedChannelSidebarSubItem, event: React.DragEvent<HTMLElement>) => void;
    onDrop: (item: ResolvedChannelSidebarSubItem, event: React.DragEvent<HTMLElement>) => void;
    onDragEnd: () => void;
};

export function getChannelSidebarSubItemDropPosition(clientY: number, rect: {top: number; height: number}): ChannelSidebarSubItemDropPosition {
    if (rect.height <= 0) {
        return 'inside';
    }
    const ratio = (clientY - rect.top) / rect.height;
    if (ratio < EDGE_RATIO) {
        return 'before';
    }
    if (ratio > 1 - EDGE_RATIO) {
        return 'after';
    }
    return 'inside';
}

function isSubItemDrag(event: React.DragEvent) {
    return Array.from(event.dataTransfer?.types ?? []).includes(CHANNEL_SIDEBAR_SUB_ITEM_DRAG_TYPE);
}

/**
 * Native drag-and-drop between the sub-items of one channel. The dragged item is tracked in a ref
 * because dataTransfer data cannot be read before the drop. Drags that did not start from one of
 * this list's own draggable items (other channels, other plugins, files) are ignored.
 */
export function useChannelSidebarSubItemDragAndDrop(
    channel: Channel,
    items: ResolvedChannelSidebarSubItem[],
    expansion: ChannelSidebarSubItemExpansion,
) {
    const store = useStore<GlobalState>();
    const [draggingKey, setDraggingKey] = useState<string>();
    const [dropTarget, setDropTarget] = useState<ChannelSidebarSubItemDropTarget>();

    const draggedKeyRef = useRef<string | undefined>(undefined);
    const dragStateTimer = useRef<number | undefined>(undefined);
    const expandTimer = useRef<{key: string; id: number} | undefined>(undefined);

    const latest = useRef({channel, items, expansion});
    latest.current = {channel, items, expansion};

    const clearExpandTimer = useCallback(() => {
        if (expandTimer.current) {
            window.clearTimeout(expandTimer.current.id);
            expandTimer.current = undefined;
        }
    }, []);

    const reset = useCallback(() => {
        window.clearTimeout(dragStateTimer.current);
        clearExpandTimer();
        draggedKeyRef.current = undefined;
        setDraggingKey(undefined);
        setDropTarget(undefined);
    }, [clearExpandTimer]);

    useEffect(() => () => {
        window.clearTimeout(dragStateTimer.current);
        clearExpandTimer();
    }, [clearExpandTimer]);

    const getDragged = () => {
        const key = draggedKeyRef.current;
        return key ? latest.current.items.find((item) => item.key === key) : undefined;
    };

    const scheduleExpand = useCallback((item: ResolvedChannelSidebarSubItem) => {
        if (expandTimer.current?.key === item.key) {
            return;
        }
        clearExpandTimer();
        if (!item.hasChildren || latest.current.expansion.isExpanded(item.key)) {
            return;
        }
        expandTimer.current = {
            key: item.key,
            id: window.setTimeout(() => {
                expandTimer.current = undefined;
                latest.current.expansion.expand(item.key);
            }, EXPAND_ON_DRAG_HOVER_DELAY),
        };
    }, [clearExpandTimer]);

    const handlers = useMemo<ChannelSidebarSubItemDragHandlers>(() => ({
        onDragStart: (item, event) => {
            if (!item.draggable) {
                return;
            }

            event.dataTransfer.setData(CHANNEL_SIDEBAR_SUB_ITEM_DRAG_TYPE, JSON.stringify({
                channelId: latest.current.channel.id,
                itemKey: item.key,
            }));
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setDragImage?.(event.currentTarget, 0, 0);
            draggedKeyRef.current = item.key;

            // Changing the row's appearance synchronously can cancel the drag in some browsers.
            window.clearTimeout(dragStateTimer.current);
            dragStateTimer.current = window.setTimeout(() => setDraggingKey(item.key), 0);
        },

        onDragOver: (item, event) => {
            const dragged = getDragged();
            if (!dragged || !isSubItemDrag(event)) {
                return;
            }

            if (item.key === dragged.key) {
                clearExpandTimer();
            } else {
                scheduleExpand(item);
            }

            const position = getChannelSidebarSubItemDropPosition(event.clientY, event.currentTarget.getBoundingClientRect());
            const {channel: currentChannel, items: currentItems} = latest.current;
            if (canDropChannelSidebarSubItem(store.getState(), currentChannel, dragged, item, position, currentItems)) {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                setDropTarget((current) => (current?.key === item.key && current.position === position ? current : {key: item.key, position}));
            } else {
                event.dataTransfer.dropEffect = 'none';
                setDropTarget((current) => (current?.key === item.key ? undefined : current));
            }
        },

        onDragLeave: (item, event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
                return;
            }
            if (expandTimer.current?.key === item.key) {
                clearExpandTimer();
            }
            setDropTarget((current) => (current?.key === item.key ? undefined : current));
        },

        onDrop: (item, event) => {
            const dragged = getDragged();
            if (!dragged || !isSubItemDrag(event)) {
                return;
            }

            event.preventDefault();
            const position = getChannelSidebarSubItemDropPosition(event.clientY, event.currentTarget.getBoundingClientRect());
            const {channel: currentChannel, items: currentItems} = latest.current;
            reset();
            dropChannelSidebarSubItem(store.getState(), currentChannel, dragged, item, position, currentItems);
        },

        onDragEnd: reset,
    }), [store, reset, clearExpandTimer, scheduleExpand]);

    return {draggingKey, dropTarget, handlers};
}
