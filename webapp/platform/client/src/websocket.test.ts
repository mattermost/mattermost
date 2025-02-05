// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import WebSocketClient from './websocket';

// Define some WebSocket globals that aren't defined in node
if (typeof WebSocket === 'undefined') {
    (global as any).WebSocket = {
        CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3,
    }
}

export class MockWebSocket {
    readonly binaryType: BinaryType = "blob";
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

    send(msg: any) { }
    addEventListener() { }
    removeEventListener() { }
    dispatchEvent(): boolean { return false; }
}

describe('websocketclient', () => {
    test('should call callbacks', () => {
        let mockWebSocket = new MockWebSocket();

        let client = new WebSocketClient({
            newWebSocketFn: (url: string) => {
                mockWebSocket.url = url;
                return mockWebSocket;
            },
        });
        client.initialize("mock.url")

        expect(mockWebSocket.onopen).toBeTruthy()
        mockWebSocket.onopen = jest.fn()
        expect(mockWebSocket.onclose).toBeTruthy()
        mockWebSocket.onclose = jest.fn()

        mockWebSocket.open()

        expect(mockWebSocket.onopen).toHaveBeenCalled()
        expect(mockWebSocket.readyState).toBe(mockWebSocket.OPEN)

        mockWebSocket.close()

        expect(mockWebSocket.onclose).toHaveBeenCalled()
        expect(mockWebSocket.readyState).toBe(mockWebSocket.CLOSED)

        client.close();
    });

    test('should reconnect on websocket close', done => {
        let mockWebSocket = new MockWebSocket();
        mockWebSocket.open = jest.fn(mockWebSocket.open)

        let client = new WebSocketClient({
            newWebSocketFn: (url: string) => {
                mockWebSocket.url = url;
                mockWebSocket.open()
                return mockWebSocket;
            },
            minWebSocketRetryTime: 1,
            reconnectJitterRange: 1,
        });
        client.initialize("mock.url")

        mockWebSocket.close()

        setTimeout(() => {
            client.close()
            expect(mockWebSocket.open).toHaveBeenCalledTimes(2)
            done()
        }, 10)
    });

    test('should close during reconnection delay', done => {
        let mockWebSocket = new MockWebSocket();
        mockWebSocket.open = jest.fn(mockWebSocket.open)

        let client = new WebSocketClient({
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
        client.initialize = jest.fn(client.initialize)
        client.initialize("mock.url")
        mockWebSocket.open();
        mockWebSocket.close();

        setTimeout(() => {
            client.close()
        }, 10)

        setTimeout(() => {
            client.close()
            expect(client.initialize).toBeCalledTimes(1)
            expect(mockWebSocket.open).toBeCalledTimes(1)
            done()
        }, 80)
    });

    
    test('send should not re-initialize during reconnection delay', done => {
        let mockWebSocket = new MockWebSocket();
        mockWebSocket.open = jest.fn(mockWebSocket.open)

        let client = new WebSocketClient({
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
        client.initialize = jest.fn(client.initialize)
        client.initialize("mock.url")
        mockWebSocket.open();
        mockWebSocket.close();

        setTimeout(() => {
            client.sendMessage("ping", null)
        }, 10)

        setTimeout(() => {
            client.close()
            expect(client.initialize).toBeCalledTimes(2)
            expect(mockWebSocket.open).toBeCalledTimes(2)
            done()
        }, 80)
    });
});
