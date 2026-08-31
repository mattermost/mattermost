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
const OVERSCAN_ROW_COUNT = 10;
const ROW_HEIGHT_CHANGE_TOLERANCE = 2;

const SCROLL_ECHO_TOLERANCE = 4;

export function isUserInitiatedScroll(
    scrollUpdateWasRequested: boolean,
    scrollOffset: number,
    lastRequestedScrollOffset: number | null,
): boolean {
    if (scrollUpdateWasRequested) {
        return false;
    }

    if (lastRequestedScrollOffset === null) {
        return false;
    }

    return Math.abs(scrollOffset - lastRequestedScrollOffset) > SCROLL_ECHO_TOLERANCE;
}

// Estimate for rows that haven't been measured yet so react-window can compute
// approximate offsets and scroll to a far-down target before it has rendered.
const ESTIMATED_ROW_HEIGHT = 91;

const FRAME_RATE = 60;
const RESIZE_DEBOUNCE_TIME = Math.round(1000 / FRAME_RATE);

function getInitialScrollOffset(targetIndex: number, viewportHeight: number) {
    if (targetIndex <= 0) {
        return 0;
    }

    return Math.max(0, ((targetIndex * ESTIMATED_ROW_HEIGHT) - (viewportHeight / 2)) + (ESTIMATED_ROW_HEIGHT / 2));
}

type Props = {
    scheduledPosts: ScheduledPost[];
    currentUser: UserProfile;
    userDisplayName: string;
    userStatus: UserStatus['status'];
};

export default function ScheduledPostList(props: Props) {
    const query = useQuery();
    const scheduledPostTargetId = query.get(TARGET_ID_QUERY_PARAM);
    const listRef = useRef<VariableSizeList>(null);
    const itemHeightCacheMap = useRef<Map<string, number>>(new Map());
    const hasScrolledToTarget = useRef(false);
    const userHasScrolled = useRef(false);
    const lastRequestedScrollOffset = useRef<number | null>(null);

    const targetIndex = useMemo(() => {
        if (!scheduledPostTargetId) {
            return -1;
        }

        return props.scheduledPosts.findIndex((post) => {
            const isInTargetChannelOrThread = post.channel_id === scheduledPostTargetId || post.root_id === scheduledPostTargetId;
            return isInTargetChannelOrThread && !post.error_code;
        });
    }, [props.scheduledPosts, scheduledPostTargetId]);

    const targetPostId = targetIndex === -1 ? undefined : props.scheduledPosts[targetIndex].id;

    const targetIndexRef = useRef(targetIndex);
    useEffect(() => {
        targetIndexRef.current = targetIndex;
    }, [targetIndex]);

    const setRowHeight = useCallback((index: number, postId: string, size: number) => {
        const currentItemHeight = itemHeightCacheMap.current.get(postId);

        if (currentItemHeight && Math.abs(currentItemHeight - size) <= ROW_HEIGHT_CHANGE_TOLERANCE) {
            return;
        }

        itemHeightCacheMap.current.set(postId, size);

        if (!listRef.current) {
            return;
        }

        listRef.current.resetAfterIndex(index);

        // Re-center the target once nearby rows are measured, since their real
        // heights differ from the estimate used for the initial scroll. Without
        // this the list lands a row off from the target. Stops once the user scrolls.
        const target = targetIndexRef.current;
        if (target >= 0 && index <= target && !userHasScrolled.current) {
            listRef.current.scrollToItem(target, 'center');
        }
    }, []);

    const getItemSize = useCallback((index: number) => {
        const postId = index < props.scheduledPosts.length ? props.scheduledPosts[index].id : '';
        if (!postId) {
            return 0;
        }
        return itemHeightCacheMap.current.get(postId) || ESTIMATED_ROW_HEIGHT;
    }, [props.scheduledPosts]);

    useEffect(() => {
        if (itemHeightCacheMap.current.size > 0) {
            const updatedItemHeightCacheMap = new Map<string, number>();

            for (const post of props.scheduledPosts) {
                const height = itemHeightCacheMap.current.get(post.id);
                if (height) {
                    updatedItemHeightCacheMap.set(post.id, height);
                }
            }

            itemHeightCacheMap.current = updatedItemHeightCacheMap;
        }

        if (listRef.current) {
            listRef.current.resetAfterIndex(0);
        }
    }, [props.scheduledPosts]);

    // Scroll to the target when posts arrive after mount. The first paint is
    // handled by initialScrollOffset, since the list ref isn't available until
    // AutoSizer has measured. setRowHeight then re-centers precisely.
    useEffect(() => {
        if (targetIndex === -1 || !listRef.current || hasScrolledToTarget.current) {
            return;
        }

        hasScrolledToTarget.current = true;
        listRef.current.scrollToItem(targetIndex, 'center');
    }, [props.scheduledPosts, targetIndex]);

    const handleScroll = useCallback(({scrollOffset, scrollUpdateWasRequested}: {scrollOffset: number; scrollUpdateWasRequested: boolean}) => {
        if (scrollUpdateWasRequested) {
            lastRequestedScrollOffset.current = scrollOffset;
            return;
        }

        if (isUserInitiatedScroll(scrollUpdateWasRequested, scrollOffset, lastRequestedScrollOffset.current)) {
            userHasScrolled.current = true;
        }
    }, []);

    const itemData = useMemo(() => ({
        scheduledPosts: props.scheduledPosts,
        userDisplayName: props.userDisplayName,
        currentUser: props.currentUser,
        userStatus: props.userStatus,
        setRowHeight,
        targetPostId,
    }), [props.scheduledPosts, props.userDisplayName, props.currentUser, props.userStatus, setRowHeight, targetPostId]);

    return (
        <div className='ScheduledPostList__main'>
            <AutoSizer>
                {({height, width}) => (
                    <VariableSizeList
                        ref={listRef}
                        height={height}
                        width={width}
                        itemCount={props.scheduledPosts.length}
                        itemSize={getItemSize}
                        estimatedItemSize={ESTIMATED_ROW_HEIGHT}
                        initialScrollOffset={getInitialScrollOffset(targetIndex, height)}
                        itemData={itemData}
                        overscanCount={OVERSCAN_ROW_COUNT}
                        onScroll={handleScroll}
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
        scheduledPosts: ScheduledPost[];
        userDisplayName: string;
        currentUser: UserProfile;
        userStatus: string;
        setRowHeight: (index: number, postId: string, size: number) => void;
        targetPostId?: string;
    };
}

function Row({index, style, data: {scheduledPosts, userDisplayName, currentUser, userStatus, setRowHeight, targetPostId}}: RowProps) {
    const scheduledPost = scheduledPosts[index];

    const rowRef = useRef<HTMLDivElement>(null);
    const lastMeasuredHeightRef = useRef<number | null>(null);

    const indexRef = useRef(index);
    const postIdRef = useRef(scheduledPost.id);
    const setRowHeightRef = useRef(setRowHeight);
    useEffect(() => {
        indexRef.current = index;
        postIdRef.current = scheduledPost.id;
        setRowHeightRef.current = setRowHeight;
    }, [index, scheduledPost.id, setRowHeight]);

    const isTarget = targetPostId === scheduledPost.id;

    useEffect(() => {
        if (!rowRef.current) {
            return undefined;
        }

        const rafId = requestAnimationFrame(() => {
            if (!rowRef.current) {
                return;
            }

            const height = rowRef.current.getBoundingClientRect().height;
            lastMeasuredHeightRef.current = height;
            setRowHeight(index, scheduledPost.id, height);
        });

        return () => {
            cancelAnimationFrame(rafId);
        };
    }, [scheduledPost, setRowHeight, index, scheduledPost.id]);

    useEffect(() => {
        if (!rowRef.current) {
            return undefined;
        }

        let isObservingResize = true;

        const debouncedUpdateHeight = debounce((height: number) => {
            if (!isObservingResize || !rowRef.current) {
                return;
            }

            if (lastMeasuredHeightRef.current !== null && Math.abs((lastMeasuredHeightRef.current - height)) <= ROW_HEIGHT_CHANGE_TOLERANCE) {
                return;
            }

            lastMeasuredHeightRef.current = height;
            setRowHeightRef.current(indexRef.current, postIdRef.current, height);
        }, RESIZE_DEBOUNCE_TIME);

        const resizeObserver = new ResizeObserver((entries) => {
            if (!isObservingResize || !rowRef.current) {
                return;
            }

            for (const entry of entries) {
                if (entry.target === rowRef.current) {
                    debouncedUpdateHeight(entry.borderBoxSize[0].blockSize);
                }
            }
        });

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
                    highlight={isTarget}
                />
            </div>
        </div>
    );
}
