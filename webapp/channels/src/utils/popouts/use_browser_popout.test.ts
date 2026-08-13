// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {sendToParent, onMessageFromParent} from './use_browser_popout';

describe('use_browser_popout', () => {
    let originalAddEventListener: typeof window.addEventListener;
    let messageListeners: Array<(event: MessageEvent) => void>;

    beforeEach(() => {
        messageListeners = [];
        originalAddEventListener = window.addEventListener;

        window.addEventListener = jest.fn((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
            if (type === 'message' && typeof listener === 'function') {
                messageListeners.push(listener as (event: MessageEvent) => void);
            }
            return originalAddEventListener.call(window, type, listener, options);
        }) as typeof window.addEventListener;
    });

    afterEach(() => {
        window.addEventListener = originalAddEventListener;
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

            sendToParent('test-channel', 'arg1', 'arg2');

            expect(mockOpener.postMessage).toHaveBeenCalledWith(
                {
                    channel: 'test-channel',
                    args: ['arg1', 'arg2'],
                },
                'http://localhost:8065',
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
            onMessageFromParent(listener);

            const messageEvent = new MessageEvent('message', {
                data: {
                    channel: 'parent-channel',
                    args: ['data1', 'data2'],
                },
                origin: 'http://localhost:8065',
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
            onMessageFromParent(listener);

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

