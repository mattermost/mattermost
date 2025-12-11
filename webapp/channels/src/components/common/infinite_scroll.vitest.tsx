// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, waitFor} from 'tests/vitest_react_testing_utils';

import InfiniteScroll from './infinite_scroll';

describe('/components/common/InfiniteScroll', () => {
    const baseProps = {
        callBack: vi.fn(),
        endOfData: false,
        endOfDataMessage: 'No more items to fetch',
        styleClass: 'signup-team-all',
        totalItems: 20,
        itemsPerPage: 10,
        pageNumber: 1,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <InfiniteScroll {...baseProps}>
                <div/>
            </InfiniteScroll>,
        );

        expect(container).toMatchSnapshot();

        const wrapperDiv = container.querySelector(`.${baseProps.styleClass}`);

        // InfiniteScroll is styled by the user's style
        expect(wrapperDiv).toBeInTheDocument();

        // Ensure that scroll is added to InfiniteScroll wrapper div
        expect(wrapperDiv).toHaveClass('infinite-scroll');
    });

    test('should attach and remove event listeners', () => {
        const addEventListenerSpy = vi.spyOn(HTMLDivElement.prototype, 'addEventListener');
        const removeEventListenerSpy = vi.spyOn(HTMLDivElement.prototype, 'removeEventListener');

        const {unmount, container} = renderWithContext(
            <InfiniteScroll {...baseProps}>
                <div/>
            </InfiniteScroll>,
        );

        // Verify component is mounted and scroll listener is attached
        expect(container.querySelector('.infinite-scroll')).toBeInTheDocument();
        expect(addEventListenerSpy).toHaveBeenCalledWith('scroll', expect.any(Function));

        // When unmounted, event listeners should be cleaned up
        unmount();
        expect(removeEventListenerSpy).toHaveBeenCalledWith('scroll', expect.any(Function));

        addEventListenerSpy.mockRestore();
        removeEventListenerSpy.mockRestore();
    });

    test('should execute call back function when scroll reaches the bottom and there \'s more data and no current fetch is taking place', async () => {
        const callBack = vi.fn().mockResolvedValue(undefined);
        const {container} = renderWithContext(
            <InfiniteScroll
                {...baseProps}
                callBack={callBack}
            >
                <div style={{height: '1000px'}}>{'Content'}</div>
            </InfiniteScroll>,
        );

        // Initially callback should not have been called
        expect(callBack).toHaveBeenCalledTimes(0);

        const scrollDiv = container.querySelector('.infinite-scroll') as HTMLDivElement;
        expect(scrollDiv).toBeInTheDocument();

        // Mock scroll properties to simulate being near bottom
        Object.defineProperty(scrollDiv, 'scrollHeight', {value: 1000, configurable: true});
        Object.defineProperty(scrollDiv, 'clientHeight', {value: 400, configurable: true});
        Object.defineProperty(scrollDiv, 'scrollTop', {value: 550, writable: true, configurable: true});

        // Trigger scroll event
        scrollDiv.dispatchEvent(new Event('scroll'));

        // Wait for debounced handler and callback
        await waitFor(() => {
            expect(callBack).toHaveBeenCalledTimes(1);
        }, {timeout: 500});
    });

    test('should not execute call back even if scroll is a the bottom when there \'s no more data', async () => {
        const callBack = vi.fn().mockResolvedValue(undefined);
        const props = {
            ...baseProps,
            callBack,
            totalItems: 10,
            itemsPerPage: 10,
            pageNumber: 1, // pageNumber equals total pages, so end of data
        };

        const {container} = renderWithContext(
            <InfiniteScroll {...props}>
                <div style={{height: '1000px'}}>{'Content'}</div>
            </InfiniteScroll>,
        );

        const scrollDiv = container.querySelector('.infinite-scroll') as HTMLDivElement;
        expect(scrollDiv).toBeInTheDocument();

        // Mock scroll properties
        Object.defineProperty(scrollDiv, 'scrollHeight', {value: 1000, configurable: true});
        Object.defineProperty(scrollDiv, 'clientHeight', {value: 400, configurable: true});
        Object.defineProperty(scrollDiv, 'scrollTop', {value: 550, writable: true, configurable: true});

        // Trigger scroll event
        scrollDiv.dispatchEvent(new Event('scroll'));

        // Wait a bit and verify callback is called (first call sets isEndOfData)
        await waitFor(() => {
            expect(callBack).toHaveBeenCalledTimes(1);
        }, {timeout: 500});

        // Now trigger another scroll - should NOT call again since end of data was reached
        scrollDiv.dispatchEvent(new Event('scroll'));

        // Wait and verify callback was NOT called again
        await new Promise((resolve) => setTimeout(resolve, 300));
        expect(callBack).toHaveBeenCalledTimes(1);
    });

    test('should not show loading screen if there is no data', () => {
        const {container} = renderWithContext(
            <InfiniteScroll {...baseProps}>
                <div/>
            </InfiniteScroll>,
        );

        // Initially loading screen should not be visible (isFetching is false)
        const loadingDiv = container.querySelector('.loading-screen');
        expect(loadingDiv).not.toBeInTheDocument();
    });
});
