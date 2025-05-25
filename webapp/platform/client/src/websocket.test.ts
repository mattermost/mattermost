// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import WebSocketClient from './websocket';

// Define some browser globals that aren't defined in node
if (typeof WebSocket === 'undefined') {
    (global as any).WebSocket = {
        CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3,
    };
}

// Mock window and navigator if they're not defined
if (typeof window === 'undefined') {
    const eventHandlers: {[key: string]: Array<(event: Event) => void>} = {};

    // Create a mock window object with working event handlers
    (global as any).window = {
        addEventListener: jest.fn((event: string, handler: (event: Event) => void) => {
            if (!eventHandlers[event]) {
                eventHandlers[event] = [];
            }
            eventHandlers[event].push(handler);
        }),
        removeEventListener: jest.fn((event: string, handler: (event: Event) => void) => {
            if (eventHandlers[event]) {
                const index = eventHandlers[event].indexOf(handler);
                if (index !== -1) {
                    eventHandlers[event].splice(index, 1);
                }
            }
        }),
        dispatchEvent: jest.fn((event: Event) => {
            const handlers = eventHandlers[event.type] || [];
            handlers.forEach((handler) => handler(event));
            return true;
        }),
    };
}

// Mock Event class if it's not defined
if (typeof Event === 'undefined') {
    (global as any).Event = class MockEvent {
        type: string;

        constructor(type: string) {
            this.type = type;
        }
    };
}

class MockWebSocket {
    readonly binaryType: BinaryType = 'blob';
    readonly bufferedAmount: number = 0;
    readonly extensions: string = '';

    readonly CONNECTING = WebSocket.CONNECTING;
    readonly OPEN = WebSocket.OPEN;
    readonly CLOSING = WebSocket.CLOSING;
    readonly CLOSED = WebSocket.CLOSED;

    public url: string = '';
    readonly protocol: string = '';
    public readyState: number = WebSocket.CONNECTING;

    public onopen: (() => void) | null = null;
    public onclose: (() => void) | null = null;
    public onerror: (() => void) | null = null;
    public onmessage: ((evt: any) => void) | null = null;

    open() {
        this.readyState = WebSocket.OPEN;
        if (this.onopen) {
            this.onopen();
        }
    }

    close() {
        this.readyState = WebSocket.CLOSED;
        if (this.onclose) {
            this.onclose();
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    send(msg: any) { }
    addEventListener() { }
    removeEventListener() { }
    dispatchEvent(): boolean {
        return false;
    }
}

describe('websocketclient', () => {
    test('initialize should register connection callbacks', () => {
        const mockWebSocket = new MockWebSocket();

        const client = new WebSocketClient({
            newWebSocketFn: (url: string) => {
                mockWebSocket.url = url;
                return mockWebSocket;
            },
        });

        client.initialize('mock.url');

        expect(mockWebSocket.onopen).toBeTruthy();
        expect(mockWebSocket.onclose).toBeTruthy();

        client.close();
    });

    test('should reconnect on websocket close', () => {
        jest.useFakeTimers();

        const mockWebSocket = new MockWebSocket();
        const openSpy = jest.spyOn(mockWebSocket, 'open');

        const client = new WebSocketClient({
            newWebSocketFn: (url: string) => {
                mockWebSocket.url = url;
                mockWebSocket.open();
                return mockWebSocket;
            },
            minWebSocketRetryTime: 10,
            reconnectJitterRange: 10,
        });

        client.initialize('mock.url');
        expect(openSpy).toHaveBeenCalledTimes(1);

        mockWebSocket.close();

        jest.advanceTimersByTime(100);

        client.close();
        expect(openSpy).toHaveBeenCalledTimes(2);

        jest.useRealTimers();
    });

    test('should close during reconnection delay', () => {
        jest.useFakeTimers();

        const mockWebSocket = new MockWebSocket();
        const openSpy = jest.spyOn(mockWebSocket, 'open');

        const client = new WebSocketClient({
            newWebSocketFn: (url: string) => {
                mockWebSocket.url = url;
                setTimeout(() => {
                    if (mockWebSocket.onopen) {
                        mockWebSocket.open();
                    }
                }, 1);
                return mockWebSocket;
            },
            minWebSocketRetryTime: 50,
            reconnectJitterRange: 1,
        });

        const initializeSpy = jest.spyOn(client, 'initialize');
        client.initialize('mock.url');
        mockWebSocket.close();

        jest.advanceTimersByTime(10);

        client.close();

        jest.advanceTimersByTime(80);

        client.close();
        expect(initializeSpy).toBeCalledTimes(1);
        expect(openSpy).toBeCalledTimes(1);

        jest.useRealTimers();
    });

    test('should not re-open if initialize called during reconnection delay', () => {
        jest.useFakeTimers();

        const mockWebSocket = new MockWebSocket();
        const openSpy = jest.spyOn(mockWebSocket, 'open');

        const client = new WebSocketClient({
            newWebSocketFn: (url: string) => {
                mockWebSocket.url = url;
                setTimeout(() => {
                    if (mockWebSocket.onopen) {
                        mockWebSocket.open();
                    }
                }, 1);
                return mockWebSocket;
            },
            minWebSocketRetryTime: 50,
            reconnectJitterRange: 1,
        });

        const initializeSpy = jest.spyOn(client, 'initialize');
        client.initialize('mock.url');
        mockWebSocket.close();

        jest.advanceTimersByTime(10);

        client.initialize('mock.url');
        expect(initializeSpy).toBeCalledTimes(2);
        expect(openSpy).toBeCalledTimes(1);

        jest.advanceTimersByTime(80);

        client.close();
        expect(initializeSpy).toBeCalledTimes(3);
        expect(openSpy).toBeCalledTimes(2);

        jest.useRealTimers();
    });

    test('should not register second reconnection timeout if onclose called twice', () => {
        jest.useFakeTimers();

        const mockWebSocket = new MockWebSocket();
        const openSpy = jest.spyOn(mockWebSocket, 'open');

        const client = new WebSocketClient({
            newWebSocketFn: (url: string) => {
                mockWebSocket.url = url;
                setTimeout(() => {
                    if (mockWebSocket.onopen) {
                        mockWebSocket.open();
                    }
                }, 1);
                return mockWebSocket;
            },
            minWebSocketRetryTime: 50,
            reconnectJitterRange: 1,
        });

        const initializeSpy = jest.spyOn(client, 'initialize');
        client.initialize('mock.url');
        mockWebSocket.close();

        jest.advanceTimersByTime(10);

        mockWebSocket.close();

        jest.advanceTimersByTime(80);

        client.close();
        expect(initializeSpy).toBeCalledTimes(2);
        expect(openSpy).toBeCalledTimes(2);

        jest.useRealTimers();
    });

    test('should stay connected after ping response', () => {
        jest.useFakeTimers();

        const mockWebSocket = new MockWebSocket();
        const client = new WebSocketClient({
            newWebSocketFn: (url: string) => {
                mockWebSocket.url = url;
                setTimeout(() => {
                    if (mockWebSocket.onopen) {
                        mockWebSocket.open();
                    }
                }, 1);
                return mockWebSocket;
            },
            minWebSocketRetryTime: 1,
            reconnectJitterRange: 1,
            clientPingInterval: 1,
        });

        let numPings = 0;
        let numPongs = 0;
        mockWebSocket.send = (evt) => {
            const msg = JSON.parse(evt);

            if (msg.action !== 'ping') {
                return;
            }
            numPings++;

            const rsp = {
                text: 'pong',
                seq_reply: msg.seq,
            };

            if (mockWebSocket.onmessage) {
                mockWebSocket.onmessage({data: JSON.stringify(rsp)});
                numPongs++;
            }
        };

        const openSpy = jest.spyOn(mockWebSocket, 'open');
        const closeSpy = jest.spyOn(mockWebSocket, 'close');

        client.initialize('mock.url');

        jest.advanceTimersByTime(30);

        client.close();

        expect(openSpy).toBeCalledTimes(1);
        expect(closeSpy).toBeCalledTimes(1);
        expect(numPings).toBeGreaterThan(10);
        expect(numPongs).toBeGreaterThan(10);

        jest.useRealTimers();
    });

    test('should reconnect after no ping response', () => {
        jest.useFakeTimers();

        const mockWebSocket = new MockWebSocket();
        const client = new WebSocketClient({
            newWebSocketFn: (url: string) => {
                mockWebSocket.url = url;
                setTimeout(() => {
                    if (mockWebSocket.onopen) {
                        mockWebSocket.open();
                    }
                }, 1);
                return mockWebSocket;
            },
            minWebSocketRetryTime: 1,
            reconnectJitterRange: 1,
            clientPingInterval: 10,
        });

        let numPings = 0;
        let numPongs = 0;
        mockWebSocket.send = (evt) => {
            const msg = JSON.parse(evt);

            if (msg.action !== 'ping') {
                return;
            }
            numPings++;

            // stop responding after three pings
            if (numPings > 3) {
                return;
            }

            const rsp = {
                text: 'pong',
                seq_reply: msg.seq,
            };

            if (mockWebSocket.onmessage) {
                mockWebSocket.onmessage({data: JSON.stringify(rsp)});
                numPongs++;
            }
        };

        mockWebSocket.open = jest.fn(mockWebSocket.open);
        mockWebSocket.close = jest.fn(() => {
            mockWebSocket.readyState = WebSocket.CLOSED;
            if (mockWebSocket.onclose) {
                mockWebSocket.onclose();
            }
            if (jest.mocked(mockWebSocket.close).mock.calls.length === 3) {
                setTimeout(() => {
                    client.close();
                }, 1);
            }
        });

        client.initialize('mock.url');

        jest.advanceTimersByTime(100);

        client.close();

        expect(mockWebSocket.open).toBeCalledTimes(3);
        expect(mockWebSocket.close).toBeCalledTimes(3);
        expect(numPings).toBe(6);
        expect(numPongs).toBe(3);

        jest.useRealTimers();
    });

    test('should reset ping interval state when reconnecting during pending ping', () => {
        jest.useFakeTimers();

        const mockWebSocket = new MockWebSocket();
        const client = new WebSocketClient({
            newWebSocketFn: (url: string) => {
                mockWebSocket.url = url;
                setTimeout(() => {
                    if (mockWebSocket.onopen) {
                        mockWebSocket.open();
                    }
                }, 1);
                return mockWebSocket;
            },
            minWebSocketRetryTime: 1,
            reconnectJitterRange: 1,
            clientPingInterval: 15,
        });

        let numPings = 0;
        let numPongs = 0;
        mockWebSocket.send = (evt) => {
            const msg = JSON.parse(evt);

            if (msg.action !== 'ping') {
                return;
            }
            numPings++;

            // don't respond to second ping
            if (numPings === 2) {
                return;
            }

            const rsp = {
                text: 'pong',
                seq_reply: msg.seq,
            };

            if (mockWebSocket.onmessage) {
                mockWebSocket.onmessage({data: JSON.stringify(rsp)});
                numPongs++;
            }
        };

        const openSpy = jest.spyOn(mockWebSocket, 'open');
        const closeSpy = jest.spyOn(mockWebSocket, 'close');

        client.initialize('mock.url');

        // Let first ping happen
        jest.advanceTimersByTime(10);
        expect(numPings).toBe(1);
        expect(numPongs).toBe(1);

        // Let second ping happen
        jest.advanceTimersByTime(10);
        expect(numPings).toBe(2);
        expect(numPongs).toBe(1);

        // Ensure we've still only connected once, and haven't disconnected, yet
        expect(openSpy).toHaveBeenCalledTimes(1);
        expect(closeSpy).toHaveBeenCalledTimes(0);

        // Close and reopen connection before ping timeout
        mockWebSocket.close();

        // Let new connection run for a while to ensure no immediate reconnect
        jest.advanceTimersByTime(100);
        client.close();

        expect(numPings).toBe(9);
        expect(numPongs).toBe(numPings - 1); // Ensure we only skipped the first response
        expect(openSpy).toHaveBeenCalledTimes(2); // Initial open and one reconnect
        expect(closeSpy).toHaveBeenCalledTimes(2); // Manual close and final close

        jest.useRealTimers();
    });

    test('should add network event listener on initialize', () => {
        // Mock window.addEventListener
        const originalAddEventListener = window.addEventListener;
        const originalRemoveEventListener = window.removeEventListener;

        const addEventListenerMock = jest.fn();
        const removeEventListenerMock = jest.fn();

        window.addEventListener = addEventListenerMock;
        window.removeEventListener = removeEventListenerMock;

        // Create client
        const mockWebSocket = new MockWebSocket();
        const client = new WebSocketClient({
            newWebSocketFn: (url: string) => {
                mockWebSocket.url = url;
                return mockWebSocket;
            },
        });

        // No listeners should be added on construction
        expect(addEventListenerMock).not.toHaveBeenCalled();

        // Initialize should add listeners
        client.initialize('mock.url');

        // Verify event listeners are added on initialize
        expect(addEventListenerMock).toHaveBeenCalledWith('online', expect.any(Function));

        // Clean up
        client.close();

        // Verify event listeners are removed
        expect(removeEventListenerMock).toHaveBeenCalledWith('online', expect.any(Function));

        // Restore mocks
        window.addEventListener = originalAddEventListener;
        window.removeEventListener = originalRemoveEventListener;
    });

    test('should reconnect when network comes online', () => {
        jest.useFakeTimers();

        var connected = true;
        const mockWebSocket = new MockWebSocket();
        const newWebSocketFn = jest.fn((url: string) => {
            mockWebSocket.url = url;

            // selectively simulate the network being down
            setTimeout(() => {
                if (!connected && mockWebSocket.onclose) {
                    mockWebSocket.close();
                }
            }, 1);

            return mockWebSocket;
        });

        // Use a small minWebSocketRetryTime to speed up the test
        const client = new WebSocketClient({
            newWebSocketFn,
            minWebSocketRetryTime: 100,
            maxWebSocketRetryTime: 1000,
        });

        // Initialize the client
        client.initialize('mock.url');
        mockWebSocket.open();
        expect(newWebSocketFn).toHaveBeenCalledTimes(1);

        // Simulate network going offline
        mockWebSocket.close();
        connected = false;

        // Connection should be closed
        expect(mockWebSocket.readyState).toBe(WebSocket.CLOSED);

        // Wait a very long time to max out retry timeout
        jest.advanceTimersByTime(10000);

        // Reset the mock to track the next retry
        // which should be quicker than the max
        newWebSocketFn.mockClear();

        // Simulate network coming back online
        connected = true;
        const onlineEvent = new Event('online');
        window.dispatchEvent(onlineEvent);

        // Should not reconnect immediately (should wait for the timeout)
        expect(newWebSocketFn).not.toHaveBeenCalled();

        // Advance timers to trigger the reconnect
        jest.advanceTimersByTime(110);

        // Should have reconnected after the timeout
        expect(newWebSocketFn).toHaveBeenCalledTimes(1);

        // Clean up
        client.close();

        // Reset timers
        jest.useRealTimers();
    });

    test('should send ping when network goes offline', () => {
        jest.useFakeTimers();

        const mockWebSocket = new MockWebSocket();
        const client = new WebSocketClient({
            newWebSocketFn: (url: string) => {
                mockWebSocket.url = url;
                setTimeout(() => {
                    if (mockWebSocket.onopen) {
                        mockWebSocket.open();
                    }
                }, 1);
                return mockWebSocket;
            },
            clientPingInterval: 300,
        });

        let numPings = 0;
        mockWebSocket.send = (evt) => {
            const msg = JSON.parse(evt);
            if (msg.action !== 'ping') {
                return;
            }
            numPings++;
        };

        const openSpy = jest.spyOn(mockWebSocket, 'open');
        const closeSpy = jest.spyOn(mockWebSocket, 'close');

        client.initialize('mock.url');
        jest.advanceTimersByTime(10);

        expect(mockWebSocket.readyState).toBe(WebSocket.OPEN);
        expect(openSpy).toBeCalledTimes(1);
        expect(closeSpy).toBeCalledTimes(0);
        expect(numPings).toBe(1);

        // Simulate network going offline
        const offlineEvent = new Event('offline');
        window.dispatchEvent(offlineEvent);
        jest.advanceTimersByTime(10);

        client.close();

        expect(openSpy).toBeCalledTimes(1);
        expect(closeSpy).toBeCalledTimes(1);
        expect(numPings).toBe(2);

        jest.useRealTimers();
    });
});
