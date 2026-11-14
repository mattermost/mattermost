// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act, fireEvent} from '@testing-library/react';
import React from 'react';

import PagedList from 'components/common/paged_list';

import {renderWithContext} from 'tests/react_testing_utils';

describe('components/common/PagedList', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
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
    ])('should not load more when %s', (_, props) => {
        const {onLoadMore, scroller} = renderPagedList(props);

        setScrollPosition(scroller, {scrollTop: 480, clientHeight: 500, scrollHeight: 1000});
        fireEvent.scroll(scroller);
        act(() => jest.runAllTimers());

        expect(onLoadMore).not.toHaveBeenCalled();
    });

    test('should only load until full when asked to', () => {
        const {onLoadMore} = renderPagedList();
        act(() => jest.runAllTimers());
        expect(onLoadMore).not.toHaveBeenCalled();

        const {onLoadMore: onLoadMoreUntilFull} = renderPagedList({loadUntilFull: true});
        act(() => jest.runAllTimers());
        expect(onLoadMoreUntilFull).toHaveBeenCalledTimes(1);
    });

    test('should show the loading spinner only while there is more to load', () => {
        const {container} = renderPagedList({hasMore: true});
        expect(container.querySelector('.loading-screen')).not.toBeNull();

        const {container: endContainer} = renderPagedList({hasMore: false});
        expect(endContainer.querySelector('.loading-screen')).toBeNull();
    });
});
