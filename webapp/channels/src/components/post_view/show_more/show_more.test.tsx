// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import ShowMore from 'components/post_view/show_more/show_more';

import {renderWithContext, screen, fireEvent, act} from 'tests/react_testing_utils';

describe('components/post_view/ShowMore', () => {
    const children = (<div><p>{'text'}</p></div>);
    const baseProps = {
        checkOverflow: 0,
        isAttachmentText: false,
        maxHeight: 200,
        text: 'text',
        compactDisplay: false,
    };

    // Helper function to mock the text container's scrollHeight
    const mockTextContainerScrollHeight = (scrollHeight: number) => {
        // Mock the scrollHeight property
        Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
            configurable: true,
            value: scrollHeight,
        });
    };

    // Helper function to restore the original scrollHeight behavior
    const restoreTextContainerScrollHeight = () => {
        // Delete the mocked scrollHeight property
        delete (HTMLElement.prototype as any).scrollHeight;
    };

    afterEach(() => {
        restoreTextContainerScrollHeight();
    });

    test('should match snapshot', () => {
        const {container} = renderWithContext(<ShowMore {...baseProps}>{children}</ShowMore>);
        expect(container).toMatchSnapshot();
    });

    test('should render collapsed view when content overflows', () => {
        // Setup fake timers
        jest.useFakeTimers();
        try {
            // Mock scrollHeight to be greater than maxHeight to simulate overflow
            mockTextContainerScrollHeight(baseProps.maxHeight + 50);

            const {container} = renderWithContext(
                <ShowMore {...baseProps}>
                    <div style={{height: '300px'}}>{'Tall content that will overflow'}</div>
                </ShowMore>,
            );

            // Manually trigger the overflow check
            act(() => {
                // Run the requestAnimationFrame callback
                jest.runOnlyPendingTimers();
            });

            // Verify the "Show more" button is rendered
            const showMoreButton = screen.getByText('Show more');
            expect(showMoreButton).toBeInTheDocument();

            // Verify the collapsed class is applied
            expect(container.querySelector('.post-message--collapsed')).toBeInTheDocument();
        } finally {
            jest.useRealTimers();
        }
    });

    test('should render expanded view when show more button is clicked', () => {
        // Setup fake timers
        jest.useFakeTimers();
        try {
            // Mock scrollHeight to be greater than maxHeight to simulate overflow
            mockTextContainerScrollHeight(baseProps.maxHeight + 50);

            const {container} = renderWithContext(
                <ShowMore {...baseProps}>
                    <div style={{height: '300px'}}>{'Tall content that will overflow'}</div>
                </ShowMore>,
            );

            // Manually trigger the overflow check
            act(() => {
                // Run the requestAnimationFrame callback
                jest.runOnlyPendingTimers();
            });

            // Find and click the "Show more" button
            const showMoreButton = screen.getByText('Show more');
            fireEvent.click(showMoreButton);

            // Verify the "Show less" button is now rendered
            const showLessButton = screen.getByText('Show less');
            expect(showLessButton).toBeInTheDocument();

            // Verify the expanded class is applied
            expect(container.querySelector('.post-message--expanded')).toBeInTheDocument();
        } finally {
            jest.useRealTimers();
        }
    });

    test('should render attachment text in collapsed view', () => {
        // Setup fake timers
        jest.useFakeTimers();
        try {
            // Mock scrollHeight to be greater than maxHeight to simulate overflow
            mockTextContainerScrollHeight(baseProps.maxHeight + 50);

            const {container} = renderWithContext(
                <ShowMore
                    {...baseProps}
                    isAttachmentText={true}
                >
                    <div style={{height: '300px'}}>{'Attachment text that will overflow'}</div>
                </ShowMore>,
            );

            // Manually trigger the overflow check
            act(() => {
                // Run the requestAnimationFrame callback
                jest.runOnlyPendingTimers();
            });

            // Verify the "Show more" button is rendered
            const showMoreButton = screen.getByText('Show more');
            expect(showMoreButton).toBeInTheDocument();

            // Verify the attachment-specific class is applied
            expect(container.querySelector('.post-attachment-collapse__show-more')).toBeInTheDocument();
        } finally {
            jest.useRealTimers();
        }
    });

    test('should render with compactDisplay', () => {
        // Setup fake timers
        jest.useFakeTimers();
        try {
            // Mock scrollHeight to be greater than maxHeight to simulate overflow
            mockTextContainerScrollHeight(baseProps.maxHeight + 50);

            const {container} = renderWithContext(
                <ShowMore
                    {...baseProps}
                    compactDisplay={true}
                >
                    <div style={{height: '300px'}}>{'Content with compact display'}</div>
                </ShowMore>,
            );

            // Manually trigger the overflow check
            act(() => {
                // Run the requestAnimationFrame callback
                jest.runOnlyPendingTimers();
            });

            // Expand the content
            const showMoreButton = screen.getByText('Show more');
            fireEvent.click(showMoreButton);

            // Verify the component renders correctly with compact display
            expect(container.querySelector('.post-message--expanded')).toBeInTheDocument();
        } finally {
            jest.useRealTimers();
        }
    });

    test('should check overflow only when text or checkOverflow props change', () => {
        // Create a spy for requestAnimationFrame
        const originalRAF = window.requestAnimationFrame;
        const rafSpy = jest.fn((cb) => {
            cb(0);
            return 0;
        });
        window.requestAnimationFrame = rafSpy;

        try {
            // Initial render with no overflow
            mockTextContainerScrollHeight(baseProps.maxHeight - 50);
            const {rerender} = renderWithContext(<ShowMore {...baseProps}>{children}</ShowMore>);

            // Reset the RAF spy count
            rafSpy.mockClear();

            // Change props that SHOULD trigger overflow check
            rafSpy.mockClear();
            rerender(
                <ShowMore
                    {...baseProps}
                    text={'text change'}
                >{children}</ShowMore>,
            );
            expect(rafSpy).toHaveBeenCalled();

            rafSpy.mockClear();
            rerender(
                <ShowMore
                    {...baseProps}
                    text={'text another change'}
                >{children}</ShowMore>,
            );
            expect(rafSpy).toHaveBeenCalled();

            rafSpy.mockClear();
            rerender(
                <ShowMore
                    {...baseProps}
                    checkOverflow={1}
                >{children}</ShowMore>,
            );
            expect(rafSpy).toHaveBeenCalled();

            // Same checkOverflow value should not trigger another check
            rafSpy.mockClear();
            rerender(
                <ShowMore
                    {...baseProps}
                    checkOverflow={1}
                >{children}</ShowMore>,
            );
            expect(rafSpy).not.toHaveBeenCalled();
        } finally {
            // Restore original requestAnimationFrame
            window.requestAnimationFrame = originalRAF;
        }
    });

    describe('ResizeObserver functionality', () => {
        let originalResizeObserver: any;

        beforeEach(() => {
            // Store original implementation
            originalResizeObserver = window.ResizeObserver;

            // Setup fake timers for requestAnimationFrame
            jest.useFakeTimers();
        });

        afterEach(() => {
            // Restore original implementation
            window.ResizeObserver = originalResizeObserver;

            // Restore real timers
            jest.useRealTimers();
        });

        test('should set up ResizeObserver on mount', () => {
            // Track observer creation
            const observeMock = jest.fn();
            const disconnectMock = jest.fn();

            // Mock ResizeObserver
            window.ResizeObserver = jest.fn().mockImplementation(() => ({
                observe: observeMock,
                disconnect: disconnectMock,
            })) as unknown as typeof ResizeObserver;

            // Render component
            renderWithContext(<ShowMore {...baseProps}>{children}</ShowMore>);

            // Verify ResizeObserver was created
            expect(window.ResizeObserver).toHaveBeenCalled();

            // Verify observe was called (meaning the text container is being observed)
            expect(observeMock).toHaveBeenCalled();
        });

        test('should check overflow when ResizeObserver detects size changes', () => {
            // Create a mock ResizeObserver that can be triggered manually
            let resizeCallback: ResizeObserverCallback | undefined;
            window.ResizeObserver = jest.fn().mockImplementation((callback) => {
                resizeCallback = callback;
                return {
                    observe: jest.fn(),
                    disconnect: jest.fn(),
                };
            }) as unknown as typeof ResizeObserver;

            // Mock requestAnimationFrame to execute callback immediately
            const originalRAF = window.requestAnimationFrame;
            window.requestAnimationFrame = (cb) => {
                cb(0);
                return 0;
            };

            try {
                // Mock scrollHeight to be greater than maxHeight after resize
                mockTextContainerScrollHeight(baseProps.maxHeight - 50);

                // Render component
                const {container} = renderWithContext(<ShowMore {...baseProps}>{children}</ShowMore>);

                // Verify no overflow initially
                expect(container.querySelector('.post-message--overflow')).not.toBeInTheDocument();

                // Now simulate a resize that causes overflow
                mockTextContainerScrollHeight(baseProps.maxHeight + 50);

                // Trigger the ResizeObserver callback
                if (resizeCallback && container.querySelector('.post-message__text-container')) {
                    const mockEntry = [{
                        target: container.querySelector('.post-message__text-container') as Element,
                        contentRect: {} as DOMRectReadOnly,
                        borderBoxSize: [] as ResizeObserverSize[],
                        contentBoxSize: [] as ResizeObserverSize[],
                        devicePixelContentBoxSize: [] as ResizeObserverSize[],
                    }];

                    act(() => {
                        resizeCallback!(mockEntry, {} as ResizeObserver);
                    });
                }

                // Verify overflow is detected
                expect(container.querySelector('.post-message--overflow')).toBeInTheDocument();
            } finally {
                // Restore original requestAnimationFrame
                window.requestAnimationFrame = originalRAF;
            }
        });

        test('should clean up ResizeObserver on unmount', () => {
            // Create mock with disconnect spy
            const disconnectSpy = jest.fn();
            window.ResizeObserver = jest.fn(() => ({
                observe: jest.fn(),
                disconnect: disconnectSpy,
            })) as unknown as typeof ResizeObserver;

            // Render and unmount component
            const {unmount} = renderWithContext(<ShowMore {...baseProps}>{children}</ShowMore>);
            unmount();

            // Verify disconnect was called
            expect(disconnectSpy).toHaveBeenCalled();
        });

        test('should handle browsers without ResizeObserver support', () => {
            // Remove ResizeObserver
            delete (window as any).ResizeObserver;

            // Render component should not throw error
            expect(() => {
                renderWithContext(<ShowMore {...baseProps}>{children}</ShowMore>);
            }).not.toThrow();
        });

        test('should update isOverflow state when content height changes', () => {
            // Mock ResizeObserver before rendering
            window.ResizeObserver = jest.fn().mockImplementation(() => {
                return {
                    observe: jest.fn(),
                    disconnect: jest.fn(),
                };
            }) as unknown as typeof ResizeObserver;

            // Mock requestAnimationFrame to execute callback immediately
            const originalRAF = window.requestAnimationFrame;
            window.requestAnimationFrame = (cb) => {
                cb(0);
                return 0;
            };

            try {
                // Initial render with no overflow
                mockTextContainerScrollHeight(baseProps.maxHeight - 50);
                const {container, rerender} = renderWithContext(<ShowMore {...baseProps}>{children}</ShowMore>);

                // Verify no overflow initially
                expect(container.querySelector('.post-message--overflow')).not.toBeInTheDocument();

                // Now simulate content that overflows
                mockTextContainerScrollHeight(baseProps.maxHeight + 50);

                // Force a re-render to trigger checkTextOverflow
                rerender(
                    <ShowMore
                        {...baseProps}
                        checkOverflow={1}
                    >{children}</ShowMore>,
                );

                // Verify overflow is detected
                expect(container.querySelector('.post-message--overflow')).toBeInTheDocument();
            } finally {
                // Restore original requestAnimationFrame
                window.requestAnimationFrame = originalRAF;
            }
        });
    });
});
