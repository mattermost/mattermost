// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import crypto from 'node:crypto';
import http from 'node:http';
import type {AddressInfo, Socket} from 'node:net';

// Loopback HTTP + WebSocket servers for containment checks. Their counters are the evidence: a server
// "received" something only if its own TCP accept, HTTP parser or 'upgrade' event fired.

export type ServerCounters = {
    connections: number;
    httpRequests: number;
    upgrades: number;
};

export type FixtureServer = {
    server: http.Server;
    origin: string;
    port: number;
    counters: ServerCounters;
    hostHeaders: string[];
    requestPaths: string[];
    reset: () => void;
    close: () => Promise<void>;
};

type FixtureOptions = {
    port?: number;
    // 'echo' completes the upgrade and echoes text frames; 'destroy' counts the upgrade then drops the socket.
    websocket: 'echo' | 'destroy';
    handler?: http.RequestListener;
};

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function textFrame(payload: Buffer): Buffer {
    const header =
        payload.length < 126
            ? Buffer.from([0x81, payload.length])
            : Buffer.from([0x81, 126, payload.length >> 8, payload.length & 0xff]);
    return Buffer.concat([header, payload]);
}

/** Minimal RFC 6455 server side: handles masked client text, ping and close frames below 64 KiB. */
function echoFrames(socket: Socket) {
    let buffered = Buffer.alloc(0);
    socket.on('data', (chunk: Buffer) => {
        buffered = Buffer.concat([buffered, chunk]);
        for (;;) {
            if (buffered.length < 2) {
                return;
            }
            const opcode = buffered[0] & 0x0f;
            let length = buffered[1] & 0x7f;
            let offset = 2;
            if (length === 126) {
                if (buffered.length < 4) {
                    return;
                }
                length = buffered.readUInt16BE(2);
                offset = 4;
            }
            const masked = (buffered[1] & 0x80) !== 0;
            const end = offset + (masked ? 4 : 0) + length;
            if (length === 127 || buffered.length < end) {
                return;
            }
            const mask = masked ? buffered.subarray(offset, offset + 4) : Buffer.alloc(4);
            const payload = Buffer.from(buffered.subarray(end - length, end));
            for (let i = 0; i < payload.length; i++) {
                payload[i] ^= mask[i % 4];
            }
            buffered = buffered.subarray(end);
            if (opcode === 0x1) {
                socket.write(textFrame(payload));
            } else if (opcode === 0x9) {
                socket.write(Buffer.concat([Buffer.from([0x8a, payload.length]), payload]));
            } else if (opcode === 0x8) {
                socket.end(Buffer.from([0x88, 0x00]));
                return;
            }
        }
    });
    socket.on('error', () => undefined);
}

export async function startFixtureServer(options: FixtureOptions): Promise<FixtureServer> {
    const counters: ServerCounters = {
        connections: 0,
        httpRequests: 0,
        upgrades: 0,
    };
    const hostHeaders: string[] = [];
    const requestPaths: string[] = [];
    const sockets = new Set<Socket>();
    const handler: http.RequestListener =
        options.handler ??
        ((_req, res) => {
            res.writeHead(200, {'content-type': 'text/html'});
            res.end('<html><body><h1>fixture</h1></body></html>');
        });

    const server = http.createServer((req, res) => {
        counters.httpRequests++;
        hostHeaders.push(req.headers.host ?? '');
        requestPaths.push(req.url ?? '');
        handler(req, res);
    });
    server.on('connection', (socket) => {
        counters.connections++;
        sockets.add(socket);
        socket.on('close', () => sockets.delete(socket));
    });
    server.on('upgrade', (req, socket) => {
        counters.upgrades++;
        hostHeaders.push(req.headers.host ?? '');
        const key = req.headers['sec-websocket-key'];
        if (options.websocket === 'destroy' || typeof key !== 'string') {
            socket.destroy();
            return;
        }
        const accept = crypto
            .createHash('sha1')
            .update(key + WS_GUID)
            .digest('base64');
        socket.write(
            `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`,
        );
        echoFrames(socket as Socket);
    });
    await new Promise<void>((resolve) => server.listen(options.port ?? 0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;

    return {
        server,
        origin: `http://127.0.0.1:${port}`,
        port,
        counters,
        hostHeaders,
        requestPaths,
        reset: () => {
            counters.connections = 0;
            counters.httpRequests = 0;
            counters.upgrades = 0;
            hostHeaders.length = 0;
            requestPaths.length = 0;
        },
        close: async () => {
            for (const socket of sockets) {
                socket.destroy();
            }
            await new Promise<void>((resolve) => server.close(() => resolve()));
        },
    };
}

/** Runs in the page: opens a WebSocket, sends one message and resolves with the echo or a failure word. */
export async function pageWebSocketEcho({url, message}: {url: string; message: string}): Promise<string> {
    return new Promise<string>((resolve) => {
        const ws = new WebSocket(url);
        const timer = setTimeout(() => resolve('ws:timeout'), 5000);
        ws.onopen = () => ws.send(message);
        ws.onmessage = (event) => {
            clearTimeout(timer);
            resolve(`ws:echo:${event.data}`);
            ws.close();
        };
        ws.onerror = () => {
            clearTimeout(timer);
            resolve('ws:failed');
        };
        ws.onclose = () => {
            clearTimeout(timer);
            resolve('ws:failed');
        };
    });
}
