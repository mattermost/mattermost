// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act, fireEvent, render, screen} from '@testing-library/react';
import React from 'react';

import DynamicVirtualizedList from './index';
import type {DynamicVirtualizedChildProps, DynamicVirtualizedListProps} from './index';

const mockResizeCallbacks = new Map<string, (height: number) => void>();

jest.mock('./list_item_size_observer', () => ({
    ListItemSizeObserver: {
        getInstance: () => ({
            observe: (itemId: string, _element: Element, callback: (height: number) => void) => {
                mockResizeCallbacks.set(itemId, callback);
                return () => mockResizeCallbacks.delete(itemId);
            },
        }),
    },
}));

const LIST_HEIGHT = 300;
const ROW_HEIGHT = 100;

// Like a post showing its header, the topmost row is taller than the others
const TOP_ROW_EXTRA_HEIGHT = 40;

describe('DynamicVirtualizedList', () => {
    let rowHeights: Record<string, number>;
    let scrollTops: WeakMap<HTMLElement, number>;
    let currentItemData: string[];
    let boundingRectNoise: number;

    const originalDescriptors = {
        offsetHeight: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight'),
        scrollTop: Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop'),
        scrollHeight: Object.getOwnPropertyDescriptor(Element.prototype, 'scrollHeight'),
        getBoundingClientRect: Object.getOwnPropertyDescriptor(Element.prototype, 'getBoundingClientRect'),
    };

    const renderedRowHeight = (row: HTMLElement) => {
        const content = row.firstElementChild as HTMLElement | null;
        if (!content?.dataset.testid) {
            return 0;
        }

        return (rowHeights[content.dataset.testid] ?? ROW_HEIGHT) + (content.dataset.top === 'true' ? TOP_ROW_EXTRA_HEIGHT : 0);
    };

    const totalHeight = () => Array.from(document.querySelectorAll<HTMLElement>('.item_measurer')).
        reduce((total, row) => total + renderedRowHeight(row), 0);

    beforeAll(() => {
        Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
            configurable: true,
            get() {
                return this.classList.contains('item_measurer') ? renderedRowHeight(this) : 0;
            },
        });
        Object.defineProperty(Element.prototype, 'scrollTop', {
            configurable: true,
            get() {
                return scrollTops.get(this) ?? 0;
            },
            set(value: number) {
                scrollTops.set(this, Math.max(0, value));
            },
        });
        Object.defineProperty(Element.prototype, 'scrollHeight', {
            configurable: true,
            get() {
                return this.id === 'testList' ? totalHeight() : 0;
            },
        });
        Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
            configurable: true,
            value() {
                const height = this.classList.contains('item_measurer') ? renderedRowHeight(this) + boundingRectNoise : 0;
                return {x: 0, y: 0, top: 0, left: 0, right: 0, bottom: height, width: 0, height, toJSON: () => ({})};
            },
        });
    });

    afterAll(() => {
        for (const [name, descriptor] of Object.entries(originalDescriptors)) {
            const target = name === 'offsetHeight' ? HTMLElement.prototype : Element.prototype;
            if (descriptor) {
                Object.defineProperty(target, name, descriptor);
            } else {
                Reflect.deleteProperty(target, name);
            }
        }
    });

    beforeEach(() => {
        mockResizeCallbacks.clear();
        scrollTops = new WeakMap();
        boundingRectNoise = 0;

        // item-0 is the newest item at the bottom, item-9 the oldest one at the top
        currentItemData = Array.from({length: 10}, (_, i) => `item-${i}`);
        rowHeights = Object.fromEntries(currentItemData.map((id) => [id, ROW_HEIGHT]));
    });

    const Row = ({data, itemId}: DynamicVirtualizedChildProps) => (
        <div
            data-testid={itemId}
            data-top={String(data[data.length - 1] === itemId)}
        >
            {itemId}
        </div>
    );

    const baseProps: DynamicVirtualizedListProps = {
        id: 'testList',
        canLoadMorePosts: jest.fn(() => Promise.resolve()),
        children: Row,
        correctScrollToBottom: true,
        height: LIST_HEIGHT,
        initRangeToRender: [0, 9],
        initScrollToIndex: () => ({index: 0, position: 'end'}),
        itemData: [],
        onItemsRendered: jest.fn(),
        onScroll: jest.fn(),
        overscanCountBackward: 30,
        overscanCountForward: 30,
        scrollToFailed: jest.fn(),
        style: {},
        width: 500,
    };

    const renderList = (props: Partial<DynamicVirtualizedListProps> = {}) => {
        const result = render(
            <DynamicVirtualizedList
                {...baseProps}
                {...props}
                itemData={currentItemData}
            />,
        );

        const scroller = screen.getByRole('list').parentElement as HTMLElement;

        return {
            scroller,
            setItemData: (itemData: string[]) => {
                currentItemData = itemData;
                result.rerender(
                    <DynamicVirtualizedList
                        {...baseProps}
                        {...props}
                        itemData={itemData}
                    />,
                );
            },
        };
    };

    const userScrollTo = (scroller: HTMLElement, scrollTop: number) => {
        scroller.scrollTop = scrollTop;
        fireEvent.scroll(scroller);
    };

    const resizeRow = (itemId: string, height: number) => {
        rowHeights[itemId] = height;
        act(() => {
            mockResizeCallbacks.get(itemId)?.(renderedRowHeight(screen.getByTestId(itemId).parentElement as HTMLElement));
        });
    };

    test('starts scrolled to the bottom', () => {
        const {scroller} = renderList();

        expect(scroller.scrollTop).toBe(totalHeight() - LIST_HEIGHT);
    });

    test('keeps the visible rows in place when rows above the viewport change height', () => {
        const {scroller} = renderList();

        // item-9 is 140px tall, so item-5 starts at the top of the viewport and item-9 to item-6 are above it
        userScrollTo(scroller, 440);

        resizeRow('item-8', 250);
        expect(scroller.scrollTop).toBe(590);

        // Several rows can resize before the resulting scroll event is handled, e.g. when multiple images load at once
        resizeRow('item-6', 200);
        expect(scroller.scrollTop).toBe(690);

        resizeRow('item-7', 20);
        expect(scroller.scrollTop).toBe(610);
    });

    test('keeps the visible rows in place when a row partially above the viewport changes height', () => {
        const {scroller} = renderList();
        userScrollTo(scroller, 450);

        resizeRow('item-5', 250);

        expect(scroller.scrollTop).toBe(600);
    });

    test('does not change the scroll position when a visible row changes height', () => {
        const {scroller} = renderList();
        userScrollTo(scroller, 440);

        resizeRow('item-5', 250);

        expect(scroller.scrollTop).toBe(440);
    });

    test('does not change the scroll position when a row below the viewport changes height', () => {
        const {scroller} = renderList();
        userScrollTo(scroller, 440);

        resizeRow('item-1', 250);

        expect(scroller.scrollTop).toBe(440);
    });

    test('stays at the bottom when a row changes height while scrolled to the bottom', () => {
        const {scroller} = renderList();

        resizeRow('item-8', 250);

        expect(totalHeight()).toBe(1190);
        expect(scroller.scrollTop).toBe(totalHeight() - LIST_HEIGHT);
    });

    test('does not change the scroll position when a row is measured for the first time above the viewport', () => {
        const {scroller, setItemData} = renderList({loaderId: 'loader'});
        userScrollTo(scroller, 440);

        // The parent compensates for rows added at the top based on the scroll height
        setItemData([...currentItemData, 'loader']);

        expect(screen.getByTestId('loader')).toBeInTheDocument();
        expect(scroller.scrollTop).toBe(440);
    });

    test('does not compensate twice for a row resized by the same update that changes the items', () => {
        const {scroller, setItemData} = renderList();
        userScrollTo(scroller, 440);

        // item-9 stops being the topmost row in this update, so it loses its extra height and that's already covered
        // by the parent's compensation for the update. The added items are not measured yet so they are not rendered.
        setItemData([...currentItemData, 'item-10', 'item-11']);
        resizeRow('item-9', ROW_HEIGHT);
        expect(scroller.scrollTop).toBe(440);

        // item-5 is now partially above the viewport
        resizeRow('item-5', 200);
        expect(scroller.scrollTop).toBe(540);
    });

    test('keeps the visible rows in place when older items are rendered while scrolling up', async () => {
        const {scroller, setItemData} = renderList();
        userScrollTo(scroller, 440);
        setItemData([...currentItemData, 'item-10', 'item-11']);

        userScrollTo(scroller, 430);
        expect(screen.getByTestId('item-10')).toBeInTheDocument();
        await act(() => new Promise((resolve) => requestAnimationFrame(resolve)));

        // item-10 and item-11 add 240px above the viewport since item-11 is now the topmost row
        expect(scroller.scrollTop).toBe(670);
    });

    test('does not move when the size observer first reports older items rendered on a scaled display', async () => {
        // At a display scale like 1.0000000577, a 100px row's bounding box is 100.0000019px tall,
        // while the size observer reports 100px
        boundingRectNoise = 0.0000019;

        const {scroller, setItemData} = renderList();
        userScrollTo(scroller, 440);
        setItemData([...currentItemData, 'item-10', 'item-11']);

        userScrollTo(scroller, 430);
        await act(() => new Promise((resolve) => requestAnimationFrame(resolve)));
        expect(scroller.scrollTop).toBe(670);

        resizeRow('item-10', ROW_HEIGHT);
        resizeRow('item-11', ROW_HEIGHT);

        expect(scroller.scrollTop).toBe(670);
    });

    test('stays at the bottom when a row grows in the same update that changes the items', () => {
        const {scroller, setItemData} = renderList();
        expect(scroller.scrollTop).toBe(740);

        rowHeights['item-5'] = 250;
        setItemData([...currentItemData, 'item-10']);

        expect(scroller.scrollTop).toBe(totalHeight() - LIST_HEIGHT);
    });

    test('does not move to the bottom when a row grows in the same update that changes the items while scrolled up', () => {
        const {scroller, setItemData} = renderList();
        userScrollTo(scroller, 440);

        rowHeights['item-1'] = 250;
        setItemData([...currentItemData, 'item-10']);

        expect(scroller.scrollTop).toBe(440);
    });

    describe('when a row above the viewport shrinks while scrolled to the bottom', () => {
        const shrinkWithClampedScroll = (scroller: HTMLElement) => {
            expect(scroller.scrollTop).toBe(740);

            // The browser clamps scrollTop to the new maximum before the resize is observed
            rowHeights['item-8'] = 20;
            scroller.scrollTop = totalHeight() - LIST_HEIGHT;
            expect(scroller.scrollTop).toBe(660);

            resizeRow('item-8', 20);
        };

        test('stays at the bottom', () => {
            const {scroller} = renderList();

            shrinkWithClampedScroll(scroller);

            expect(scroller.scrollTop).toBe(totalHeight() - LIST_HEIGHT);
        });

        test('does not compensate a second time when not correcting the scroll to the bottom', () => {
            const {scroller} = renderList({correctScrollToBottom: false});

            shrinkWithClampedScroll(scroller);

            expect(scroller.scrollTop).toBe(660);
        });

        test('does not snap to the bottom when the list was near but not at the bottom', () => {
            const {scroller} = renderList();
            userScrollTo(scroller, 700);

            rowHeights['item-8'] = 20;
            scroller.scrollTop = totalHeight() - LIST_HEIGHT;
            expect(scroller.scrollTop).toBe(660);

            resizeRow('item-8', 20);

            expect(scroller.scrollTop).toBe(620);
        });

        test('keeps the position after a row above the viewport grows and shrinks before a scroll event', () => {
            const {scroller} = renderList({correctScrollToBottom: false});

            resizeRow('item-8', 180);
            expect(scroller.scrollTop).toBe(820);

            rowHeights['item-8'] = 140;
            scroller.scrollTop = totalHeight() - LIST_HEIGHT;
            expect(scroller.scrollTop).toBe(780);

            resizeRow('item-8', 140);

            expect(scroller.scrollTop).toBe(780);
        });

        test('does not compensate when several rows shrink before they are observed', () => {
            const {scroller} = renderList({correctScrollToBottom: false});

            rowHeights['item-8'] = 20;
            rowHeights['item-7'] = 20;
            scroller.scrollTop = totalHeight() - LIST_HEIGHT;
            expect(scroller.scrollTop).toBe(580);

            resizeRow('item-8', 20);
            resizeRow('item-7', 20);

            expect(scroller.scrollTop).toBe(580);
        });
    });

    test('compensates for a row that changed height before an update to the items is rendered', () => {
        const {scroller, setItemData} = renderList();
        userScrollTo(scroller, 440);

        // item-8 finishes loading an image, but the next update to the items is rendered before it's measured
        rowHeights['item-8'] = 250;
        setItemData([...currentItemData, 'item-10']);
        resizeRow('item-8', 250);

        expect(scroller.scrollTop).toBe(590);
    });
});
