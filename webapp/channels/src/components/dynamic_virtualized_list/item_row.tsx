// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import debounce from 'lodash/debounce';
import type {ReactNode} from 'react';
import React, {memo, useEffect, useRef} from 'react';

const RESIZE_DEBOUNCE_TIME = 120; // in ms

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
 */
const ItemRow = (props: Props) => {
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
        const debouncedOnHeightChange = debounce((height: number) => {
            // If width of container has changed then scroll bar position will be out of sync
            // so we need to force a scroll correction
            const forceScrollCorrection = rowRef.current?.offsetWidth !== widthRef.current;

            heightRef.current = height;

            props.onHeightChange(itemIdRef.current, height, forceScrollCorrection);
        }, RESIZE_DEBOUNCE_TIME);

        function resizeObserverCallback(resizeEntries: ResizeObserverEntry[]) {
            if (!rowRef.current) {
                return;
            }

            // Since we're observing a single row, we can safely assume that the first entry is the one we want
            if (resizeEntries.length === 1 && resizeEntries[0].target === rowRef.current) {
                const newHeight = Math.ceil(resizeEntries[0].borderBoxSize[0].blockSize);

                // If the height has changed significantly, update the height
                if (newHeight !== heightRef.current) {
                    debouncedOnHeightChange(newHeight);
                }
            }
        }

        const resizeObserver = new ResizeObserver(resizeObserverCallback);

        if (rowRef.current) {
            resizeObserver.observe(rowRef.current);
        }

        return () => {
            resizeObserver.disconnect();

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

export default memo(ItemRow);
