// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import debounce from 'lodash/debounce';
import type {CSSProperties} from 'react';
import React, {useMemo, useRef, useCallback, useEffect} from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import {VariableSizeList} from 'react-window';

import type {ScheduledPost} from '@mattermost/types/schedule_post';
import type {UserProfile, UserStatus} from '@mattermost/types/users';

import DraftRow from 'components/drafts/draft_row';

import {useQuery} from 'utils/http_utils';

const TARGET_ID_QUERY_PARAM = 'target_id';
const OVERSCAN_ROW_COUNT = 10; // no. of rows
const ROW_HEIGHT_CHANGE_TOLERANCE = 2; // in px

const FRAME_RATE = 60; // in Hz
const RESIZE_DEBOUNCE_TIME = Math.round(1000 / FRAME_RATE); // in ms

type Props = {
    scheduledPosts: ScheduledPost[];
    currentUser: UserProfile;
    userDisplayName: string;
    userStatus: UserStatus['status'];
}

export default function ScheduledPostList(props: Props) {
    const query = useQuery();
    const scheduledPostTargetId = query.get(TARGET_ID_QUERY_PARAM);
    const targetScheduledPostId = useRef<string>();
    const listRef = useRef<VariableSizeList>(null);
    const itemHeightCacheMap = useRef<Map<string, number>>(new Map());

    // Function to set row height after measurement, we also reset the list after setting the height
    const setRowHeight = useCallback((index: number, postId: string, size: number) => {
        const currentItemHeight = itemHeightCacheMap.current.get(postId);

        // If current height is not cached or if there is a significant difference, update the cache
        // This prevents layout thrashing when the height variations are small
        if (!currentItemHeight || Math.abs(currentItemHeight - size) > ROW_HEIGHT_CHANGE_TOLERANCE) {
            itemHeightCacheMap.current.set(postId, size);

            // Reset the list UI in response to the row height changing
            if (listRef.current) {
                listRef.current.resetAfterIndex(index);
            }
        }
    }, []);

    const getItemSize = useCallback((index: number) => {
        const postId = index < props.scheduledPosts.length ? props.scheduledPosts[index].id : '';
        return postId ? (itemHeightCacheMap.current.get(postId) || 0) : 0;
    }, [props.scheduledPosts]);

    // Update cached sizes when list items change
    useEffect(() => {
        if (itemHeightCacheMap.current.size > 0) {
            const updatedItemHeightCacheMap = new Map<string, number>();

            // Only keep height entries for items that still exist
            for (const post of props.scheduledPosts) {
                const height = itemHeightCacheMap.current.get(post.id);
                if (height) {
                    updatedItemHeightCacheMap.set(post.id, height);
                }
            }

            // Replace the old height cache with the new one
            itemHeightCacheMap.current = updatedItemHeightCacheMap;
        }

        // Reset list UI in response to list items changing
        if (listRef.current) {
            listRef.current.resetAfterIndex(0);
        }
    }, [props.scheduledPosts]);

    // Find the target post index for scrolling
    useEffect(() => {
        if (!scheduledPostTargetId || !listRef.current) {
            return;
        }

        // Find the target post index
        const targetIndex = props.scheduledPosts.findIndex((post) => {
            const isInTargetChannelOrThread = post.channel_id === scheduledPostTargetId || post.root_id === scheduledPostTargetId;
            const hasError = Boolean(post.error_code);
            return isInTargetChannelOrThread && !hasError && !targetScheduledPostId.current;
        });

        if (targetIndex !== -1) {
            targetScheduledPostId.current = props.scheduledPosts[targetIndex].id;
            listRef.current.scrollToItem(targetIndex, 'center');
        }
    }, [props.scheduledPosts, scheduledPostTargetId]);

    const itemData = useMemo(() => ({
        scheduledPosts: props.scheduledPosts,
        userDisplayName: props.userDisplayName,
        currentUser: props.currentUser,
        userStatus: props.userStatus,
        setRowHeight,
        targetScheduledPostId: targetScheduledPostId.current,
        scheduledPostTargetId,
    }), [props.scheduledPosts, props.userDisplayName, props.currentUser, props.userStatus, setRowHeight, scheduledPostTargetId]);

    return (
        <AutoSizer>
            {({height, width}) => (
                <VariableSizeList
                    ref={listRef}
                    height={height}
                    width={width}
                    itemCount={props.scheduledPosts.length}
                    itemSize={getItemSize}
                    itemData={itemData}
                    overscanCount={OVERSCAN_ROW_COUNT}
                >
                    {Row}
                </VariableSizeList>
            )}
        </AutoSizer>
    );
}

interface RowProps {
    index: number;
    style: CSSProperties;
    data: {
        scheduledPosts: ScheduledPost[];
        userDisplayName: string;
        currentUser: UserProfile;
        userStatus: string;
        setRowHeight: (index: number, postId: string, size: number) => void;
        targetScheduledPostId?: string;
        scheduledPostTargetId?: string | null;
    };
}

// Row component for dynamic height measurement
function Row({index, style, data: {scheduledPosts, userDisplayName, currentUser, userStatus, setRowHeight, targetScheduledPostId, scheduledPostTargetId}}: RowProps) {
    const scheduledPost = scheduledPosts[index];

    // Reference to the DOM element we'll measure
    const rowRef = useRef<HTMLDivElement>(null);

    // Cache the last measured height to avoid unnecessary updates
    const lastMeasuredHeightRef = useRef<number | null>(null);

    // These refs store the current values for use in callbacks
    const indexRef = useRef(index);
    const postIdRef = useRef(scheduledPost.id);
    const setRowHeightRef = useRef(setRowHeight);
    useEffect(() => {
        indexRef.current = index;
        postIdRef.current = scheduledPost.id;
        setRowHeightRef.current = setRowHeight;
    }, [index, scheduledPost.id, setRowHeight]);

    // Calculate if this row should scroll into view
    const isInTargetChannelOrThread = scheduledPost.channel_id === scheduledPostTargetId || scheduledPost.root_id === scheduledPostTargetId;
    const hasError = Boolean(scheduledPost.error_code);
    const scrollIntoView = targetScheduledPostId === scheduledPost.id || (isInTargetChannelOrThread && !hasError && !targetScheduledPostId);

    // This effect performs the initial height measurement on first render
    useEffect(() => {
        if (!rowRef.current) {
            return undefined;
        }

        // Use requestAnimationFrame to measure after the browser has painted
        const rafId = requestAnimationFrame(() => {
            if (!rowRef.current) {
                return;
            }

            // Get the rendered height and enforce minimum height
            const height = Math.max(rowRef.current.getBoundingClientRect().height);
            lastMeasuredHeightRef.current = height;

            // Inform the virtualized list about this row's height
            setRowHeight(index, scheduledPost.id, height);
        });

        return () => {
            cancelAnimationFrame(rafId);
        };
    }, [scheduledPost, setRowHeight, index, scheduledPost.id]);

    // This effect sets up a ResizeObserver to track height changes on the row element
    useEffect(() => {
        if (!rowRef.current) {
            return undefined;
        }

        // Flag to track whether we're still observing (prevents updates after unmount)
        let isObservingResize = true;

        // Create a debounced function to update height measurements
        const debouncedUpdateHeight = debounce((height: number) => {
            // Skip if component was unmounted or ref is gone
            if (!isObservingResize || !rowRef.current) {
                return;
            }

            // Skip if the height hasn't changed significantly
            if (lastMeasuredHeightRef.current !== null && Math.abs((lastMeasuredHeightRef.current - height)) <= ROW_HEIGHT_CHANGE_TOLERANCE) {
                return;
            }

            // Update our cached height
            lastMeasuredHeightRef.current = height;

            // Notify the parent list about the new height
            setRowHeightRef.current(
                indexRef.current,
                postIdRef.current,
                height,
            );
        }, RESIZE_DEBOUNCE_TIME);

        // This ResizeObserver API notifies us when the element's size changes
        const resizeObserver = new ResizeObserver((entries) => {
            if (!isObservingResize || !rowRef.current) {
                return;
            }

            // Process all resize entries (typically just one)
            for (const entry of entries) {
                // Double-check that the entry is for our element
                if (entry.target === rowRef.current) {
                    // Get the new content height and enforce minimum
                    const height = entry.borderBoxSize[0].blockSize;

                    // Update height with debouncing to prevent layout thrashing
                    debouncedUpdateHeight(height);
                }
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
        <div style={style}>
            <div
                ref={rowRef}
                className={classNames('virtualizedVariableListRowWrapper', {
                    firstRow: index === 0,
                })}
            >
                <DraftRow
                    key={scheduledPost.id}
                    item={scheduledPost}
                    displayName={userDisplayName}
                    user={currentUser}
                    status={userStatus}
                    scrollIntoView={scrollIntoView}
                />
            </div>
        </div>
    );
}
