// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import http from 'node:http';
import net from 'node:net';
import type {AddressInfo, Socket} from 'node:net';

import {classifyTarget} from './guard.ts';

// A filtering forward proxy for the browser of a plain repo-native spec. Chromium is pointed at it with
// --proxy-server and told not to bypass it for loopback (--proxy-bypass-list=<-loopback>), so every
// request, WebSocket included, reaches this process first. Only the exact approved host:port is
// forwarded; everything else is answered 403 before any upstream socket exists.

export type ProxyStats = {
    allowedTunnels: number;
    allowedHttp: number;
    allowedUpgrades: number;
    refused: number;
    refusedByCategory: Record<string, number>;
    upstreamSocketsOpened: number;
};

export type ContainmentProxy = {
    port: number;
    stats: ProxyStats;
    close: () => Promise<void>;
};

export type ApprovedHostPort = {host: string; port: number};

function emptyStats(): ProxyStats {
    return {
        allowedTunnels: 0,
        allowedHttp: 0,
        allowedUpgrades: 0,
        refused: 0,
        refusedByCategory: {},
        upstreamSocketsOpened: 0,
    };
}

function splitAuthority(authority: string): ApprovedHostPort | null {
    const match = /^(\[[^\]]+\]|[^:]+):(\d+)$/.exec(authority);
    return match ? {host: match[1].toLowerCase(), port: Number(match[2])} : null;
}

export function containmentLaunchArgs(proxyPort: number): string[] {
    return [
        `--proxy-server=http://127.0.0.1:${proxyPort}`,
        '--proxy-bypass-list=<-loopback>',
        '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
    ];
}

export async function startContainmentProxy(approved: ApprovedHostPort): Promise<ContainmentProxy> {
    const stats = emptyStats();
    const sockets = new Set<Socket>();
    const approvedOrigin = `http://${approved.host}:${approved.port}`;
    const isApproved = (target: ApprovedHostPort | null) =>
        target !== null && target.host === approved.host && target.port === approved.port;

    const refuse = (target: ApprovedHostPort | null, respond: (status: string) => void) => {
        stats.refused++;
        const category = target
            ? classifyTarget(`http://${target.host}:${target.port}`, approvedOrigin)
            : 'unparseable';
        stats.refusedByCategory[category] = (stats.refusedByCategory[category] ?? 0) + 1;
        respond(
            'HTTP/1.1 403 Forbidden\r\nX-Explorer-Containment: refused\r\nConnection: close\r\nContent-Length: 0\r\n\r\n',
        );
    };

    const openUpstream = () => {
        stats.upstreamSocketsOpened++;
        const upstream = net.connect(approved.port, approved.host);
        sockets.add(upstream);
        upstream.on('close', () => sockets.delete(upstream));
        upstream.on('error', () => undefined);
        return upstream;
    };

    const server = http.createServer((req, res) => {
        let target: URL | null = null;
        try {
            target = new URL(req.url ?? '');
        } catch {
            target = null;
        }
        const hostPort =
            target && target.protocol === 'http:' ? splitAuthority(`${target.hostname}:${target.port || 80}`) : null;
        if (!target || !isApproved(hostPort)) {
            refuse(target ? splitAuthority(`${target.hostname}:${target.port || 80}`) : null, (head) => {
                req.socket.end(head);
            });
            return;
        }
        stats.allowedHttp++;
        stats.upstreamSocketsOpened++;
        const headers = {...req.headers};
        delete headers['proxy-connection'];
        delete headers['proxy-authorization'];
        const upstream = http.request(
            {
                host: approved.host,
                port: approved.port,
                method: req.method,
                path: `${target.pathname}${target.search}`,
                headers: {...headers, connection: 'close'},
                agent: false,
            },
            (upstreamRes) => {
                res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
                upstreamRes.pipe(res);
            },
        );
        upstream.on('socket', (socket) => {
            sockets.add(socket);
            socket.on('close', () => sockets.delete(socket));
        });
        upstream.on('error', () => {
            if (!res.headersSent) {
                res.writeHead(502);
            }
            res.end();
        });
        req.pipe(upstream);
    });

    server.on('connection', (socket) => {
        sockets.add(socket);
        socket.on('close', () => sockets.delete(socket));
        socket.on('error', () => undefined);
    });

    server.on('connect', (req, clientSocket, head) => {
        const target = splitAuthority(req.url ?? '');
        if (!isApproved(target)) {
            refuse(target, (response) => clientSocket.end(response));
            return;
        }
        stats.allowedTunnels++;
        const upstream = openUpstream();
        upstream.on('connect', () => {
            clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
            if (head.length > 0) {
                upstream.write(head);
            }
            upstream.pipe(clientSocket);
            clientSocket.pipe(upstream);
        });
        upstream.on('close', () => clientSocket.destroy());
        clientSocket.on('close', () => upstream.destroy());
        clientSocket.on('error', () => upstream.destroy());
    });

    // Chromium tunnels ws:// with CONNECT; a plain absolute-URI upgrade is handled the same way for completeness.
    server.on('upgrade', (req, clientSocket, head) => {
        let target: URL | null = null;
        try {
            target = new URL((req.url ?? '').replace(/^ws/, 'http'));
        } catch {
            target = null;
        }
        const hostPort = target ? splitAuthority(`${target.hostname}:${target.port || 80}`) : null;
        if (!target || !isApproved(hostPort)) {
            refuse(hostPort, (response) => clientSocket.end(response));
            return;
        }
        stats.allowedUpgrades++;
        const upstream = openUpstream();
        upstream.on('connect', () => {
            const lines = [`${req.method} ${target.pathname}${target.search} HTTP/1.1`];
            for (let i = 0; i < req.rawHeaders.length; i += 2) {
                if (!/^proxy-/i.test(req.rawHeaders[i])) {
                    lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
                }
            }
            upstream.write(`${lines.join('\r\n')}\r\n\r\n`);
            if (head.length > 0) {
                upstream.write(head);
            }
            upstream.pipe(clientSocket);
            clientSocket.pipe(upstream);
        });
        upstream.on('close', () => clientSocket.destroy());
        clientSocket.on('close', () => upstream.destroy());
        clientSocket.on('error', () => upstream.destroy());
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

    return {
        port: (server.address() as AddressInfo).port,
        stats,
        close: async () => {
            for (const socket of sockets) {
                socket.destroy();
            }
            await new Promise<void>((resolve) => server.close(() => resolve()));
        },
    };
}
