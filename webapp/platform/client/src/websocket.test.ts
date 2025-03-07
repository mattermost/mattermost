// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import WebSocketClient from './websocket';

// Define some WebSocket globals that aren't defined in node
if (typeof WebSocket === 'undefined') {
    (global as any).WebSocket = {
        CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3,
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
                if (mockWebSocket.onopen) {
                    mockWebSocket.open();
                }
                return mockWebSocket;
            },
            minWebSocketRetryTime: 50,
            reconnectJitterRange: 1,
        });

        const initializeSpy = jest.spyOn(client, 'initialize');
        client.initialize('mock.url');
        mockWebSocket.open();
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
                if (mockWebSocket.onopen) {
                    mockWebSocket.open();
                }
                return mockWebSocket;
            },
            minWebSocketRetryTime: 50,
            reconnectJitterRange: 1,
        });

        const initializeSpy = jest.spyOn(client, 'initialize');
        client.initialize('mock.url');
        mockWebSocket.open();
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
                if (mockWebSocket.onopen) {
                    mockWebSocket.open();
                }
                return mockWebSocket;
            },
            minWebSocketRetryTime: 50,
            reconnectJitterRange: 1,
        });

        const initializeSpy = jest.spyOn(client, 'initialize');
        client.initialize('mock.url');
        mockWebSocket.open();
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
                if (mockWebSocket.onopen) {
                    mockWebSocket.open();
                }
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
        mockWebSocket.open();

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
                if (mockWebSocket.onopen) {
                    mockWebSocket.open();
                }
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
            if ((mockWebSocket.close as jest.Mock).mock.calls.length > 2) {
                client.close();
            }
        });

        client.initialize('mock.url');
        mockWebSocket.open();

        jest.advanceTimersByTime(30);

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
                if (mockWebSocket.onopen) {
                    mockWebSocket.open();
                }
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

            // don't respond to first ping
            if (numPings === 1) {
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
        mockWebSocket.open();

        // Let first ping happen
        jest.advanceTimersByTime(25);
        expect(numPings).toBe(1);
        expect(numPongs).toBe(0);

        // Close and reopen connection before ping timeout
        mockWebSocket.close();

        // Let new connection run for a while to ensure no immediate reconnect
        jest.advanceTimersByTime(100);
        client.close();

        expect(numPings).toBe(7);
        expect(numPongs).toBe(numPings - 1); // Ensure we only skipped the first response
        expect(openSpy).toHaveBeenCalledTimes(2); // Initial open and one reconnect
        expect(closeSpy).toHaveBeenCalledTimes(2); // Manual close and final close

        jest.useRealTimers();
    });
});
