// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'node:fs';
import http from 'node:http';
import type {AddressInfo} from 'node:net';
import path from 'node:path';

import {acceptKey, encodeFrame, OPCODE} from './ws-frames.ts';

export type FixtureServer = {
    origin: string;
    port: number;
    /** Every request path (no query) the server received, in order. */
    hits: string[];
    upgrades: string[];
    close(): Promise<void>;
};

export const FIXTURE_CHANNELS: Record<string, {id: string; display_name: string; purpose: string; header: string}> = {
    'chan-one': {
        id: 'aaaaaaaaaaaaaaaaaaaaaaaaa1',
        display_name: 'Chan One',
        purpose: 'Purpose one',
        header: 'Header one',
    },
    'chan-two': {
        id: 'aaaaaaaaaaaaaaaaaaaaaaaaa2',
        display_name: 'Chan Two',
        purpose: 'Purpose two',
        header: 'Header two',
    },
};

const WS_EVENTS = ['typing', 'channel_updated', 'posted'];

/** Local static fixtures plus a few REST and WebSocket stubs, bound to 127.0.0.1 only. */
export async function startFixtureServer(fixturesDir: string): Promise<FixtureServer> {
    const hits: string[] = [];
    const upgrades: string[] = [];
    const server = http.createServer((req, res) => {
        const url = new URL(req.url ?? '/', 'http://fixture.invalid');
        hits.push(url.pathname);
        const json = (status: number, body: unknown) => {
            res.writeHead(status, {'content-type': 'application/json'});
            res.end(JSON.stringify(body));
        };
        req.resume();
        if (url.pathname === '/api/missing') {
            json(404, {message: 'not found'});
            return;
        }
        if (url.pathname === '/api/boom' || url.pathname === '/api/submit') {
            json(500, {message: 'boom'});
            return;
        }
        if (url.pathname === '/api/submit-ok') {
            json(200, {ok: true});
            return;
        }
        if (url.pathname === '/api/echo') {
            json(200, {
                origin: req.headers.origin ?? null,
                host: req.headers.host ?? null,
                accept_encoding: req.headers['accept-encoding'] ?? null,
            });
            return;
        }
        if (url.pathname === '/api/v4/users/me/channels') {
            json(200, Object.values(FIXTURE_CHANNELS));
            return;
        }
        const channel = /^\/api\/v4\/channels\/([a-z0-9]+)$/.exec(url.pathname);
        if (channel) {
            const found = Object.values(FIXTURE_CHANNELS).find((c) => c.id === channel[1]);
            if (found) {
                json(200, found);
            } else {
                json(404, {message: 'unknown channel'});
            }
            return;
        }
        const file = path.join(fixturesDir, url.pathname.replace(/^\/+/, '') || 'blank.html');
        if (path.dirname(file) === fixturesDir && file.endsWith('.html') && fs.existsSync(file)) {
            res.writeHead(200, {'content-type': 'text/html'});
            res.end(fs.readFileSync(file));
            return;
        }
        res.writeHead(404);
        res.end('no such fixture');
    });

    server.on('upgrade', (req, socket) => {
        const url = new URL(req.url ?? '/', 'http://fixture.invalid');
        upgrades.push(url.pathname);
        if (url.pathname === '/ws-deny') {
            socket.end('HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n');
            return;
        }
        const key = req.headers['sec-websocket-key'];
        socket.write(
            `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${acceptKey(String(key))}\r\n\r\n`,
        );
        socket.on('error', () => undefined);
        socket.on('data', () => undefined);
        if (url.pathname === '/ws-close') {
            setTimeout(() => socket.end(encodeFrame(OPCODE.close, Buffer.from([0x03, 0xe8]))), 300);
            return;
        }
        WS_EVENTS.forEach((event, index) => {
            setTimeout(
                () => {
                    if (!socket.destroyed) {
                        socket.write(
                            encodeFrame(
                                OPCODE.text,
                                Buffer.from(JSON.stringify({event, data: {n: index}, seq: index + 1})),
                            ),
                        );
                    }
                },
                50 * (index + 1),
            );
        });
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;
    const sockets = new Set<import('node:net').Socket>();
    server.on('connection', (socket) => {
        sockets.add(socket);
        socket.on('close', () => sockets.delete(socket));
    });
    return {
        origin: `http://127.0.0.1:${port}`,
        port,
        hits,
        upgrades,
        async close() {
            sockets.forEach((s) => s.destroy());
            await new Promise<void>((resolve) => server.close(() => resolve()));
        },
    };
}
