// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import debounce from 'lodash/debounce';
import type {ReactNode} from 'react';
import React, {memo, useLayoutEffect, useRef} from 'react';

import {ListItemSizeObserver} from './list_item_size_observer';

const RESIZE_DEBOUNCE_TIME = 200; // in ms

const listItemSizeObserver = ListItemSizeObserver.getInstance();

export interface Props {
    item: ReactNode;
    itemId: string;
    index: number;
    height: number;
    width?: number; // Its optional since it may not be available when the parent component is mounted
    onHeightChange: (itemId: string, height: number, forceScrollCorrection: boolean) => void;
    onUnmount: (itemId: string, index: number) => void;
}

/**
 * This component is used to measure the height of a row and update the height of the row when it changes.
 * Uses a shared ResizeObserver instance for better performance with many items.
 */
const ListItem = (props: Props) => {
    const rowRef = useRef<HTMLDivElement>(null);

    const heightRef = useRef(props.height);
    const widthRef = useRef(props.width);
    const indexRef = useRef(props.index);

    // This prevents stale closures in the ResizeObserver callback
    // and ensures event handlers always have the latest values
    // we also update these refs whenever their source values change
    useLayoutEffect(() => {
        heightRef.current = props.height;
        widthRef.current = props.width;
        indexRef.current = props.index;
    }, [props.itemId, props.height, props.width, props.index]);

    // This effect is used to measure the height of the row as soon as the component mounts
    useLayoutEffect(() => {
        const newHeight = Math.ceil(rowRef?.current?.offsetHeight ?? 0);
        props.onHeightChange(props.itemId, newHeight, false);
    }, [props.itemId]);

    // This effects adds the observer which calls height change callback debounced
    useLayoutEffect(() => {
        const debouncedOnHeightChange = debounce((changedHeight: number) => {
            // Check if component is still mounted as it may have been
            // unmounted by the time the debounced function is called
            if (!rowRef.current) {
                return;
            }

            // If width of container has changed then scroll bar position will be out of sync
            // so we need to force a scroll correction
            const forceScrollCorrection = rowRef.current.offsetWidth !== widthRef.current;

            heightRef.current = changedHeight;

            props.onHeightChange(props.itemId, changedHeight, forceScrollCorrection);
        }, RESIZE_DEBOUNCE_TIME);

        function itemRowSizeObserverCallback(changedHeight: number) {
            if (!rowRef.current) {
                return;
            }

            if (changedHeight !== heightRef.current) {
                debouncedOnHeightChange(changedHeight);
            }
        }

        let cleanupSizeObserver: () => void;

        // We add the observer here to a row
        if (rowRef.current) {
            cleanupSizeObserver = listItemSizeObserver.observe(props.itemId, rowRef.current, itemRowSizeObserverCallback);
        }

        return () => {
            // We remove the observer here from a row
            cleanupSizeObserver?.();
            debouncedOnHeightChange?.cancel();
            props.onUnmount(props.itemId, indexRef.current);
        };
    }, [props.itemId]);

    return (
        <div
            ref={rowRef}
            role='listitem'
            className='item_measurer'
        >
            {props.item}
        </div>
    );
};

export default memo(ListItem);
