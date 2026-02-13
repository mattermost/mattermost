// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {announce} from '@atlaskit/pragmatic-drag-and-drop-live-region';
import {useCallback, useEffect, useRef, useState} from 'react';
import {useIntl} from 'react-intl';

interface KeyboardReorderState {
    isReordering: boolean;
    itemId: string | null;
    originalIndex: number | null;
}

const INITIAL_STATE: KeyboardReorderState = {
    isReordering: false,
    itemId: null,
    originalIndex: null,
};

interface UseKeyboardReorderOptions {
    order: string[];
    visibleItems: string[];
    overflowItems: string[];
    onReorder: (id: string, fromIndex: number, toIndex: number) => Promise<void>;
    getName: (id: string) => string;
    onOverflowOpenChange?: (open: boolean) => void;
    canReorder: boolean;
}

export interface KeyboardReorderItemProps {
    tabIndex: number;
    'aria-roledescription': string;
    onKeyDown: (e: React.KeyboardEvent) => void;
}

interface UseKeyboardReorderResult {
    reorderState: KeyboardReorderState;
    getItemProps: (id: string) => KeyboardReorderItemProps;
}

export function useKeyboardReorder({
    order,
    visibleItems,
    overflowItems,
    onReorder,
    getName,
    onOverflowOpenChange,
    canReorder,
}: UseKeyboardReorderOptions): UseKeyboardReorderResult {
    const {formatMessage} = useIntl();
    const [state, setState] = useState<KeyboardReorderState>(INITIAL_STATE);

    // Use refs for values accessed in callbacks to avoid stale closures
    const orderRef = useRef(order);
    const visibleItemsRef = useRef(visibleItems);
    const overflowItemsRef = useRef(overflowItems);

    useEffect(() => {
        orderRef.current = order;
    }, [order]);
    useEffect(() => {
        visibleItemsRef.current = visibleItems;
    }, [visibleItems]);
    useEffect(() => {
        overflowItemsRef.current = overflowItems;
    }, [overflowItems]);

    // Re-focus the active item after order changes
    useEffect(() => {
        if (state.isReordering && state.itemId) {
            // Find the item container, then focus the link/span inside it
            const container = document.querySelector(
                `[data-testid="bookmark-item-${state.itemId}"], [data-testid="overflow-bookmark-item-${state.itemId}"]`,
            );
            const focusable = container?.querySelector('a[tabindex], span[tabindex]') as HTMLElement;
            focusable?.focus();
        }
    }, [order, state.isReordering, state.itemId]);

    const startReorder = useCallback((id: string) => {
        const index = orderRef.current.indexOf(id);
        if (index === -1) {
            return;
        }

        setState({isReordering: true, itemId: id, originalIndex: index});

        const name = getName(id);
        announce(
            formatMessage(
                {
                    id: 'channel_bookmarks.reorder.start',
                    defaultMessage: 'Selected {name} for reordering. Use arrow keys to move, Space to confirm, Escape to cancel.',
                },
                {name},
            ),
        );
    }, [getName, formatMessage]);

    const confirmReorder = useCallback(() => {
        setState(INITIAL_STATE);
        announce(
            formatMessage({
                id: 'channel_bookmarks.reorder.confirmed',
                defaultMessage: 'Reorder confirmed.',
            }),
        );
    }, [formatMessage]);

    const cancelReorder = useCallback(() => {
        const {itemId, originalIndex} = state;
        if (itemId != null && originalIndex != null) {
            const currentIndex = orderRef.current.indexOf(itemId);
            if (currentIndex !== -1 && currentIndex !== originalIndex) {
                onReorder(itemId, currentIndex, originalIndex);
            }
        }

        setState(INITIAL_STATE);
        announce(
            formatMessage({
                id: 'channel_bookmarks.reorder.cancelled',
                defaultMessage: 'Reorder cancelled.',
            }),
        );
    }, [state, onReorder, formatMessage]);

    const moveItem = useCallback((direction: -1 | 1) => {
        if (!state.isReordering || !state.itemId) {
            return;
        }

        const currentOrder = orderRef.current;
        const currentIndex = currentOrder.indexOf(state.itemId);
        if (currentIndex === -1) {
            return;
        }

        const newIndex = currentIndex + direction;
        if (newIndex < 0 || newIndex >= currentOrder.length) {
            return;
        }

        // Cross-container detection
        const visible = visibleItemsRef.current;
        const overflow = overflowItemsRef.current;
        const lastVisibleIndex = visible.length - 1;
        const firstOverflowGlobalIndex = visible.length;

        // Moving right from last visible bar item → open overflow
        if (direction === 1 && currentIndex === lastVisibleIndex && overflow.length > 0) {
            onOverflowOpenChange?.(true);
        }

        // Moving left/up from first overflow item → close overflow if it will be empty
        if (direction === -1 && currentIndex === firstOverflowGlobalIndex) {
            if (overflow.length <= 1) {
                onOverflowOpenChange?.(false);
            }
        }

        const name = getName(state.itemId);
        onReorder(state.itemId, currentIndex, newIndex);

        announce(
            formatMessage(
                {
                    id: 'channel_bookmarks.reorder.moved',
                    defaultMessage: '{name} moved to position {position} of {total}.',
                },
                {name, position: newIndex + 1, total: currentOrder.length},
            ),
        );
    }, [state, onReorder, getName, onOverflowOpenChange, formatMessage]);

    const getItemProps = useCallback((id: string): KeyboardReorderItemProps => {
        return {
            tabIndex: 0,
            'aria-roledescription': formatMessage({
                id: 'channel_bookmarks.sortable',
                defaultMessage: 'sortable',
            }),
            onKeyDown: (e: React.KeyboardEvent) => {
                if (!canReorder) {
                    return;
                }

                // If another item is being reordered, ignore input on this item
                if (state.isReordering && state.itemId !== id) {
                    return;
                }

                switch (e.key) {
                case ' ':
                    e.preventDefault();
                    e.stopPropagation();
                    if (state.isReordering) {
                        confirmReorder();
                    } else {
                        startReorder(id);
                    }
                    break;
                case 'Enter':
                    if (state.isReordering) {
                        e.preventDefault();
                        e.stopPropagation();
                        confirmReorder();
                    }
                    break;
                case 'Escape':
                    if (state.isReordering) {
                        e.preventDefault();
                        e.stopPropagation();
                        cancelReorder();
                    }
                    break;
                case 'ArrowLeft':
                case 'ArrowUp':
                    if (state.isReordering) {
                        e.preventDefault();
                        e.stopPropagation();
                        moveItem(-1);
                    }
                    break;
                case 'ArrowRight':
                case 'ArrowDown':
                    if (state.isReordering) {
                        e.preventDefault();
                        e.stopPropagation();
                        moveItem(1);
                    }
                    break;
                }
            },
        };
    }, [canReorder, state, startReorder, confirmReorder, cancelReorder, moveItem, formatMessage]);

    return {reorderState: state, getItemProps};
}
