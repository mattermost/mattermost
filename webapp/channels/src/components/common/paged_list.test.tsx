// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act, fireEvent} from '@testing-library/react';
import React from 'react';

import PagedList from 'components/common/paged_list';

import {renderWithContext} from 'tests/react_testing_utils';

describe('components/common/PagedList', () => {
    const OriginalResizeObserver = global.ResizeObserver;
    let resizeCallbacks: Array<() => void>;

    function resize() {
        act(() => {
            resizeCallbacks.forEach((callback) => callback());
            jest.runAllTimers();
        });
    }

    beforeEach(() => {
        jest.useFakeTimers();
        resizeCallbacks = [];
        global.ResizeObserver = class {
            constructor(callback: () => void) {
                resizeCallbacks.push(callback);
            }
            observe() {}
            unobserve() {}
            disconnect() {}
        } as unknown as typeof ResizeObserver;
    });

    afterEach(() => {
        jest.useRealTimers();
        global.ResizeObserver = OriginalResizeObserver;
    });

    function renderPagedList(props: Partial<React.ComponentProps<typeof PagedList>> = {}) {
        const onLoadMore = jest.fn();
        const result = renderWithContext(
            <PagedList
                hasMore={true}
                isLoadingMore={false}
                onLoadMore={onLoadMore}
                {...props}
            >
                <div data-testid='item'/>
            </PagedList>,
        );
        const scroller = result.container.querySelector('.simplebar-content-wrapper') ?? result.container.firstElementChild!;
        return {...result, onLoadMore, scroller};
    }

    function setScrollPosition(element: Element, {scrollTop, clientHeight, scrollHeight}: {scrollTop: number; clientHeight: number; scrollHeight: number}) {
        Object.defineProperty(element, 'scrollTop', {configurable: true, value: scrollTop});
        Object.defineProperty(element, 'clientHeight', {configurable: true, value: clientHeight});
        Object.defineProperty(element, 'scrollHeight', {configurable: true, value: scrollHeight});
    }

    test('should load more when scrolled near the end', () => {
        const {onLoadMore, scroller} = renderPagedList();

        setScrollPosition(scroller, {scrollTop: 480, clientHeight: 500, scrollHeight: 1000});
        fireEvent.scroll(scroller);
        act(() => jest.runAllTimers());

        expect(onLoadMore).toHaveBeenCalledTimes(1);
    });

    test('should not load more when far from the end', () => {
        const {onLoadMore, scroller} = renderPagedList();

        setScrollPosition(scroller, {scrollTop: 0, clientHeight: 500, scrollHeight: 1000});
        fireEvent.scroll(scroller);
        act(() => jest.runAllTimers());

        expect(onLoadMore).not.toHaveBeenCalled();
    });

    test.each([
        ['there is nothing more', {hasMore: false}],
        ['a page is already loading', {isLoadingMore: true}],
        ['the last page failed', {loadMoreError: 'Failed'}],
    ])('should not load more when %s', (_, props) => {
        const {onLoadMore, scroller} = renderPagedList(props);

        setScrollPosition(scroller, {scrollTop: 480, clientHeight: 500, scrollHeight: 1000});
        fireEvent.scroll(scroller);
        act(() => jest.runAllTimers());

        expect(onLoadMore).not.toHaveBeenCalled();
    });

    test('should load more once the loading spinner is in view', () => {
        const {onLoadMore, scroller, container} = renderPagedList();

        Object.defineProperty(container.querySelector('.loading-screen'), 'offsetHeight', {configurable: true, value: 140});
        setScrollPosition(scroller, {scrollTop: 0, clientHeight: 500, scrollHeight: 600});
        fireEvent.scroll(scroller);
        act(() => jest.runAllTimers());

        expect(onLoadMore).toHaveBeenCalledTimes(1);
    });

    test('should only load until full when asked to', () => {
        const {onLoadMore} = renderPagedList();
        resize();
        expect(onLoadMore).not.toHaveBeenCalled();

        const {onLoadMore: onLoadMoreUntilFull} = renderPagedList({loadUntilFull: true});
        resize();
        expect(onLoadMoreUntilFull).toHaveBeenCalledTimes(1);
    });

    test('should not retry a failed page until the list is resized', () => {
        const {onLoadMore, rerender} = renderPagedList({loadUntilFull: true});
        resize();
        expect(onLoadMore).toHaveBeenCalledTimes(1);

        const render = (isLoadingMore: boolean) => rerender(
            <PagedList
                hasMore={true}
                isLoadingMore={isLoadingMore}
                onLoadMore={onLoadMore}
                loadUntilFull={true}
            >
                <div data-testid='item'/>
            </PagedList>,
        );
        render(true);
        render(false);
        act(() => jest.runAllTimers());
        expect(onLoadMore).toHaveBeenCalledTimes(1);

        resize();
        expect(onLoadMore).toHaveBeenCalledTimes(2);
    });

    test('should offer a retry instead of the spinner after a page fails', () => {
        const {onLoadMore, container, getByRole} = renderPagedList({loadUntilFull: true, loadMoreError: 'Failed to load'});

        expect(container.querySelector('.loading-screen')).toBeNull();
        expect(getByRole('alert')).toHaveTextContent('Failed to load');

        resize();
        expect(onLoadMore).not.toHaveBeenCalled();

        fireEvent.click(getByRole('button', {name: 'Try again'}));
        expect(onLoadMore).toHaveBeenCalledTimes(1);
    });

    test('should show the loading spinner only while there is more to load', () => {
        const {container} = renderPagedList({hasMore: true});
        expect(container.querySelector('.loading-screen')).not.toBeNull();

        const {container: endContainer} = renderPagedList({hasMore: false});
        expect(endContainer.querySelector('.loading-screen')).toBeNull();
    });
});
