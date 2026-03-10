// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useEffect, useState} from 'react';
import {useIntl} from 'react-intl';

import {useClickOutside} from 'hooks/useClickOutside';
import {useLatest} from 'hooks/useLatest';
import {useReadout} from 'hooks/useReadout';

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
    const readAloud = useReadout();
    const [state, setState] = useState<KeyboardReorderState>(INITIAL_STATE);

    // Use refs for values accessed in callbacks to avoid stale closures
    const orderRef = useLatest(order);
    const visibleItemsRef = useLatest(visibleItems);
    const overflowItemsRef = useLatest(overflowItems);

    // Re-focus the active item after order changes
    useEffect(() => {
        if (state.isReordering && state.itemId) {
            const container = document.querySelector(
                `[data-bookmark-id="${state.itemId}"]`,
            );
            const focusable = (container?.querySelector('a[tabindex], span[tabindex]') as HTMLElement | null) ?? (container as HTMLElement | null);
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
        readAloud(
            formatMessage(
                {
                    id: 'channel_bookmarks.reorder.start',
                    defaultMessage: 'Selected {name} for reordering. Use arrow keys to move, Space to confirm, Escape to cancel.',
                },
                {name},
            ),
        );
    }, [getName, formatMessage, readAloud]);

    const confirmReorder = useCallback(() => {
        // Keep overflow menu open if item ended in overflow
        const inOverflow = state.itemId ? overflowItemsRef.current.includes(state.itemId) : false;
        onOverflowOpenChange?.(inOverflow);

        setState(INITIAL_STATE);
        readAloud(
            formatMessage({
                id: 'channel_bookmarks.reorder.confirmed',
                defaultMessage: 'Reorder confirmed.',
            }),
        );
    }, [state.itemId, onOverflowOpenChange, formatMessage, readAloud]);

    // Confirm reorder on click-anywhere (null ref = any mousedown)
    useClickOutside(null, confirmReorder, state.isReordering);

    const cancelReorder = useCallback(() => {
        const {itemId, originalIndex} = state;
        if (itemId != null && originalIndex != null) {
            const currentIndex = orderRef.current.indexOf(itemId);
            if (currentIndex !== -1 && currentIndex !== originalIndex) {
                onReorder(itemId, currentIndex, originalIndex);
            }
        }

        onOverflowOpenChange?.(false);
        setState(INITIAL_STATE);
        readAloud(
            formatMessage({
                id: 'channel_bookmarks.reorder.cancelled',
                defaultMessage: 'Reorder cancelled.',
            }),
        );
    }, [state, onReorder, formatMessage, readAloud]);

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

        // Moving left/up from first overflow item → close overflow so
        // MUI's focus trap doesn't steal focus from the bar item
        if (direction === -1 && currentIndex === firstOverflowGlobalIndex) {
            onOverflowOpenChange?.(false);
        }

        const name = getName(state.itemId);
        onReorder(state.itemId, currentIndex, newIndex);

        readAloud(
            formatMessage(
                {
                    id: 'channel_bookmarks.reorder.moved',
                    defaultMessage: '{name} moved to position {position} of {total}.',
                },
                {name, position: newIndex + 1, total: currentOrder.length},
            ),
        );
    }, [state, onReorder, getName, onOverflowOpenChange, formatMessage, readAloud]);

    const getItemProps = useCallback((id: string): KeyboardReorderItemProps => {
        return {
            tabIndex: 0,
            onKeyDown: (e: React.KeyboardEvent) => {
                if (!canReorder) {
                    return;
                }

                // If another item is being reordered, ignore input on this item
                if (state.isReordering && state.itemId !== id) {
                    return;
                }

                // During reorder, block all keys except our handlers to
                // prevent Tab, type-ahead, Home/End, etc. from moving focus
                if (state.isReordering) {
                    switch (e.key) {
                    case ' ':
                    case 'Enter':
                        e.preventDefault();
                        e.stopPropagation();
                        confirmReorder();
                        return;
                    case 'Escape':
                        e.preventDefault();
                        e.stopPropagation();
                        cancelReorder();
                        return;
                    case 'ArrowLeft':
                    case 'ArrowUp': {
                        const inOverflow = overflowItemsRef.current.includes(state.itemId!);
                        if ((inOverflow && e.key === 'ArrowUp') || (!inOverflow && e.key === 'ArrowLeft')) {
                            moveItem(-1);
                        }
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                    }
                    case 'ArrowRight':
                    case 'ArrowDown': {
                        const inOverflow = overflowItemsRef.current.includes(state.itemId!);
                        if ((inOverflow && e.key === 'ArrowDown') || (!inOverflow && e.key === 'ArrowRight')) {
                            moveItem(1);
                        }
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                    }
                    default:
                        // Block everything else (Tab, letters, Home, End, etc.)
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                    }
                }

                // Not reordering — Space starts reorder
                if (e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    startReorder(id);
                }
            },
        };
    }, [canReorder, state, startReorder, confirmReorder, cancelReorder, moveItem]);

    return {reorderState: state, getItemProps};
}
