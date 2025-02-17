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

        jest.advanceTimersByTime(40);

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
});
