// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getHistory} from 'utils/browser_history';

import {BrowserPopouts} from './browser_popouts';

// Mock dependencies
jest.mock('utils/browser_history', () => ({
    getHistory: jest.fn(),
}));

const mockGetHistory = getHistory as jest.MockedFunction<typeof getHistory>;

describe('BrowserPopouts', () => {
    let browserPopouts: BrowserPopouts;
    let mockWindowOpen: jest.SpyInstance;
    let originalAddEventListener: typeof window.addEventListener;
    let originalPostMessage: typeof window.postMessage;
    let messageListeners: Array<(event: MessageEvent) => void>;

    beforeEach(() => {
        // Clear any existing listeners
        messageListeners = [];
        originalAddEventListener = window.addEventListener;
        originalPostMessage = window.postMessage;

        window.addEventListener = jest.fn((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
            if (type === 'message' && typeof listener === 'function') {
                messageListeners.push(listener as (event: MessageEvent) => void);
            }
            return originalAddEventListener.call(window, type, listener, options);
        }) as typeof window.addEventListener;
        window.postMessage = jest.fn();

        mockWindowOpen = jest.spyOn(window, 'open');

        const mockHistory = {
            push: jest.fn(),
        };
        mockGetHistory.mockReturnValue(mockHistory as unknown as ReturnType<typeof getHistory>);

        Object.defineProperty(window, 'location', {
            value: {
                origin: 'https://example.com',
            },
            writable: true,
        });
        Object.defineProperty(window, 'screenX', {value: 0, writable: true});
        Object.defineProperty(window, 'outerWidth', {value: 1920, writable: true});
        Object.defineProperty(window, 'screenY', {value: 0, writable: true});
        Object.defineProperty(window, 'innerHeight', {value: 1080, writable: true});

        browserPopouts = new BrowserPopouts();
    });

    afterEach(() => {
        // Restore original methods
        window.addEventListener = originalAddEventListener;
        window.postMessage = originalPostMessage;
        mockWindowOpen.mockRestore();
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    describe('setupBrowserPopout', () => {
        it('should open a popout window with correct parameters', () => {
            const mockPopoutWindow = {
                closed: false,
                postMessage: jest.fn(),
            } as unknown as Window;

            mockWindowOpen.mockReturnValue(mockPopoutWindow);

            const path = '/_popout/thread/team-1/thread-123';
            const result = browserPopouts.setupBrowserPopout(path);

            expect(mockWindowOpen).toHaveBeenCalledWith(
                path,
                'thread-team-1-thread-123',
                'popup=true,left=1120,top=100,width=800,height=880',
            );
            expect(result).toHaveProperty('send');
            expect(result).toHaveProperty('message');
            expect(result).toHaveProperty('closed');
        });

        it('should calculate correct window position', () => {
            const mockPopoutWindow = {
                closed: false,
                postMessage: jest.fn(),
            } as unknown as Window;

            mockWindowOpen.mockReturnValue(mockPopoutWindow);

            Object.defineProperty(window, 'screenX', {value: 100, writable: true});
            Object.defineProperty(window, 'outerWidth', {value: 1600, writable: true});
            Object.defineProperty(window, 'screenY', {value: 50, writable: true});
            Object.defineProperty(window, 'innerHeight', {value: 900, writable: true});

            browserPopouts.setupBrowserPopout('/_popout/test');

            const callArgs = mockWindowOpen.mock.calls[0];

            // These are be based on where the window is opened relative to the screen
            expect(callArgs[2]).toContain('left=900');
            expect(callArgs[2]).toContain('top=150');
            expect(callArgs[2]).toContain('width=800');
            expect(callArgs[2]).toContain('height=700');
        });

        it('should handle multiple popout windows independently', () => {
            const mockPopoutWindow1 = {
                closed: false,
                postMessage: jest.fn(),
            } as unknown as Window;

            const mockPopoutWindow2 = {
                closed: false,
                postMessage: jest.fn(),
            } as unknown as Window;

            mockWindowOpen.mockReturnValueOnce(mockPopoutWindow1).mockReturnValueOnce(mockPopoutWindow2);

            const result1 = browserPopouts.setupBrowserPopout('/_popout/test1');
            const result2 = browserPopouts.setupBrowserPopout('/_popout/test2');

            const listener1 = jest.fn();
            const listener2 = jest.fn();

            if (result1.message) {
                result1.message(listener1);
            }
            if (result2.message) {
                result2.message(listener2);
            }

            const messageEvent1 = new MessageEvent('message', {
                data: {
                    channel: 'channel1',
                    args: [],
                },
                origin: 'https://example.com',
                source: mockPopoutWindow1,
            });

            const messageEvent2 = new MessageEvent('message', {
                data: {
                    channel: 'channel2',
                    args: [],
                },
                origin: 'https://example.com',
                source: mockPopoutWindow2,
            });

            messageListeners.forEach((listener) => {
                listener(messageEvent1);
                listener(messageEvent2);
            });

            expect(listener1).toHaveBeenCalledWith('channel1');
            expect(listener2).toHaveBeenCalledWith('channel2');
            expect(listener1).not.toHaveBeenCalledWith('channel2');
            expect(listener2).not.toHaveBeenCalledWith('channel1');
        });
    });

    describe('send', () => {
        it('should handle multiple arguments', () => {
            const mockPopoutWindow = {
                closed: false,
                postMessage: jest.fn(),
            } as unknown as Window;

            mockWindowOpen.mockReturnValue(mockPopoutWindow);

            const result = browserPopouts.setupBrowserPopout('/_popout/test');
            if (result.send) {
                result.send('channel', 1, true, {nested: 'object'}, ['array']);
            }

            expect(mockPopoutWindow.postMessage).toHaveBeenCalledWith(
                {
                    channel: 'channel',
                    args: [1, true, {nested: 'object'}, ['array']],
                },
                'https://example.com',
            );
        });
    });

    describe('message listener', () => {
        it('should allow multiple message listeners', () => {
            const mockPopoutWindow = {
                closed: false,
                postMessage: jest.fn(),
            } as unknown as Window;

            mockWindowOpen.mockReturnValue(mockPopoutWindow);

            const result = browserPopouts.setupBrowserPopout('/_popout/test');
            const listener1 = jest.fn();
            const listener2 = jest.fn();

            if (result.message) {
                result.message(listener1);
                result.message(listener2);
            }

            const messageEvent = new MessageEvent('message', {
                data: {
                    channel: 'test-channel',
                    args: ['data'],
                },
                origin: 'https://example.com',
                source: mockPopoutWindow,
            });

            messageListeners.forEach((listener) => listener(messageEvent));

            expect(listener1).toHaveBeenCalledWith('test-channel', 'data');
            expect(listener2).toHaveBeenCalledWith('test-channel', 'data');
        });

        it('should unregister message listener when cleanup function is called', () => {
            const mockPopoutWindow = {
                closed: false,
                postMessage: jest.fn(),
            } as unknown as Window;

            mockWindowOpen.mockReturnValue(mockPopoutWindow);

            const result = browserPopouts.setupBrowserPopout('/_popout/test');
            const listener = jest.fn();
            let cleanup: (() => void) | undefined;
            if (result.message) {
                cleanup = result.message(listener);
            }

            if (cleanup) {
                cleanup();
            }

            const messageEvent = new MessageEvent('message', {
                data: {
                    channel: 'test-channel',
                    args: [],
                },
                origin: 'https://example.com',
                source: mockPopoutWindow,
            });

            messageListeners.forEach((listener) => listener(messageEvent));

            expect(listener).not.toHaveBeenCalled();
        });

        it('should ignore messages from unknown windows or wrong origin', () => {
            const mockPopoutWindow = {
                closed: false,
                postMessage: jest.fn(),
            } as unknown as Window;

            mockWindowOpen.mockReturnValue(mockPopoutWindow);

            const result = browserPopouts.setupBrowserPopout('/_popout/test');
            const listener = jest.fn();
            if (result.message) {
                result.message(listener);
            }

            // Test unknown window
            const unknownWindow = {} as Window;
            const unknownMessageEvent = new MessageEvent('message', {
                data: {
                    channel: 'test-channel',
                    args: [],
                },
                origin: 'https://example.com',
                source: unknownWindow,
            });

            messageListeners.forEach((listener) => listener(unknownMessageEvent));
            expect(listener).not.toHaveBeenCalled();

            // Test wrong origin
            const wrongOriginEvent = new MessageEvent('message', {
                data: {
                    channel: 'test-channel',
                    args: [],
                },
                origin: 'https://evil.com',
                source: mockPopoutWindow,
            });

            messageListeners.forEach((listener) => listener(wrongOriginEvent));
            expect(listener).not.toHaveBeenCalled();
        });
    });

    describe('_navigate channel', () => {
        it('should handle _navigate message and push to history', () => {
            const mockPopoutWindow = {
                closed: false,
                postMessage: jest.fn(),
            } as unknown as Window;

            mockWindowOpen.mockReturnValue(mockPopoutWindow);

            Object.defineProperty(window, 'focus', {value: jest.fn(), writable: true});

            browserPopouts.setupBrowserPopout('/_popout/test');

            const messageEvent = new MessageEvent('message', {
                data: {
                    channel: '_navigate',
                    args: ['/new-path'],
                },
                origin: 'https://example.com',
                source: mockPopoutWindow,
            });

            messageListeners.forEach((listener) => listener(messageEvent));

            expect(window.focus).toHaveBeenCalled();
            expect(mockGetHistory().push).toHaveBeenCalledWith('/new-path');
        });
    });

    describe('_close channel', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        it('should handle multiple close listeners', () => {
            const mockPopoutWindow = {
                closed: false,
                postMessage: jest.fn(),
            } as unknown as Window;

            mockWindowOpen.mockReturnValue(mockPopoutWindow);

            const result = browserPopouts.setupBrowserPopout('/_popout/test');
            const closeListener1 = jest.fn();
            const closeListener2 = jest.fn();

            if (result.closed) {
                result.closed(closeListener1);
                result.closed(closeListener2);
            }

            const messageEvent = new MessageEvent('message', {
                data: {
                    channel: '_close',
                    args: [],
                },
                origin: 'https://example.com',
                source: mockPopoutWindow,
            });

            messageListeners.forEach((listener) => listener(messageEvent));

            Object.defineProperty(mockPopoutWindow, 'closed', {
                value: true,
                writable: true,
            });

            jest.advanceTimersByTime(200);

            expect(closeListener1).toHaveBeenCalled();
            expect(closeListener2).toHaveBeenCalled();
        });

        it('should stop polling after max tries if window is not closed', () => {
            const mockPopoutWindow = {
                closed: false,
                postMessage: jest.fn(),
            } as unknown as Window;

            mockWindowOpen.mockReturnValue(mockPopoutWindow);

            const result = browserPopouts.setupBrowserPopout('/_popout/test');
            const closeListener = jest.fn();
            if (result.closed) {
                result.closed(closeListener);
            }

            const messageEvent = new MessageEvent('message', {
                data: {
                    channel: '_close',
                    args: [],
                },
                origin: 'https://example.com',
                source: mockPopoutWindow,
            });

            messageListeners.forEach((listener) => listener(messageEvent));

            jest.advanceTimersByTime(2000);

            expect(closeListener).not.toHaveBeenCalled();
        });

        it('should clean up listeners and window reference when closed', () => {
            const mockPopoutWindow = {
                closed: false,
                postMessage: jest.fn(),
            } as unknown as Window;

            mockWindowOpen.mockReturnValue(mockPopoutWindow);

            const result = browserPopouts.setupBrowserPopout('/_popout/test');
            const messageListener = jest.fn();
            const closeListener = jest.fn();

            if (result.message) {
                result.message(messageListener);
            }
            if (result.closed) {
                result.closed(closeListener);
            }

            const closeMessageEvent = new MessageEvent('message', {
                data: {
                    channel: '_close',
                    args: [],
                },
                origin: 'https://example.com',
                source: mockPopoutWindow,
            });

            messageListeners.forEach((listener) => listener(closeMessageEvent));

            Object.defineProperty(mockPopoutWindow, 'closed', {
                value: true,
                writable: true,
            });

            jest.advanceTimersByTime(200);
            expect(closeListener).toHaveBeenCalled();

            const messageEvent = new MessageEvent('message', {
                data: {
                    channel: 'test-channel',
                    args: [],
                },
                origin: 'https://example.com',
                source: mockPopoutWindow,
            });

            messageListeners.forEach((listener) => listener(messageEvent));
            expect(messageListener).not.toHaveBeenCalled();
        });

        it('should unregister close listener when cleanup function is called', () => {
            const mockPopoutWindow = {
                closed: false,
                postMessage: jest.fn(),
            } as unknown as Window;

            mockWindowOpen.mockReturnValue(mockPopoutWindow);

            const result = browserPopouts.setupBrowserPopout('/_popout/test');
            const closeListener = jest.fn();
            let cleanup: (() => void) | undefined;
            if (result.closed) {
                cleanup = result.closed(closeListener);
            }

            if (cleanup) {
                cleanup();
            }

            const messageEvent = new MessageEvent('message', {
                data: {
                    channel: '_close',
                    args: [],
                },
                origin: 'https://example.com',
                source: mockPopoutWindow,
            });

            messageListeners.forEach((listener) => listener(messageEvent));

            Object.defineProperty(mockPopoutWindow, 'closed', {
                value: true,
                writable: true,
            });

            jest.advanceTimersByTime(200);

            expect(closeListener).not.toHaveBeenCalled();
        });
    });

    describe('sendToParent', () => {
        it('should send message to parent window', () => {
            const mockOpener = {
                postMessage: jest.fn(),
            } as unknown as Window;

            Object.defineProperty(window, 'opener', {
                value: mockOpener,
                writable: true,
            });

            browserPopouts.sendToParent('test-channel', 'arg1', 'arg2');

            expect(mockOpener.postMessage).toHaveBeenCalledWith(
                {
                    channel: 'test-channel',
                    args: ['arg1', 'arg2'],
                },
                'https://example.com',
            );
        });
    });

    describe('onMessageFromParent', () => {
        it('should register listener for messages from parent window', () => {
            const mockOpener = {
                postMessage: jest.fn(),
            } as unknown as Window;

            Object.defineProperty(window, 'opener', {
                value: mockOpener,
                writable: true,
            });

            const listener = jest.fn();
            browserPopouts.onMessageFromParent(listener);

            const messageEvent = new MessageEvent('message', {
                data: {
                    channel: 'parent-channel',
                    args: ['data1', 'data2'],
                },
                origin: 'https://example.com',
                source: mockOpener,
            });

            const parentListener = messageListeners[messageListeners.length - 1];
            parentListener(messageEvent);

            expect(listener).toHaveBeenCalledWith('parent-channel', 'data1', 'data2');
        });

        it('should ignore messages from parent with wrong origin or not from opener', () => {
            const mockOpener = {
                postMessage: jest.fn(),
            } as unknown as Window;

            const otherWindow = {
                postMessage: jest.fn(),
            } as unknown as Window;

            Object.defineProperty(window, 'opener', {
                value: mockOpener,
                writable: true,
            });

            const listener = jest.fn();
            browserPopouts.onMessageFromParent(listener);

            const parentListener = messageListeners[messageListeners.length - 1];

            // Test wrong origin
            const wrongOriginEvent = new MessageEvent('message', {
                data: {
                    channel: 'parent-channel',
                    args: [],
                },
                origin: 'https://evil.com',
                source: mockOpener,
            });

            parentListener(wrongOriginEvent);
            expect(listener).not.toHaveBeenCalled();

            // Test not from opener
            const wrongSourceEvent = new MessageEvent('message', {
                data: {
                    channel: 'parent-channel',
                    args: [],
                },
                origin: 'https://example.com',
                source: otherWindow,
            });

            parentListener(wrongSourceEvent);
            expect(listener).not.toHaveBeenCalled();
        });
    });
});

