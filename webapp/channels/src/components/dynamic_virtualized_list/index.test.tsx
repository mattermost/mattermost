// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-underscore-dangle */

import {act, fireEvent, render} from '@testing-library/react';
import React, {createRef} from 'react';

jest.mock('./list_item_size_observer', () => {
    const mockObserve = jest.fn(() => jest.fn());
    const mockUnobserve = jest.fn();

    return {
        ListItemSizeObserver: {
            getInstance: jest.fn(() => ({
                observe: mockObserve,
                unobserve: mockUnobserve,
            })),
        },
    };
});

import type {DynamicVirtualizedListProps} from './index';
import {DynamicVirtualizedList} from './index';

const rowHeight = 100;
const listHeight = 300;
const itemCount = 11;

// Index 0 is the newest item (rendered at the bottom), the highest index is the oldest (at the top).
const itemData = Array.from({length: itemCount}, (_, i) => `item-${i}`);

// The item that is requested to be centered when the list is mounted.
const targetIndex = 5;

// Offset of the top of an item = total height of the items above it (the ones with a higher index).
// Centering an item of size `size` at `offset` gives round(offset - height / 2 + size / 2).
const centeredOffset = (aboveHeight: number) => Math.round((aboveHeight - (listHeight / 2)) + (rowHeight / 2));

describe('DynamicVirtualizedList: centered item', () => {
    const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');

    beforeAll(() => {
        Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
            configurable: true,
            value: rowHeight,
        });
    });

    afterAll(() => {
        if (originalOffsetHeight) {
            Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight);
        } else {
            Reflect.deleteProperty(HTMLElement.prototype, 'offsetHeight');
        }
    });

    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    function setup({centerOffset = 0} = {}) {
        const listRef = createRef<DynamicVirtualizedList>();
        let outer: HTMLDivElement | null = null;

        // Record every write to scrollTop of the scroll container
        const scrollTopWrites: number[] = [];
        let scrollTop = 0;

        const props: DynamicVirtualizedListProps = {
            canLoadMorePosts: jest.fn(() => Promise.resolve()),
            children: ({itemId}) => <div>{itemId}</div>,
            height: listHeight,
            initRangeToRender: [0, itemCount - 1],
            initScrollToIndex: () => ({index: targetIndex, position: 'center', offset: centerOffset}),
            itemData,
            onItemsRendered: jest.fn(),
            onScroll: jest.fn(),
            outerRef: (element: HTMLDivElement | null) => {
                if (element && !outer) {
                    outer = element;
                    Object.defineProperty(element, 'scrollTop', {
                        configurable: true,
                        get: () => scrollTop,
                        set: (value: number) => {
                            scrollTopWrites.push(value);
                            scrollTop = value;
                        },
                    });
                }
            },
            overscanCountBackward: 10,
            overscanCountForward: 30,
            scrollToFailed: jest.fn(),
            style: {},
            width: 400,
            correctScrollToBottom: true,
        };

        const {rerender} = render(
            <DynamicVirtualizedList
                ref={listRef}
                {...props}
            />,
        );

        // Forget the writes made by the initial scroll
        const initialScrollTop = scrollTop;
        scrollTopWrites.length = 0;

        // Rows above the target change size, e.g. an image finished loading
        const growRowAboveTarget = (newHeight: number) => {
            act(() => {
                listRef.current!._handleNewMeasurements(itemData[targetIndex + 3], newHeight, false);
            });
        };

        // Replace the items of the list, e.g. when a post is deleted
        const setItemData = (newItemData: string[]) => {
            rerender(
                <DynamicVirtualizedList
                    ref={listRef}
                    {...props}
                    itemData={newItemData}
                />,
            );
        };

        return {
            listRef,
            setItemData,
            getOuter: () => outer!,
            getScrollTop: () => scrollTop,
            initialScrollTop,
            scrollTopWrites,
            growRowAboveTarget,
        };
    }

    test('the initial center scroll lands on the requested item', () => {
        const {initialScrollTop} = setup();

        expect(initialScrollTop).toBe(centeredOffset(rowHeight * (itemCount - 1 - targetIndex)));
    });

    test('keeps the item centered when a row above it grows after the initial scroll', () => {
        const {getScrollTop, growRowAboveTarget} = setup();

        // The row above the target gets 300px taller, which moves the target down by 300px
        growRowAboveTarget(rowHeight + 300);
        act(() => {
            jest.advanceTimersByTime(200);
        });

        expect(getScrollTop()).toBe(centeredOffset((rowHeight * (itemCount - 1 - targetIndex)) + 300));
    });

    test('writes the absolute offset once for a burst of measurements', () => {
        const {scrollTopWrites, growRowAboveTarget} = setup();

        growRowAboveTarget(rowHeight + 100);
        growRowAboveTarget(rowHeight + 200);
        growRowAboveTarget(rowHeight + 300);
        act(() => {
            jest.advanceTimersByTime(200);
        });

        expect(scrollTopWrites).toEqual([centeredOffset((rowHeight * (itemCount - 1 - targetIndex)) + 300)]);
    });

    test('does not apply the relative correction for rows added above while the item is held', () => {
        const {listRef, getOuter, scrollTopWrites} = setup();
        const outer = getOuter();

        // Rows are rendered above the list: the scroll height grows between the snapshot (first read)
        // and the update (later reads)
        let scrollHeightReads = 0;
        Object.defineProperty(outer, 'scrollHeight', {
            configurable: true,
            get: () => {
                scrollHeightReads += 1;
                return scrollHeightReads === 1 ? 1000 : 1400;
            },
        });
        const scrollBy = jest.fn();
        outer.scrollBy = scrollBy;

        act(() => {
            listRef.current!.setState({localOlderPostsToRender: [0, 3]});
        });
        act(() => {
            jest.advanceTimersByTime(200);
        });

        expect(scrollBy).not.toHaveBeenCalled();
        expect(scrollTopWrites).toEqual([]);
    });

    test('applies the relative correction for rows added above when no item is held', () => {
        const {listRef, getOuter, scrollTopWrites} = setup();
        const outer = getOuter();

        // Let the hold expire
        act(() => {
            jest.advanceTimersByTime(31000);
        });
        scrollTopWrites.length = 0;

        let scrollHeightReads = 0;
        Object.defineProperty(outer, 'scrollHeight', {
            configurable: true,
            get: () => {
                scrollHeightReads += 1;
                return scrollHeightReads === 1 ? 1000 : 1400;
            },
        });
        outer.scrollBy = jest.fn();

        act(() => {
            listRef.current!.setState({localOlderPostsToRender: [0, 3]});
        });
        act(() => {
            jest.advanceTimersByTime(200);
        });

        expect(outer.scrollBy).toHaveBeenCalledWith(0, 400);
    });

    test('ignores a relative scrollTo() requested by the parent while the item is held, and applies it afterwards', () => {
        const {listRef, getOuter, scrollTopWrites} = setup();
        const outer = getOuter();
        const scrollBy = jest.fn();
        outer.scrollBy = scrollBy;

        act(() => {
            listRef.current!.scrollTo(900, 400, true);
        });
        act(() => {
            jest.advanceTimersByTime(200);
        });

        expect(scrollBy).not.toHaveBeenCalled();
        expect(scrollTopWrites).toEqual([]);

        act(() => {
            jest.advanceTimersByTime(31000);
        });
        act(() => {
            listRef.current!.scrollTo(900, 400, true);
        });
        act(() => {
            jest.advanceTimersByTime(200);
        });

        expect(scrollBy).toHaveBeenCalledWith(0, 400);
    });

    test('keeps the requested offset when re-centering', () => {
        const {getScrollTop, growRowAboveTarget} = setup({centerOffset: 40});

        growRowAboveTarget(rowHeight + 300);
        act(() => {
            jest.advanceTimersByTime(200);
        });

        expect(getScrollTop()).toBe(centeredOffset((rowHeight * (itemCount - 1 - targetIndex)) + 300) + 40);
    });

    test('releases the hold when the item is no longer in the list', () => {
        const {listRef, setItemData} = setup();
        expect(listRef.current!._isCenteredItemHeld()).toBe(true);

        act(() => {
            setItemData(itemData.filter((id) => id !== itemData[targetIndex]));
        });

        expect(listRef.current!._isCenteredItemHeld()).toBe(false);
    });

    test('releases the hold when the owner requests another position', () => {
        const {listRef} = setup();

        act(() => {
            listRef.current!.scrollToItem(2, 'start');
        });

        expect(listRef.current!._isCenteredItemHeld()).toBe(false);
    });

    test('releases the hold when the owner requests the bottom, e.g. after sending a message', () => {
        const {listRef} = setup();
        expect(listRef.current!._isCenteredItemHeld()).toBe(true);

        act(() => {
            listRef.current!.scrollToItem(0, 'end');
        });

        expect(listRef.current!._isCenteredItemHeld()).toBe(false);
    });

    test('keeps the hold when the list itself keeps the bottom', () => {
        const {listRef} = setup();

        // The list requests the bottom itself whenever it measures that it is at the bottom
        act(() => {
            listRef.current!._heightChange(listHeight, Number.MAX_SAFE_INTEGER);
        });

        expect(listRef.current!._isCenteredItemHeld()).toBe(true);
    });

    test('stops re-centering after the user interacts with the list', () => {
        const {getOuter, getScrollTop, scrollTopWrites, initialScrollTop, growRowAboveTarget} = setup();

        fireEvent.wheel(getOuter());
        growRowAboveTarget(rowHeight + 300);
        act(() => {
            jest.advanceTimersByTime(200);
        });

        expect(getScrollTop()).toBe(initialScrollTop);
        expect(scrollTopWrites).not.toContain(centeredOffset((rowHeight * (itemCount - 1 - targetIndex)) + 300));
    });

    test('stops re-centering after the hold time has passed', () => {
        const {getScrollTop, scrollTopWrites, initialScrollTop, growRowAboveTarget} = setup();

        act(() => {
            jest.advanceTimersByTime(31000);
        });
        growRowAboveTarget(rowHeight + 300);
        act(() => {
            jest.advanceTimersByTime(200);
        });

        expect(getScrollTop()).toBe(initialScrollTop);
        expect(scrollTopWrites).not.toContain(centeredOffset((rowHeight * (itemCount - 1 - targetIndex)) + 300));
    });
});
