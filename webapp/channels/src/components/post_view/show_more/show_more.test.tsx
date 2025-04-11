// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow, mount} from 'enzyme';
import React from 'react';

import ShowMore from 'components/post_view/show_more/show_more';

describe('components/post_view/ShowMore', () => {
    const children = (<div><p>{'text'}</p></div>);
    const baseProps = {
        checkOverflow: 0,
        isAttachmentText: false,
        isRHSExpanded: false,
        isRHSOpen: false,
        maxHeight: 200,
        text: 'text',
        compactDisplay: false,
    };

    test('should match snapshot', () => {
        const wrapper = shallow(<ShowMore {...baseProps}>{children}</ShowMore>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, PostMessageView on collapsed view', () => {
        const wrapper = shallow(<ShowMore {...baseProps}/>);
        wrapper.setState({isOverflow: true, isCollapsed: true});
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, PostMessageView on expanded view', () => {
        const wrapper = shallow(<ShowMore {...baseProps}/>);
        wrapper.setState({isOverflow: true, isCollapsed: false});
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, PostAttachment on collapsed view', () => {
        const wrapper = shallow(
            <ShowMore
                {...baseProps}
                isAttachmentText={true}
            />,
        );
        wrapper.setState({isOverflow: true, isCollapsed: true});
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, PostAttachment on expanded view', () => {
        const wrapper = shallow(
            <ShowMore
                {...baseProps}
                isAttachmentText={true}
            />,
        );
        wrapper.setState({isOverflow: true, isCollapsed: false});
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, PostMessageView on expanded view with compactDisplay', () => {
        const wrapper = shallow(
            <ShowMore
                {...baseProps}
                compactDisplay={true}
            />,
        );
        wrapper.setState({isOverflow: true, isCollapsed: false});
        expect(wrapper).toMatchSnapshot();
    });

    test('should call checkTextOverflow', () => {
        const wrapper = shallow(<ShowMore {...baseProps}/>);
        const instance = wrapper.instance() as ShowMore;
        instance.checkTextOverflow = jest.fn();

        expect(instance.checkTextOverflow).not.toBeCalled();

        wrapper.setProps({isRHSExpanded: true});
        expect(instance.checkTextOverflow).toBeCalledTimes(1);

        wrapper.setProps({isRHSExpanded: false});
        expect(instance.checkTextOverflow).toBeCalledTimes(2);

        wrapper.setProps({isRHSOpen: true});
        expect(instance.checkTextOverflow).toBeCalledTimes(3);

        wrapper.setProps({isRHSOpen: false});
        expect(instance.checkTextOverflow).toBeCalledTimes(4);

        wrapper.setProps({text: 'text change'});
        expect(instance.checkTextOverflow).toBeCalledTimes(5);

        wrapper.setProps({text: 'text another change'});
        expect(instance.checkTextOverflow).toBeCalledTimes(6);

        wrapper.setProps({checkOverflow: 1});
        expect(instance.checkTextOverflow).toBeCalledTimes(7);

        wrapper.setProps({checkOverflow: 1});
        expect(instance.checkTextOverflow).toBeCalledTimes(7);
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
            let observerCallback: ResizeObserverCallback | null = null;
            let observedElement: Element | null = null;

            // Mock ResizeObserver
            window.ResizeObserver = jest.fn((callback) => {
                observerCallback = callback;
                return {
                    observe: (element: Element) => {
                        observedElement = element;
                    },
                    disconnect: jest.fn(),
                } as unknown as ResizeObserver;
            }) as unknown as typeof ResizeObserver;

            // Mount component
            const wrapper = mount(<ShowMore {...baseProps}>{children}</ShowMore>);

            // Get the text container ref from the DOM
            const textContainer = wrapper.find('.post-message__text-container').getDOMNode();

            // Verify ResizeObserver was created
            expect(window.ResizeObserver).toHaveBeenCalled();
            expect(observerCallback).not.toBeNull();

            // Verify the text container is being observed
            expect(observedElement).toBe(textContainer);
        });

        test('should check overflow when ResizeObserver detects size changes', () => {
            // Create a spy for the checkTextOverflow method
            const checkTextOverflowSpy = jest.fn();

            // Mock ResizeObserver to call our spy when triggered
            window.ResizeObserver = jest.fn(() => {
                return {
                    observe: jest.fn(),
                    disconnect: jest.fn(),

                    // When the callback is triggered, call our spy
                    simulateResize: () => {
                        checkTextOverflowSpy();
                    },
                } as any;
            }) as unknown as typeof ResizeObserver;

            // Replace the ShowMore's checkTextOverflow method with our spy
            const originalMethod = ShowMore.prototype.checkTextOverflow;
            ShowMore.prototype.checkTextOverflow = checkTextOverflowSpy;

            try {
                // Mount component
                mount(<ShowMore {...baseProps}>{children}</ShowMore>);

                // Get the ResizeObserver instance
                const resizeObserverInstance = (window.ResizeObserver as jest.Mock).mock.results[0].value;

                // Manually trigger the resize
                resizeObserverInstance.simulateResize();

                // Verify checkTextOverflow was called
                expect(checkTextOverflowSpy).toHaveBeenCalled();
            } finally {
                // Restore the original method
                ShowMore.prototype.checkTextOverflow = originalMethod;
            }
        });

        test('should clean up ResizeObserver on unmount', () => {
            // Create mock with disconnect spy
            const disconnectSpy = jest.fn();
            window.ResizeObserver = jest.fn(() => ({
                observe: jest.fn(),
                disconnect: disconnectSpy,
            })) as unknown as typeof ResizeObserver;

            // Mount and unmount component
            const wrapper = mount(<ShowMore {...baseProps}>{children}</ShowMore>);
            wrapper.unmount();

            // Verify disconnect was called
            expect(disconnectSpy).toHaveBeenCalled();
        });

        test('should handle browsers without ResizeObserver support', () => {
            // Remove ResizeObserver
            delete (window as any).ResizeObserver;

            // Mount component should not throw error
            expect(() => {
                mount(<ShowMore {...baseProps}>{children}</ShowMore>);
            }).not.toThrow();
        });

        test('should update isOverflow state when content height changes', () => {
            // Mock requestAnimationFrame to execute callback immediately
            const originalRAF = window.requestAnimationFrame;
            window.requestAnimationFrame = (cb) => {
                cb(0);
                return 0;
            };

            try {
                // Create a component with a mocked textContainer
                const wrapper = shallow(<ShowMore {...baseProps}>{children}</ShowMore>);
                const instance = wrapper.instance() as ShowMore;

                // Spy on setState
                const setStateSpy = jest.spyOn(instance, 'setState');

                // Mock the textContainer ref
                const mockTextContainer = {
                    scrollHeight: baseProps.maxHeight - 50, // Initially less than maxHeight
                };

                // Replace the textContainer ref with our mock
                Object.defineProperty(instance, 'textContainer', {
                    get: () => ({
                        current: mockTextContainer,
                    }),
                });

                // Call checkTextOverflow directly
                instance.checkTextOverflow();

                // Force the requestAnimationFrame callback to execute
                jest.runAllTimers();

                // Verify setState was not called with isOverflow: true (since scrollHeight < maxHeight)
                expect(wrapper.state('isOverflow')).toBe(false);

                // Now change the scrollHeight to be greater than maxHeight
                mockTextContainer.scrollHeight = baseProps.maxHeight + 50;

                // Call checkTextOverflow again
                instance.checkTextOverflow();

                // Force the requestAnimationFrame callback to execute
                jest.runAllTimers();

                // Verify setState was called with isOverflow: true
                expect(setStateSpy).toHaveBeenCalledWith({isOverflow: true});

                // Update the wrapper to reflect state changes
                wrapper.update();

                // Verify state was updated
                expect(wrapper.state('isOverflow')).toBe(true);
            } finally {
                // Restore original requestAnimationFrame
                window.requestAnimationFrame = originalRAF;

                // Make sure all timers are cleared
                jest.clearAllTimers();
            }
        });
    });
});
