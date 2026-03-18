// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import InfiniteScroll from 'components/common/infinite_scroll';

import {renderWithContext, fireEvent, waitFor, act} from 'tests/react_testing_utils';

describe('/components/common/InfiniteScroll', () => {
    const baseProps = {
        callBack: jest.fn(),
        endOfData: false,
        endOfDataMessage: 'No more items to fetch',
        styleClass: 'signup-team-all',
        totalItems: 20,
        itemsPerPage: 10,
        pageNumber: 1,
        bufferValue: 100,
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(<InfiniteScroll {...baseProps}><div/></InfiniteScroll>);
        expect(container).toMatchSnapshot();

        const wrapperDiv = container.querySelector(`.${baseProps.styleClass}`);

        // InfiniteScroll is styled by the user's style
        expect(wrapperDiv).toBeInTheDocument();

        // Ensure that scroll is added to InfiniteScroll wrapper div
        expect(wrapperDiv).toHaveClass('infinite-scroll');
    });

    test('should attach and remove event listeners', () => {
        const addEventListenerSpy = jest.spyOn(HTMLDivElement.prototype, 'addEventListener');
        const removeEventListenerSpy = jest.spyOn(HTMLDivElement.prototype, 'removeEventListener');

        const {unmount} = renderWithContext(<InfiniteScroll {...baseProps}><div/></InfiniteScroll>);

        expect(addEventListenerSpy).toHaveBeenCalledWith('scroll', expect.any(Function));

        unmount();

        expect(removeEventListenerSpy).toHaveBeenCalledWith('scroll', expect.any(Function));

        addEventListenerSpy.mockRestore();
        removeEventListenerSpy.mockRestore();
    });

    test('should execute call back function when scroll reaches the bottom and there \'s more data and no current fetch is taking place', async () => {
        const {container} = renderWithContext(<InfiniteScroll {...baseProps}><div/></InfiniteScroll>);

        expect(baseProps.callBack).toHaveBeenCalledTimes(0);

        const scrollContainer = container.querySelector('.infinite-scroll') as HTMLElement;

        // Mock scroll position to simulate being at the bottom
        Object.defineProperty(scrollContainer, 'scrollHeight', {value: 1000, configurable: true});
        Object.defineProperty(scrollContainer, 'clientHeight', {value: 500, configurable: true});
        Object.defineProperty(scrollContainer, 'scrollTop', {value: 500, configurable: true});

        await act(async () => {
            // Simulate scroll event - fireEvent used because userEvent doesn't support scroll events
            fireEvent.scroll(scrollContainer);

            // Wait for debounce (200ms) plus some buffer
            await new Promise((resolve) => setTimeout(resolve, 250));
        });

        await waitFor(() => {
            expect(baseProps.callBack).toHaveBeenCalledTimes(1);
        });
    });

    test('should not execute call back even if scroll is at the bottom when there \'s no more data', async () => {
        // Set totalItems to 0 to simulate no data/end of data scenario
        const propsWithNoData = {
            ...baseProps,
            totalItems: 0,
        };

        const {container} = renderWithContext(
            <InfiniteScroll {...propsWithNoData}><div/></InfiniteScroll>,
        );

        const scrollContainer = container.querySelector('.infinite-scroll') as HTMLElement;

        // Mock scroll position to simulate being at the bottom
        Object.defineProperty(scrollContainer, 'scrollHeight', {value: 1000, configurable: true});
        Object.defineProperty(scrollContainer, 'clientHeight', {value: 500, configurable: true});
        Object.defineProperty(scrollContainer, 'scrollTop', {value: 500, configurable: true});

        await act(async () => {
            fireEvent.scroll(scrollContainer);

            // Wait for debounce (200ms) plus some buffer
            await new Promise((resolve) => setTimeout(resolve, 250));
        });

        // First scroll triggers callback, which then sets isEndofData to true since totalItems is 0
        await waitFor(() => {
            expect(baseProps.callBack).toHaveBeenCalledTimes(1);
        });

        // Subsequent scroll should not trigger callback since isEndofData is now true
        await act(async () => {
            fireEvent.scroll(scrollContainer);
            await new Promise((resolve) => setTimeout(resolve, 250));
        });

        // Should still be only 1 call
        expect(baseProps.callBack).toHaveBeenCalledTimes(1);
    });

    test('should not show loading screen if there is no data', async () => {
        // Create a callback that doesn't resolve immediately to keep loading state
        let resolveCallback: () => void;
        const slowCallback = jest.fn(() => new Promise<void>((resolve) => {
            resolveCallback = resolve;
        }));

        const propsWithSlowCallback = {
            ...baseProps,
            callBack: slowCallback,
        };

        const {container} = renderWithContext(<InfiniteScroll {...propsWithSlowCallback}><div/></InfiniteScroll>);
        let loadingDiv = container.querySelector('.loading-screen');
        expect(loadingDiv).not.toBeInTheDocument();

        // Mock scroll to trigger fetching state
        const scrollContainer = container.querySelector('.infinite-scroll') as HTMLElement;

        Object.defineProperty(scrollContainer, 'scrollHeight', {value: 1000, configurable: true});
        Object.defineProperty(scrollContainer, 'clientHeight', {value: 500, configurable: true});
        Object.defineProperty(scrollContainer, 'scrollTop', {value: 500, configurable: true});

        await act(async () => {
            fireEvent.scroll(scrollContainer);

            // Wait for debounce (200ms) plus some buffer
            await new Promise((resolve) => setTimeout(resolve, 250));
        });

        // Now it should show the loader during fetching
        loadingDiv = container.querySelector('.loading-screen');
        expect(loadingDiv).toBeInTheDocument();

        expect(container).toMatchSnapshot();

        // Resolve the callback to cleanup
        await act(async () => {
            resolveCallback!();
        });
    });
});
