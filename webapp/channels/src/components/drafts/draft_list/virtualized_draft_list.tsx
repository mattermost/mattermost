// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import debounce from 'lodash/debounce';
import type {CSSProperties} from 'react';
import React, {useMemo, useRef, useCallback, useEffect, memo} from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import {VariableSizeList} from 'react-window';

import type {UserProfile, UserStatus} from '@mattermost/types/users';

import type {Draft} from 'selectors/drafts';

import DraftRow from 'components/drafts/draft_row';

const OVERSCAN_ROW_COUNT = 6; // no. of rows
const ROW_HEIGHT_CHANGE_TOLERANCE = 4; // in px

const RESIZE_DEBOUNCE_TIME = 120; // in ms

type Props = {
    drafts: Draft[];
    currentUser: UserProfile;
    userDisplayName: string;
    userStatus: UserStatus['status'];
    draftRemotes: Record<string, boolean>;
}

export default function VirtualizedDraftList(props: Props) {
    const listRef = useRef<VariableSizeList>(null);
    const itemHeightCacheMap = useRef<Map<string, number>>(new Map());

    // Function to set row height after measurement, we also reset the list after setting the height
    const setRowHeight = useCallback((index: number, draftKey: string, size: number) => {
        const currentItemHeight = itemHeightCacheMap.current.get(draftKey);

        // If current height is not cached or if there is a significant difference, update the cache
        // This prevents layout thrashing when the height variations are small
        if (!currentItemHeight || (Math.abs(currentItemHeight - size) > ROW_HEIGHT_CHANGE_TOLERANCE)) {
            itemHeightCacheMap.current.set(draftKey, size);

            // Reset the list UI in response to the row height changing
            if (listRef.current) {
                listRef.current.resetAfterIndex(index);
            }
        }
    }, []);

    const getItemSize = useCallback((index: number) => {
        const draftKey = index < props.drafts.length ? props.drafts[index].key : '';
        return draftKey ? (itemHeightCacheMap.current.get(draftKey) || 0) : 0;
    }, [props.drafts]);

    const itemData = useMemo(() => ({
        drafts: props.drafts,
        userDisplayName: props.userDisplayName,
        draftRemotes: props.draftRemotes,
        currentUser: props.currentUser,
        userStatus: props.userStatus,
        setRowHeight,
    }), [props.drafts, props.userDisplayName, props.draftRemotes, props.currentUser, props.userStatus, setRowHeight]);

    return (
        <div className='DraftList Drafts__main'>
            <AutoSizer>
                {({height, width}) => (
                    <VariableSizeList
                        ref={listRef}
                        height={height}
                        width={width}
                        itemCount={props.drafts.length}
                        itemSize={getItemSize}
                        itemData={itemData}
                        overscanCount={OVERSCAN_ROW_COUNT}
                    >
                        {Row}
                    </VariableSizeList>
                )}
            </AutoSizer>
        </div>
    );
}

interface RowProps {
    index: number;
    style: CSSProperties;
    data: {
        drafts: Draft[];
        userDisplayName: string;
        draftRemotes: Record<string, boolean>;
        currentUser: UserProfile;
        userStatus: string;
        setRowHeight: (index: number, draftKey: string, size: number) => void;
    };
}

// Row component for dynamic height measurement
// This component is rendered for each visible draft item by react-window's virtualization
function RowComponent({index, style, data: {drafts, userDisplayName, draftRemotes, currentUser, userStatus, setRowHeight}}: RowProps) {
    const draft = drafts[index];

    // Reference to the DOM element we'll measure
    const rowRef = useRef<HTMLDivElement>(null);

    // These refs store the current values for use in callbacks
    // This prevents stale closures in the ResizeObserver callback
    // and ensures event handlers always have the latest values
    // we also update these refs whenever their source values change
    const indexRef = useRef(index);
    const draftKeyRef = useRef(draft.key);
    const setRowHeightRef = useRef(setRowHeight);
    useEffect(() => {
        indexRef.current = index;
        draftKeyRef.current = draft.key;
        setRowHeightRef.current = setRowHeight;
    }, [index, draft.key, setRowHeight]);

    // This effect performs the initial height measurement on first render
    // or whenever the draft content changes
    useEffect(() => {
        if (!rowRef.current) {
            return undefined;
        }

        // Use requestAnimationFrame to measure after the browser has painted
        const rafId = requestAnimationFrame(() => {
            if (!rowRef.current) {
                return;
            }

            const height = rowRef.current.getBoundingClientRect().height;

            // Inform the virtualized list about this row's height
            setRowHeight(index, draft.key, height);
        });

        return () => {
            cancelAnimationFrame(rafId);
        };
    }, [draft, setRowHeight, index]);

    // This effect sets up a ResizeObserver to track height changes on the row element
    useEffect(() => {
        if (!rowRef.current) {
            return undefined;
        }

        // Flag to track whether we're still observing (prevents updates after unmount)
        let isObservingResize = true;

        // Create a debounced function to update height measurements
        // This prevents excessive updates when height changes rapidly
        const debouncedUpdateHeight = debounce((height: number) => {
            if (!isObservingResize || !rowRef.current) {
                return;
            }

            // Notify the parent list about this row's height
            setRowHeightRef.current(
                indexRef.current,
                draftKeyRef.current,
                height,
            );
        }, RESIZE_DEBOUNCE_TIME);

        // This ResizeObserver API notifies us when the element's size changes
        const resizeObserver = new ResizeObserver((resizeEntries) => {
            if (!isObservingResize || !rowRef.current) {
                return;
            }

            // Since we're observing a single row, we can safely assume that the first entry is the one we want
            if (resizeEntries.length === 1 && resizeEntries[0].target === rowRef.current) {
                const height = resizeEntries[0].borderBoxSize[0].blockSize;
                debouncedUpdateHeight(height);
            }
        });

        // Start observing size changes on the row element
        resizeObserver.observe(rowRef.current);

        return () => {
            isObservingResize = false;
            debouncedUpdateHeight.cancel();
            resizeObserver.disconnect();
        };
    }, []);

    return (
        <div style={style}> {/* To avoid interference with virtualized list styles we are not using this div for height measurement */}
            <div
                ref={rowRef}
                className={classNames('virtualizedVariableListRowWrapper', {
                    firstRow: index === 0,
                })}
            >
                <DraftRow
                    key={draft.key}
                    item={draft.value}
                    displayName={userDisplayName}
                    user={currentUser}
                    status={userStatus}
                    isRemote={draftRemotes?.[draft.key]}
                />
            </div>
        </div>
    );
}

const Row = memo(RowComponent);
