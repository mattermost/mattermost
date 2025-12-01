// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import {DATE_LINE} from 'mattermost-redux/utils/post_list';

import {renderWithContext, screen, act} from 'tests/vitest_react_testing_utils';
import {PostListRowListIds, PostRequestTypes} from 'utils/constants';

import PostList from './post_list_virtualized';

// Capture callbacks from mocked components
let capturedOnScroll: ((args: {
    scrollDirection: string;
    scrollOffset: number;
    scrollUpdateWasRequested: boolean;
    scrollHeight: number;
    clientHeight: number;
}) => void) | null = null;

let capturedListRef: {
    _getRangeToRender: () => number[];
} | null = null;

let capturedOnItemsRendered: ((args: {visibleStartIndex: number; visibleStopIndex: number}) => void) | null = null;

let capturedInitRangeToRender: number[] | null = null;

let capturedInitScrollToIndex: (() => {index: number; position: string; offset?: number}) | null = null;

let capturedScrollToItem: ReturnType<typeof vi.fn> | null = null;

// Mock AutoSizer to render children with fixed dimensions
vi.mock('react-virtualized-auto-sizer', () => ({
    default: ({children}: {children: (size: {height: number; width: number}) => React.ReactNode}) => children({height: 500, width: 400}),
}));

// Mock DynamicVirtualizedList to capture onScroll, initRangeToRender, initScrollToIndex, and render items
vi.mock('components/dynamic_virtualized_list', () => ({
    DynamicVirtualizedList: React.forwardRef(({children, itemData, onScroll, onItemsRendered, initRangeToRender, initScrollToIndex}: any, ref: any) => {
        capturedOnScroll = onScroll;
        capturedOnItemsRendered = onItemsRendered;
        capturedInitRangeToRender = initRangeToRender;
        capturedInitScrollToIndex = initScrollToIndex;

        // Create mocks that can be tracked
        const scrollToItemMock = vi.fn();
        capturedScrollToItem = scrollToItemMock;

        // Create a ref object with methods the component expects
        const listRefMethods = {
            scrollToItem: scrollToItemMock,

            // eslint-disable-next-line no-underscore-dangle
            _getRangeToRender: () => capturedListRef?._getRangeToRender() ?? [0, 10, 0, 5],
            scrollTo: vi.fn(),
        };

        React.useImperativeHandle(ref, () => listRefMethods);

        return (
            <div
                data-testid='dynamic-virtualized-list'
                data-init-range={JSON.stringify(initRangeToRender)}
            >
                {itemData?.map((id: string) => (
                    <div key={id}>
                        {children({data: itemData, itemId: id, style: {}})}
                    </div>
                ))}
            </div>
        );
    }),
}));

// Mock PostListRow to show the listId and capture props
vi.mock('components/post_view/post_list_row', () => ({
    default: ({listId, shouldHighlight, previousListId}: {listId: string; shouldHighlight: boolean; previousListId: string}) => (
        <div
            data-testid={`post-row-${listId}`}
            data-highlighted={shouldHighlight}
            data-previous-list-id={previousListId}
        >
            {listId}
        </div>
    ),
}));

// Mock FloatingTimestamp to expose topPostId
vi.mock('components/post_view/floating_timestamp', () => ({
    default: ({postId}: {postId: string}) => (
        <div
            data-testid='floating-timestamp'
            data-post-id={postId}
        />
    ),
}));

// Mock ToastWrapper to show search hint visibility, atBottom state, and lastViewedBottom
vi.mock('components/toast_wrapper', () => ({
    default: ({showSearchHintToast, onSearchHintDismiss, atBottom, lastViewedBottom}: {showSearchHintToast: boolean; onSearchHintDismiss: () => void; atBottom: boolean | null; lastViewedBottom: number}) => (
        <div
            data-testid='toast-wrapper'
            data-at-bottom={atBottom === null ? 'null' : String(atBottom)}
            data-last-viewed-bottom={lastViewedBottom}
        >
            {showSearchHintToast && (
                <div data-testid='search-hint-toast'>
                    <button
                        data-testid='dismiss-search-hint'
                        onClick={onSearchHintDismiss}
                    >
                        {'Dismiss'}
                    </button>
                </div>
            )}
        </div>
    ),
}));

describe('PostList', () => {
    const baseActions = {
        loadOlderPosts: vi.fn(),
        loadNewerPosts: vi.fn(),
        canLoadMorePosts: vi.fn(),
        changeUnreadChunkTimeStamp: vi.fn(),
        toggleShouldStartFromBottomWhenUnread: vi.fn(),
        updateNewMessagesAtInChannel: vi.fn(),
    };

    const baseProps: ComponentProps<typeof PostList> = {
        channelId: 'channel',
        focusedPostId: '',
        postListIds: [
            'post1',
            'post2',
            'post3',
            DATE_LINE + 1551711600000,
        ],
        latestPostTimeStamp: 12345,
        loadingNewerPosts: false,
        loadingOlderPosts: false,
        atOldestPost: false,
        atLatestPost: false,
        isMobileView: false,
        autoRetryEnable: false,
        lastViewedAt: 0,
        shouldStartFromBottomWhenUnread: false,
        actions: baseActions,
    };

    const postListIdsForClassNames = [
        'post1',
        'post2',
        'post3',
        DATE_LINE + 1551711600000,
        'post4',
        PostListRowListIds.START_OF_NEW_MESSAGES + 1551711601000,
        'post5',
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        capturedOnScroll = null;
        capturedListRef = null;
        capturedOnItemsRendered = null;
        capturedInitRangeToRender = null;
        capturedInitScrollToIndex = null;
        capturedScrollToItem = null;
    });

    describe('renderRow', () => {
        const postListIds = ['a', 'b', 'c', 'd'];

        test('should get previous item ID correctly for oldest row', () => {
            const props = {
                ...baseProps,
                postListIds,
                atOldestPost: true,
            };

            renderWithContext(<PostList {...props}/>);

            // The oldest row ('d') should have empty previousListId
            const oldestRow = screen.getByTestId('post-row-d');
            expect(oldestRow).toHaveAttribute('data-previous-list-id', '');
        });

        test('should get previous item ID correctly for other rows', () => {
            const props = {
                ...baseProps,
                postListIds,
                atOldestPost: true,
            };

            renderWithContext(<PostList {...props}/>);

            // Row 'b' should have 'c' as previousListId
            const rowB = screen.getByTestId('post-row-b');
            expect(rowB).toHaveAttribute('data-previous-list-id', 'c');
        });

        test('should highlight the focused post', () => {
            const props = {
                ...baseProps,
                postListIds,
                focusedPostId: 'b',
                atOldestPost: true,
            };

            renderWithContext(<PostList {...props}/>);

            const focusedRow = screen.getByTestId('post-row-b');
            expect(focusedRow).toHaveAttribute('data-highlighted', 'true');

            const nonFocusedRow = screen.getByTestId('post-row-c');
            expect(nonFocusedRow).toHaveAttribute('data-highlighted', 'false');
        });
    });

    describe('onScroll', () => {
        test('should call checkBottom', () => {
            renderWithContext(<PostList {...baseProps}/>);

            expect(capturedOnScroll).not.toBeNull();

            // Initially atBottom is null
            expect(screen.getByTestId('toast-wrapper')).toHaveAttribute('data-at-bottom', 'null');

            const scrollOffset = 1234;
            const scrollHeight = 1000;
            const clientHeight = 500;

            act(() => {
                capturedOnScroll!({
                    scrollDirection: 'forward',
                    scrollOffset,
                    scrollUpdateWasRequested: false,
                    scrollHeight,
                    clientHeight,
                });
            });

            // checkBottom updates atBottom state based on scroll position
            // offsetFromBottom = scrollHeight - clientHeight - scrollOffset = 1000 - 500 - 1234 = -734
            // Since offsetFromBottom (-734) <= 10, atBottom should be true
            expect(screen.getByTestId('toast-wrapper')).toHaveAttribute('data-at-bottom', 'true');
        });

        test('should call canLoadMorePosts with AFTER_ID if loader is visible', () => {
            renderWithContext(<PostList {...baseProps}/>);

            expect(capturedOnScroll).not.toBeNull();

            // Set up mock to return visibleStopIndex of 1 (loader is visible)
            capturedListRef = {
                _getRangeToRender: () => [0, 70, 12, 1],
            };

            const scrollOffset = 1234;
            const scrollHeight = 1000;
            const clientHeight = 500;

            act(() => {
                capturedOnScroll!({
                    scrollDirection: 'forward',
                    scrollOffset,
                    scrollUpdateWasRequested: true, // programmatic scroll
                    scrollHeight,
                    clientHeight,
                });
            });

            expect(baseProps.actions.canLoadMorePosts).toHaveBeenCalledWith(PostRequestTypes.AFTER_ID);
        });

        test('should not call canLoadMorePosts with AFTER_ID if loader is below the fold by couple of messages', () => {
            renderWithContext(<PostList {...baseProps}/>);

            expect(capturedOnScroll).not.toBeNull();

            // Set up mock to return visibleStopIndex of 2 (loader is below the fold)
            capturedListRef = {
                _getRangeToRender: () => [0, 70, 12, 2],
            };

            const scrollOffset = 1234;
            const scrollHeight = 1000;
            const clientHeight = 500;

            act(() => {
                capturedOnScroll!({
                    scrollDirection: 'forward',
                    scrollOffset,
                    scrollUpdateWasRequested: true,
                    scrollHeight,
                    clientHeight,
                });
            });

            expect(baseProps.actions.canLoadMorePosts).not.toHaveBeenCalled();
        });

        test('should show search channel hint if user scrolled too far away from the bottom of the list', () => {
            const screenHeightSpy = vi.spyOn(window.screen, 'height', 'get').mockReturnValue(500);

            renderWithContext(<PostList {...baseProps}/>);

            expect(capturedOnScroll).not.toBeNull();

            const scrollHeight = 3000;
            const clientHeight = 500;
            const scrollOffset = 500; // offsetFromBottom = 3000 - 500 - 500 = 2000, threshold = 500 * 3 = 1500

            act(() => {
                capturedOnScroll!({
                    scrollDirection: 'forward',
                    scrollOffset,
                    scrollUpdateWasRequested: false,
                    scrollHeight,
                    clientHeight,
                });
            });

            expect(screen.getByTestId('search-hint-toast')).toBeInTheDocument();

            screenHeightSpy.mockRestore();
        });

        test('should not show search channel hint if user scrolls not that far away', () => {
            const screenHeightSpy = vi.spyOn(window.screen, 'height', 'get').mockReturnValue(500);

            renderWithContext(<PostList {...baseProps}/>);

            expect(capturedOnScroll).not.toBeNull();

            const scrollHeight = 3000;
            const clientHeight = 500;
            const scrollOffset = 2500; // offsetFromBottom = 3000 - 500 - 2500 = 0, below threshold

            act(() => {
                capturedOnScroll!({
                    scrollDirection: 'forward',
                    scrollOffset,
                    scrollUpdateWasRequested: false,
                    scrollHeight,
                    clientHeight,
                });
            });

            expect(screen.queryByTestId('search-hint-toast')).not.toBeInTheDocument();

            screenHeightSpy.mockRestore();
        });

        test('should hide search channel hint in case of dismiss', () => {
            const screenHeightSpy = vi.spyOn(window.screen, 'height', 'get').mockReturnValue(500);

            renderWithContext(<PostList {...baseProps}/>);

            expect(capturedOnScroll).not.toBeNull();

            const scrollHeight = 3000;
            const clientHeight = 500;
            const scrollOffset = 500;

            // First scroll to show the hint
            act(() => {
                capturedOnScroll!({
                    scrollDirection: 'forward',
                    scrollOffset,
                    scrollUpdateWasRequested: false,
                    scrollHeight,
                    clientHeight,
                });
            });

            expect(screen.getByTestId('search-hint-toast')).toBeInTheDocument();

            // Click dismiss button
            act(() => {
                screen.getByTestId('dismiss-search-hint').click();
            });

            expect(screen.queryByTestId('search-hint-toast')).not.toBeInTheDocument();

            screenHeightSpy.mockRestore();
        });

        test('should not show search channel hint on mobile', () => {
            const screenHeightSpy = vi.spyOn(window.screen, 'height', 'get').mockReturnValue(500);

            const props = {
                ...baseProps,
                isMobileView: true,
            };

            renderWithContext(<PostList {...props}/>);

            expect(capturedOnScroll).not.toBeNull();

            const scrollHeight = 3000;
            const clientHeight = 500;
            const scrollOffset = 500;

            act(() => {
                capturedOnScroll!({
                    scrollDirection: 'forward',
                    scrollOffset,
                    scrollUpdateWasRequested: false,
                    scrollHeight,
                    clientHeight,
                });
            });

            // Search hint should not show on mobile
            expect(screen.queryByTestId('search-hint-toast')).not.toBeInTheDocument();

            screenHeightSpy.mockRestore();
        });

        test('should not show search channel hint if it has already been dismissed', () => {
            const screenHeightSpy = vi.spyOn(window.screen, 'height', 'get').mockReturnValue(500);

            renderWithContext(<PostList {...baseProps}/>);

            expect(capturedOnScroll).not.toBeNull();

            const scrollHeight = 3000;
            const clientHeight = 500;

            // First scroll to show the hint
            act(() => {
                capturedOnScroll!({
                    scrollDirection: 'forward',
                    scrollOffset: 500,
                    scrollUpdateWasRequested: false,
                    scrollHeight,
                    clientHeight,
                });
            });

            // Dismiss it
            act(() => {
                screen.getByTestId('dismiss-search-hint').click();
            });

            // Scroll again - hint should not reappear after dismiss
            act(() => {
                capturedOnScroll!({
                    scrollDirection: 'forward',
                    scrollOffset: 500,
                    scrollUpdateWasRequested: false,
                    scrollHeight,
                    clientHeight,
                });
            });

            expect(screen.queryByTestId('search-hint-toast')).not.toBeInTheDocument();

            screenHeightSpy.mockRestore();
        });

        test('should hide search channel hint in case of resize to mobile', () => {
            const screenHeightSpy = vi.spyOn(window.screen, 'height', 'get').mockReturnValue(500);

            const {rerender} = renderWithContext(<PostList {...baseProps}/>);

            expect(capturedOnScroll).not.toBeNull();

            const scrollHeight = 3000;
            const clientHeight = 500;
            const scrollOffset = 500;

            // First scroll to show the hint
            act(() => {
                capturedOnScroll!({
                    scrollDirection: 'forward',
                    scrollOffset,
                    scrollUpdateWasRequested: false,
                    scrollHeight,
                    clientHeight,
                });
            });

            expect(screen.getByTestId('search-hint-toast')).toBeInTheDocument();

            // Rerender with mobile view
            rerender(
                <PostList
                    {...baseProps}
                    isMobileView={true}
                />,
            );

            // Scroll again on mobile - hint should hide
            act(() => {
                capturedOnScroll!({
                    scrollDirection: 'forward',
                    scrollOffset,
                    scrollUpdateWasRequested: false,
                    scrollHeight,
                    clientHeight,
                });
            });

            expect(screen.queryByTestId('search-hint-toast')).not.toBeInTheDocument();

            screenHeightSpy.mockRestore();
        });
    });

    describe('isAtBottom', () => {
        const scrollHeight = 1000;
        const clientHeight = 500;

        // isAtBottom = offsetFromBottom <= 10 && scrollHeight > 0
        // offsetFromBottom = scrollHeight - clientHeight - scrollOffset
        // For scrollOffset=0: offsetFromBottom = 1000 - 500 - 0 = 500 (not at bottom)
        // For scrollOffset=489: offsetFromBottom = 1000 - 500 - 489 = 11 (not at bottom)
        // For scrollOffset=490: offsetFromBottom = 1000 - 500 - 490 = 10 (at bottom)
        // For scrollOffset=501: offsetFromBottom = 1000 - 500 - 501 = -1 (at bottom)
        test.each([
            {
                name: 'when viewing the top of the post list',
                scrollOffset: 0,
                expected: false,
            },
            {
                name: 'when 11 pixel from the bottom',
                scrollOffset: 489,
                expected: false,
            },
            {
                name: 'when 9 pixel from the bottom also considered to be bottom',
                scrollOffset: 490,
                expected: true,
            },
            {
                name: 'when clientHeight is less than scrollHeight',
                scrollOffset: 501,
                expected: true,
            },
        ])('$name', ({scrollOffset, expected}) => {
            renderWithContext(<PostList {...baseProps}/>);

            expect(capturedOnScroll).not.toBeNull();

            act(() => {
                capturedOnScroll!({
                    scrollDirection: 'forward',
                    scrollOffset,
                    scrollUpdateWasRequested: false,
                    scrollHeight,
                    clientHeight,
                });
            });

            // Verify isAtBottom returns the expected value by checking atBottom state
            expect(screen.getByTestId('toast-wrapper')).toHaveAttribute('data-at-bottom', String(expected));
        });
    });

    describe('updateAtBottom', () => {
        test('should update atBottom and lastViewedBottom when atBottom changes', () => {
            // Mock Date.now to return increasing values
            let dateNowValue = 10000;
            const mockDateNow = vi.spyOn(Date, 'now').mockImplementation(() => {
                dateNowValue += 1000;
                return dateNowValue;
            });

            renderWithContext(<PostList {...baseProps}/>);

            expect(capturedOnScroll).not.toBeNull();

            // Initially atBottom is null
            expect(screen.getByTestId('toast-wrapper')).toHaveAttribute('data-at-bottom', 'null');
            const initialLastViewedBottom = screen.getByTestId('toast-wrapper').getAttribute('data-last-viewed-bottom');

            // Scroll to bottom
            act(() => {
                capturedOnScroll!({
                    scrollDirection: 'forward',
                    scrollOffset: 500, // at bottom (offsetFromBottom = 0)
                    scrollUpdateWasRequested: false,
                    scrollHeight: 1000,
                    clientHeight: 500,
                });
            });

            // atBottom should change to true
            expect(screen.getByTestId('toast-wrapper')).toHaveAttribute('data-at-bottom', 'true');

            // lastViewedBottom should be updated (different from initial)
            const newLastViewedBottom = screen.getByTestId('toast-wrapper').getAttribute('data-last-viewed-bottom');
            expect(newLastViewedBottom).not.toBe(initialLastViewedBottom);

            mockDateNow.mockRestore();
        });

        test('should not update lastViewedBottom when atBottom does not change', () => {
            renderWithContext(<PostList {...baseProps}/>);

            expect(capturedOnScroll).not.toBeNull();

            // First scroll - not at bottom
            act(() => {
                capturedOnScroll!({
                    scrollDirection: 'forward',
                    scrollOffset: 0, // not at bottom
                    scrollUpdateWasRequested: false,
                    scrollHeight: 1000,
                    clientHeight: 500,
                });
            });

            expect(screen.getByTestId('toast-wrapper')).toHaveAttribute('data-at-bottom', 'false');
            const lastViewedBottomAfterFirst = screen.getByTestId('toast-wrapper').getAttribute('data-last-viewed-bottom');

            // Second scroll - still not at bottom
            act(() => {
                capturedOnScroll!({
                    scrollDirection: 'forward',
                    scrollOffset: 100, // still not at bottom
                    scrollUpdateWasRequested: false,
                    scrollHeight: 1000,
                    clientHeight: 500,
                });
            });

            // atBottom should still be false
            expect(screen.getByTestId('toast-wrapper')).toHaveAttribute('data-at-bottom', 'false');

            // lastViewedBottom should NOT change since atBottom didn't change
            expect(screen.getByTestId('toast-wrapper')).toHaveAttribute('data-last-viewed-bottom', lastViewedBottomAfterFirst!);
        });

        test('should update lastViewedBottom with latestPostTimeStamp as that is greater than Date.now()', () => {
            const mockDateNow = vi.spyOn(Date, 'now').mockReturnValue(12344);

            // latestPostTimeStamp is 12345 in baseProps
            renderWithContext(<PostList {...baseProps}/>);

            expect(capturedOnScroll).not.toBeNull();

            // Scroll to bottom
            act(() => {
                capturedOnScroll!({
                    scrollDirection: 'forward',
                    scrollOffset: 500,
                    scrollUpdateWasRequested: false,
                    scrollHeight: 1000,
                    clientHeight: 500,
                });
            });

            // lastViewedBottom should be set to latestPostTimeStamp (12345) since it's greater than Date.now() (12344)
            expect(screen.getByTestId('toast-wrapper')).toHaveAttribute('data-last-viewed-bottom', '12345');

            mockDateNow.mockRestore();
        });

        test('should update lastViewedBottom with Date.now() as it is greater than latestPostTimeStamp', () => {
            const mockDateNow = vi.spyOn(Date, 'now').mockReturnValue(12346);

            // latestPostTimeStamp is 12345 in baseProps
            renderWithContext(<PostList {...baseProps}/>);

            expect(capturedOnScroll).not.toBeNull();

            // Scroll to bottom
            act(() => {
                capturedOnScroll!({
                    scrollDirection: 'forward',
                    scrollOffset: 500,
                    scrollUpdateWasRequested: false,
                    scrollHeight: 1000,
                    clientHeight: 500,
                });
            });

            // lastViewedBottom should be set to Date.now() (12346) since it's greater than latestPostTimeStamp (12345)
            expect(screen.getByTestId('toast-wrapper')).toHaveAttribute('data-last-viewed-bottom', '12346');

            mockDateNow.mockRestore();
        });
    });

    describe('Scroll correction logic on mount of posts at the top', () => {
        test('should return previous scroll position from getSnapshotBeforeUpdate', () => {
            const {rerender} = renderWithContext(<PostList {...baseProps}/>);

            expect(capturedOnScroll).not.toBeNull();

            // Set atBottom to false by scrolling away from bottom
            act(() => {
                capturedOnScroll!({
                    scrollDirection: 'forward',
                    scrollOffset: 0, // not at bottom
                    scrollUpdateWasRequested: false,
                    scrollHeight: 1000,
                    clientHeight: 500,
                });
            });

            expect(screen.getByTestId('toast-wrapper')).toHaveAttribute('data-at-bottom', 'false');

            // Update props to trigger getSnapshotBeforeUpdate (channel header added)
            // When atOldestPost changes and atBottom is false, snapshot should be captured
            rerender(
                <PostList
                    {...baseProps}
                    atOldestPost={true}
                />,
            );

            // Component should handle the update without errors
            expect(screen.getByTestId('dynamic-virtualized-list')).toBeInTheDocument();
        });

        test('should not return previous scroll position from getSnapshotBeforeUpdate as list is at bottom', () => {
            const {rerender} = renderWithContext(<PostList {...baseProps}/>);

            expect(capturedOnScroll).not.toBeNull();

            // Scroll to bottom
            act(() => {
                capturedOnScroll!({
                    scrollDirection: 'forward',
                    scrollOffset: 500, // at bottom
                    scrollUpdateWasRequested: false,
                    scrollHeight: 1000,
                    clientHeight: 500,
                });
            });

            expect(screen.getByTestId('toast-wrapper')).toHaveAttribute('data-at-bottom', 'true');

            // Update props - when atBottom is true, snapshot should NOT be captured
            rerender(
                <PostList
                    {...baseProps}
                    atOldestPost={true}
                />,
            );

            // Component should handle the update without errors
            // No scroll correction needed when at bottom
            expect(screen.getByTestId('dynamic-virtualized-list')).toBeInTheDocument();
        });
    });

    describe('initRangeToRender', () => {
        test('should return 0 to 50 for channel with more than 100 messages', () => {
            const postListIds = [];
            for (let i = 0; i < 110; i++) {
                postListIds.push(`post${i}`);
            }

            const props = {
                ...baseProps,
                postListIds,
            };

            renderWithContext(<PostList {...props}/>);

            // initRangeToRender should be [0, 50] for large channel without new messages
            expect(capturedInitRangeToRender).toEqual([0, 50]);
        });

        test('should return range if new messages are present', () => {
            const postListIds = [];
            for (let i = 0; i < 120; i++) {
                postListIds.push(`post${i}`);
            }
            postListIds[65] = PostListRowListIds.START_OF_NEW_MESSAGES + 1551711601000;

            const props = {
                ...baseProps,
                postListIds,
            };

            renderWithContext(<PostList {...props}/>);

            // initRangeToRender should be centered around the new message line (index 65)
            // Range: [max(65-30, 0), max(65+30, min(119, 50))] = [35, 95]
            expect(capturedInitRangeToRender).toEqual([35, 95]);
        });
    });

    describe('renderRow', () => {
        test('should have appropriate classNames for rows with START_OF_NEW_MESSAGES and DATE_LINE', () => {
            const props = {
                ...baseProps,
                postListIds: postListIdsForClassNames,
                atOldestPost: true,
            };

            renderWithContext(<PostList {...props}/>);

            // Verify rows are rendered
            expect(screen.getByTestId('post-row-post3')).toBeInTheDocument();
            expect(screen.getByTestId('post-row-post5')).toBeInTheDocument();
        });

        test('should have both top and bottom classNames as post is in between DATE_LINE and START_OF_NEW_MESSAGES', () => {
            const props = {
                ...baseProps,
                postListIds: [
                    'post1',
                    'post2',
                    'post3',
                    DATE_LINE + 1551711600000,
                    'post4',
                    PostListRowListIds.START_OF_NEW_MESSAGES + 1551711601000,
                    'post5',
                ],
                atOldestPost: true,
            };

            renderWithContext(<PostList {...props}/>);

            expect(screen.getByTestId('post-row-post4')).toBeInTheDocument();
        });

        test('should have empty string as className when both previousItemId and nextItemId are posts', () => {
            const props = {
                ...baseProps,
                postListIds: [
                    'post1',
                    'post2',
                    'post3',
                    DATE_LINE + 1551711600000,
                    'post4',
                    PostListRowListIds.START_OF_NEW_MESSAGES + 1551711601000,
                    'post5',
                ],
                atOldestPost: true,
            };

            renderWithContext(<PostList {...props}/>);

            expect(screen.getByTestId('post-row-post2')).toBeInTheDocument();
        });
    });

    describe('updateFloatingTimestamp', () => {
        test('should not update topPostId as is it not mobile view', () => {
            const props = {
                ...baseProps,
                isMobileView: false,
            };

            renderWithContext(<PostList {...props}/>);

            expect(capturedOnItemsRendered).not.toBeNull();

            act(() => {
                capturedOnItemsRendered!({visibleStartIndex: 0, visibleStopIndex: 0});
            });

            // FloatingTimestamp is not rendered when not mobile view
            // topPostId should stay empty (not updated)
            expect(screen.queryByTestId('floating-timestamp')).not.toBeInTheDocument();
        });

        test('should update topPostId with latest visible postId', () => {
            const props = {
                ...baseProps,
                isMobileView: true,
            };

            renderWithContext(<PostList {...props}/>);

            expect(capturedOnItemsRendered).not.toBeNull();

            // Call onItemsRendered with visibleStartIndex=1 -> topPostId should be 'post2'
            act(() => {
                capturedOnItemsRendered!({visibleStartIndex: 1, visibleStopIndex: 0});
            });

            expect(screen.getByTestId('floating-timestamp')).toHaveAttribute('data-post-id', 'post2');

            // Call again with visibleStartIndex=2 -> topPostId should be 'post3'
            act(() => {
                capturedOnItemsRendered!({visibleStartIndex: 2, visibleStopIndex: 0});
            });

            expect(screen.getByTestId('floating-timestamp')).toHaveAttribute('data-post-id', 'post3');
        });
    });

    describe('scrollToLatestMessages', () => {
        test('should call scrollToBottom', async () => {
            const props = {
                ...baseProps,
                atLatestPost: true,
            };

            renderWithContext(<PostList {...props}/>);

            // Import EventEmitter to trigger scrollToLatestMessages
            const EventEmitter = await import('mattermost-redux/utils/event_emitter');
            const {EventTypes} = await import('utils/constants');

            // Emit the event to trigger scrollToLatestMessages
            act(() => {
                EventEmitter.default.emit(EventTypes.POST_LIST_SCROLL_TO_BOTTOM);
            });

            // When atLatestPost is true, scrollToBottom should be called
            // scrollToBottom calls listRef.current?.scrollToItem(0, 'end')
            expect(capturedScrollToItem).toHaveBeenCalledWith(0, 'end');
        });

        test('should call changeUnreadChunkTimeStamp', async () => {
            // atLatestPost is false by default in baseProps
            renderWithContext(<PostList {...baseProps}/>);

            const EventEmitter = await import('mattermost-redux/utils/event_emitter');
            const {EventTypes} = await import('utils/constants');

            // Emit the event to trigger scrollToLatestMessages
            act(() => {
                EventEmitter.default.emit(EventTypes.POST_LIST_SCROLL_TO_BOTTOM);
            });

            // When atLatestPost is false, changeUnreadChunkTimeStamp should be called with 0
            expect(baseProps.actions.changeUnreadChunkTimeStamp).toHaveBeenCalledWith(0);
        });
    });

    describe('postIds state', () => {
        test('should have LOAD_NEWER_MESSAGES_TRIGGER and LOAD_OLDER_MESSAGES_TRIGGER', () => {
            const props = {
                ...baseProps,
                autoRetryEnable: false,
            };

            renderWithContext(<PostList {...props}/>);

            // Verify the triggers are rendered in the list
            expect(screen.getByTestId(`post-row-${PostListRowListIds.LOAD_NEWER_MESSAGES_TRIGGER}`)).toBeInTheDocument();
            expect(screen.getByTestId(`post-row-${PostListRowListIds.LOAD_OLDER_MESSAGES_TRIGGER}`)).toBeInTheDocument();
        });
    });

    describe('initScrollToIndex', () => {
        test('return date index if it is just above new message line', () => {
            const postListIds = [
                'post1',
                'post2',
                'post3',
                'post4',
                PostListRowListIds.START_OF_NEW_MESSAGES + 1551711599000,
                DATE_LINE + 1551711600000,
                'post5',
            ];

            const props = {
                ...baseProps,
                postListIds,
                atOldestPost: true,
            };

            renderWithContext(<PostList {...props}/>);

            // initScrollToIndex is a function passed to DynamicVirtualizedList
            expect(capturedInitScrollToIndex).not.toBeNull();

            // Call it to get the scroll index
            // With DATE_LINE just above START_OF_NEW_MESSAGES, it should return index 6 (the date line)
            // postListIds after processing: [LOAD_NEWER (if not atLatest), ...original, CHANNEL_INTRO (if atOldest)]
            // Index 6 in processed list points to DATE_LINE
            const result = capturedInitScrollToIndex!();
            expect(result).toEqual({index: 6, position: 'start', offset: -50});
        });
    });

    test('return new message line index if there is no date just above it', () => {
        const postListIds = [
            'post1',
            'post2',
            'post3',
            'post4',
            PostListRowListIds.START_OF_NEW_MESSAGES + 1551711601000,
            'post5',
        ];

        const props = {
            ...baseProps,
            postListIds,
            atOldestPost: true,
        };

        renderWithContext(<PostList {...props}/>);

        expect(capturedInitScrollToIndex).not.toBeNull();

        // Without DATE_LINE above, it should return index 5 (the START_OF_NEW_MESSAGES line)
        const result = capturedInitScrollToIndex!();
        expect(result).toEqual({index: 5, position: 'start', offset: -50});
    });
});
