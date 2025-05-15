// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import debounce from 'lodash/debounce';
import type {ReactNode} from 'react';
import React, {memo, useEffect, useRef} from 'react';

import {ListItemSizeObserver} from './item_row_size_observer';

const RESIZE_DEBOUNCE_TIME = 200; // in ms

const listItemSizeObserver = new ListItemSizeObserver();

export function cleanupSharedObserver(): void {
    listItemSizeObserver.disconnect();
}

interface Props {
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

    const itemIdRef = useRef(props.itemId);
    const heightRef = useRef(props.height);
    const widthRef = useRef(props.width);
    const indexRef = useRef(props.index);

    // This prevents stale closures in the ResizeObserver callback
    // and ensures event handlers always have the latest values
    // we also update these refs whenever their source values change
    useEffect(() => {
        heightRef.current = props.height;
        widthRef.current = props.width;
        itemIdRef.current = props.itemId;
        indexRef.current = props.index;
    }, [props.itemId, props.height, props.width, props.index]);

    // This effect is used to measure the height of the row as soon as the component mounts
    useEffect(() => {
        const newHeight = Math.ceil(rowRef?.current?.offsetHeight ?? 0);
        props.onHeightChange(itemIdRef.current, newHeight, false);
    }, []);

    useEffect(() => {
        const debouncedOnHeightChange = debounce((changedHeight: number) => {
            // If width of container has changed then scroll bar position will be out of sync
            // so we need to force a scroll correction
            const forceScrollCorrection = rowRef.current?.offsetWidth !== widthRef.current;

            heightRef.current = changedHeight;

            props.onHeightChange(itemIdRef.current, changedHeight, forceScrollCorrection);
        }, RESIZE_DEBOUNCE_TIME);

        function itemRowSizeObserverCallback(changedHeight: number) {
            if (!rowRef.current) {
                return;
            }

            if (changedHeight !== heightRef.current) {
                debouncedOnHeightChange(changedHeight);
            }
        }

        if (rowRef.current) {
            listItemSizeObserver.observe(itemIdRef.current, rowRef.current, itemRowSizeObserverCallback);
        }

        return () => {
            listItemSizeObserver.unobserve(itemIdRef.current);
            props.onUnmount(itemIdRef.current, indexRef.current);
        };
    }, []);

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
