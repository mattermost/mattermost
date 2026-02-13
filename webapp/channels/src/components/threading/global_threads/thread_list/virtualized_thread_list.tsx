// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback, useEffect, useMemo, useRef} from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import {VariableSizeList} from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';

import type {UserThread} from '@mattermost/types/threads';

import ThreadsConstants from 'mattermost-redux/constants/threads';

import {Constants} from 'utils/constants';

import Row from './virtualized_thread_list_row';

// Default height for regular threads, page threads may need more
export const DEFAULT_ROW_HEIGHT = 133;
export const PAGE_THREAD_ROW_HEIGHT = 160;

export type ThreadData = {
    ids: string[];
    selectedThreadId: string | undefined;
    setRowHeight: (index: number, height: number) => void;
};

type Props = {
    ids: Array<UserThread['id']>;
    loadMoreItems: (startIndex: number, stopIndex: number) => Promise<any>;
    selectedThreadId?: UserThread['id'];
    total: number;
    isLoading?: boolean;
    addNoMoreResultsItem?: boolean;
};

const style = {
    willChange: 'auto',
};

function VirtualizedThreadList({
    ids,
    selectedThreadId,
    loadMoreItems,
    total,
    isLoading,
    addNoMoreResultsItem,
}: Props) {
    const infiniteLoaderRef = React.useRef<any>();
    const listRef = useRef<VariableSizeList>(null);
    const startIndexRef = React.useRef<number>(0);
    const stopIndexRef = React.useRef<number>(0);
    const rowHeightsRef = useRef<{[key: number]: number}>({});

    const getRowHeight = useCallback((index: number) => {
        return rowHeightsRef.current[index] || DEFAULT_ROW_HEIGHT;
    }, []);

    const setRowHeight = useCallback((index: number, height: number) => {
        if (rowHeightsRef.current[index] !== height) {
            rowHeightsRef.current[index] = height;
            listRef.current?.resetAfterIndex(index);
        }
    }, []);

    useEffect(() => {
        if (ids.length > 0 && selectedThreadId) {
            const index = ids.indexOf(selectedThreadId);
            if (startIndexRef.current >= index || index > stopIndexRef.current) {
                // eslint-disable-next-line no-underscore-dangle
                infiniteLoaderRef.current?._listRef.scrollToItem(index);
            }
        }

        // ids should not be on the dependency list as
        // it will auto scroll to selected item upon
        // infinite loading
        // when the selectedThreadId changes it will get
        // the new ids so no issue there
    }, [selectedThreadId]);

    const data: ThreadData = useMemo(
        () => (
            {
                ids: addNoMoreResultsItem && ids.length === total ? [...ids, Constants.THREADS_NO_RESULTS_ITEM_ID] : (isLoading && ids.length !== total && [...ids, Constants.THREADS_LOADING_INDICATOR_ITEM_ID]) || ids,
                selectedThreadId,
                setRowHeight,
            }
        ),
        [ids, selectedThreadId, isLoading, addNoMoreResultsItem, total, setRowHeight],
    );

    const itemKey = useCallback((index: number, data: ThreadData) => data.ids[index], []);

    const isItemLoaded = useCallback((index: number) => {
        return ids.length === total || index < ids.length;
    }, [ids, total]);

    return (
        <AutoSizer>
            {({height, width}) => (
                <InfiniteLoader
                    ref={infiniteLoaderRef}
                    itemCount={total}
                    loadMoreItems={loadMoreItems}
                    isItemLoaded={isItemLoaded}
                    minimumBatchSize={ThreadsConstants.THREADS_PAGE_SIZE}
                >
                    {({onItemsRendered, ref}) => {
                        return (
                            <VariableSizeList
                                onItemsRendered={({
                                    overscanStartIndex,
                                    overscanStopIndex,
                                    visibleStartIndex,
                                    visibleStopIndex,
                                }) => {
                                    onItemsRendered({
                                        overscanStartIndex,
                                        overscanStopIndex,
                                        visibleStartIndex,
                                        visibleStopIndex,
                                    });
                                    startIndexRef.current = visibleStartIndex;
                                    stopIndexRef.current = visibleStopIndex;
                                }}
                                ref={(instance) => {
                                    // Store ref locally and pass to InfiniteLoader
                                    (listRef as React.MutableRefObject<VariableSizeList | null>).current = instance;
                                    if (typeof ref === 'function') {
                                        ref(instance);
                                    } else if (ref) {
                                        (ref as React.MutableRefObject<VariableSizeList | null>).current = instance;
                                    }
                                }}
                                height={height}
                                itemCount={data.ids.length}
                                itemData={data}
                                itemKey={itemKey}
                                itemSize={getRowHeight}
                                estimatedItemSize={DEFAULT_ROW_HEIGHT}
                                style={style}
                                width={width}
                                className='virtualized-thread-list'
                            >
                                {Row}
                            </VariableSizeList>
                        );
                    }
                    }
                </InfiniteLoader>
            )}
        </AutoSizer>
    );
}

function areEqual(prevProps: Props, nextProps: Props) {
    return (
        prevProps.selectedThreadId === nextProps.selectedThreadId &&
        prevProps.ids.join() === nextProps.ids.join() &&
        prevProps.isLoading === nextProps.isLoading &&
        prevProps.addNoMoreResultsItem === nextProps.addNoMoreResultsItem
    );
}

export default memo(VirtualizedThreadList, areEqual);
