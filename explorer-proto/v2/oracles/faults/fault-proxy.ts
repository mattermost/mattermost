// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// SYNTHETIC FAULT INJECTION. Every activation is labelled SYNTHETIC-INJECTED in the fault log.
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import type {AddressInfo} from 'node:net';

import {globToRegExp} from '../lib/findings.ts';
import {createScrubber} from '../lib/scrub.ts';
import {FrameParser, MessageAssembler, OPCODE, encodeFrame} from '../lib/ws-frames.ts';

export type FaultKind =
    'json_drop_field' | 'json_rename_field' | 'http_error_after' | 'http_delay' | 'ws_drop' | 'ws_delay';

export type FaultRule = {
    id: string;
    kind: FaultKind;
    /** Glob over the URL pathname (`*` = one segment, `**` = any); `method` is optional (HTTP kinds). */
    match: {path: string; method?: string};
    /** json_*: dotted path; an array body is mapped element-wise. */
    field?: string;
    /** json_rename_field: new key. */
    to?: string;
    /** http_error_after: the first `after_hits` matching requests pass, later ones get `status`. */
    after_hits?: number;
    /** http_error_after: stop after this many injected errors (default: unlimited). */
    times?: number;
    status?: number;
    delay_ms?: number;
    /** ws_*: the WebSocket message `event` name. */
    event?: string;
    /** ws_delay: hold every later message behind the delayed one (default true). */
    preserve_order?: boolean;
    /** ws_drop: renumber later `seq` values so the client cannot see a gap (default true). */
    renumber_seq?: boolean;
};

export type FaultConfig = {
    schema: 'explorer-oracle-faults/v1';
    synthetic: true;
    description: string;
    enabled: boolean;
    rules: FaultRule[];
};

export type FaultLogEntry = {
    label: 'SYNTHETIC-INJECTED';
    seq: number;
    rule: string;
    kind: FaultKind;
    method: string;
    path: string;
    detail: string;
};

export type FaultProxy = {
    port: number;
    origin: string;
    log: FaultLogEntry[];
    close(): Promise<void>;
};

const HTTP_KINDS: FaultKind[] = ['json_drop_field', 'json_rename_field', 'http_error_after', 'http_delay'];
const WS_KINDS: FaultKind[] = ['ws_drop', 'ws_delay'];

export function validateConfig(config: FaultConfig): void {
    if (config.schema !== 'explorer-oracle-faults/v1' || config.synthetic !== true || !Array.isArray(config.rules)) {
        throw new Error('Unsupported fault config: expected schema explorer-oracle-faults/v1 with synthetic: true.');
    }
    for (const rule of config.rules) {
        if (!rule.id || ![...HTTP_KINDS, ...WS_KINDS].includes(rule.kind) || !rule.match?.path) {
            throw new Error(`Invalid fault rule "${rule.id}".`);
        }
        if ((rule.kind === 'json_drop_field' || rule.kind === 'json_rename_field') && !rule.field) {
            throw new Error(`Rule ${rule.id} needs "field".`);
        }
        if (rule.kind === 'json_rename_field' && !rule.to) {
            throw new Error(`Rule ${rule.id} needs "to".`);
        }
        if (WS_KINDS.includes(rule.kind) && !rule.event) {
            throw new Error(`Rule ${rule.id} needs "event".`);
        }
    }
}

function mapField(
    value: unknown,
    segments: string[],
    apply: (holder: Record<string, unknown>, key: string) => void,
): void {
    if (Array.isArray(value)) {
        value.forEach((item) => mapField(item, segments, apply));
        return;
    }
    if (value === null || typeof value !== 'object') {
        return;
    }
    const holder = value as Record<string, unknown>;
    const [head, ...rest] = segments;
    if (rest.length === 0) {
        apply(holder, head);
    } else {
        mapField(holder[head], rest, apply);
    }
}

export function applyJsonRule(body: unknown, rule: FaultRule): boolean {
    let changed = false;
    mapField(body, (rule.field as string).split('.'), (holder, key) => {
        if (!(key in holder)) {
            return;
        }
        changed = true;
        if (rule.kind === 'json_rename_field') {
            holder[rule.to as string] = holder[key];
        }
        delete holder[key];
    });
    return changed;
}

function methodMatches(rule: FaultRule, method: string): boolean {
    return !rule.match.method || rule.match.method.toUpperCase() === method.toUpperCase();
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Starts the fault proxy on 127.0.0.1 in front of the loopback forwarder. It is a reverse proxy, not a
 * Playwright route layer: the browser, the exact-origin guard and the WebSocket upgrade all see one ordinary
 * loopback origin (this proxy's), so the guard is unchanged and a spec needs no knowledge of the faults.
 * The proxy only ever connects to 127.0.0.1:<upstreamPort>, so the stack stays internal-only.
 */
export async function startFaultProxy(options: {
    config: FaultConfig;
    upstreamPort: number;
    /** Origin the server expects in Origin/Referer (its configured SiteURL); defaults to the upstream origin. */
    siteOrigin?: string;
    logPath?: string;
}): Promise<FaultProxy> {
    const {config, upstreamPort} = options;
    validateConfig(config);
    if (config.enabled !== true) {
        throw new Error('Fault injection is OFF (config.enabled is not true); refusing to start.');
    }
    const siteOrigin = options.siteOrigin ?? `http://127.0.0.1:${upstreamPort}`;
    const scrubber = createScrubber({origins: [siteOrigin]});
    const log: FaultLogEntry[] = [];
    const hits = new Map<string, number>();
    const injected = new Map<string, number>();
    if (options.logPath) {
        fs.writeFileSync(options.logPath, '');
    }

    const record = (rule: FaultRule, method: string, pathname: string, detail: string) => {
        const entry: FaultLogEntry = {
            label: 'SYNTHETIC-INJECTED',
            seq: log.length + 1,
            rule: rule.id,
            kind: rule.kind,
            method,
            path: scrubber.path(pathname),
            detail,
        };
        log.push(entry);
        if (options.logPath) {
            fs.appendFileSync(options.logPath, `${JSON.stringify(entry)}\n`);
        }
    };

    let proxyOrigin = '';
    const rewriteOut = (value: string) => value.split(proxyOrigin).join(siteOrigin);
    const rewriteBack = (value: string) => value.split(siteOrigin).join(proxyOrigin);

    // A fresh upstream connection per request: the forwarder is a raw pipe, so a pooled socket that Mattermost
    // closed while idle would otherwise fail the next request with "socket hang up".
    const upstreamAgent = new http.Agent({keepAlive: false});
    const sockets = new Set<net.Socket>();
    const track = (socket: net.Socket) => {
        sockets.add(socket);
        socket.on('close', () => sockets.delete(socket));
    };

    const handleHttp = async (req: http.IncomingMessage, res: http.ServerResponse) => {
        const method = req.method ?? 'GET';
        const pathname = new URL(req.url ?? '/', 'http://proxy.invalid').pathname;
        const rules = config.rules.filter(
            (rule) =>
                HTTP_KINDS.includes(rule.kind) &&
                methodMatches(rule, method) &&
                globToRegExp(rule.match.path).test(pathname),
        );

        for (const rule of rules.filter((r) => r.kind === 'http_error_after')) {
            const seen = (hits.get(rule.id) ?? 0) + 1;
            hits.set(rule.id, seen);
            const done = injected.get(rule.id) ?? 0;
            if (seen > (rule.after_hits ?? 0) && (rule.times === undefined || done < rule.times)) {
                injected.set(rule.id, done + 1);
                const status = rule.status ?? 500;
                record(rule, method, pathname, `status=${status} after_hits=${rule.after_hits ?? 0}`);
                req.resume();
                res.writeHead(status, {'content-type': 'application/json'});
                res.end(
                    JSON.stringify({id: 'synthetic.fault', message: 'synthetic fault injection', status_code: status}),
                );
                return;
            }
        }
        for (const rule of rules.filter((r) => r.kind === 'http_delay')) {
            record(rule, method, pathname, `delay_ms=${rule.delay_ms ?? 0}`);
            await sleep(rule.delay_ms ?? 0);
        }

        const mutations = rules.filter((r) => r.kind === 'json_drop_field' || r.kind === 'json_rename_field');
        const headers = {...req.headers};
        delete headers['accept-encoding'];
        if (mutations.length > 0) {
            delete headers['if-none-match'];
            delete headers['if-modified-since'];
        }
        for (const name of ['origin', 'referer'] as const) {
            if (typeof headers[name] === 'string') {
                headers[name] = rewriteOut(headers[name] as string);
            }
        }
        headers.host = `127.0.0.1:${upstreamPort}`;

        const upstream = http.request(
            {host: '127.0.0.1', port: upstreamPort, method, path: req.url, headers, agent: upstreamAgent},
            (upstreamRes) => {
                const outHeaders = {...upstreamRes.headers};
                if (typeof outHeaders.location === 'string') {
                    outHeaders.location = rewriteBack(outHeaders.location);
                }
                const status = upstreamRes.statusCode ?? 502;
                const isJson = /json/i.test(String(outHeaders['content-type'] ?? ''));
                if (mutations.length === 0 || status < 200 || status > 299 || !isJson) {
                    res.writeHead(status, outHeaders);
                    upstreamRes.pipe(res);
                    return;
                }
                const chunks: Buffer[] = [];
                upstreamRes.on('data', (chunk: Buffer) => chunks.push(chunk));
                upstreamRes.on('end', () => {
                    let payload = Buffer.concat(chunks);
                    try {
                        const body: unknown = JSON.parse(payload.toString('utf8'));
                        for (const rule of mutations) {
                            if (applyJsonRule(body, rule)) {
                                record(
                                    rule,
                                    method,
                                    pathname,
                                    `${rule.kind === 'json_drop_field' ? 'dropped' : `renamed to ${rule.to}`} field=${rule.field}`,
                                );
                            }
                        }
                        payload = Buffer.from(JSON.stringify(body));
                    } catch {
                        // Not parseable JSON: pass the original bytes through untouched.
                    }
                    delete outHeaders.etag;
                    delete outHeaders['content-encoding'];
                    delete outHeaders['transfer-encoding'];
                    outHeaders['content-length'] = String(payload.length);
                    res.writeHead(status, outHeaders);
                    res.end(payload);
                });
            },
        );
        upstream.on('error', () => {
            if (!res.headersSent) {
                res.writeHead(502);
            }
            res.end();
        });
        req.pipe(upstream);
    };

    const server = http.createServer((req, res) => {
        handleHttp(req, res).catch(() => {
            if (!res.headersSent) {
                res.writeHead(502);
            }
            res.end();
        });
    });

    server.on('upgrade', (req, client: net.Socket, head: Buffer) => {
        track(client);
        const pathname = new URL(req.url ?? '/', 'http://proxy.invalid').pathname;
        const rules = config.rules.filter(
            (rule) => WS_KINDS.includes(rule.kind) && globToRegExp(rule.match.path).test(pathname),
        );
        const upstream = net.connect({host: '127.0.0.1', port: upstreamPort});
        track(upstream);
        const close = () => {
            client.destroy();
            upstream.destroy();
        };
        upstream.on('error', close);
        client.on('error', close);
        client.on('close', close);
        upstream.on('close', close);

        const lines = [`${req.method} ${req.url} HTTP/1.1`];
        for (let i = 0; i < req.rawHeaders.length; i += 2) {
            const name = req.rawHeaders[i];
            const lower = name.toLowerCase();
            if (lower === 'sec-websocket-extensions') {
                continue;
            }
            const value = req.rawHeaders[i + 1];
            const forwarded = {origin: rewriteOut(value), host: `127.0.0.1:${upstreamPort}`}[lower] ?? value;
            lines.push(`${name}: ${forwarded}`);
        }
        upstream.write(`${lines.join('\r\n')}\r\n\r\n`);
        if (head.length > 0) {
            upstream.write(head);
        }
        client.on('data', (chunk) => upstream.write(chunk));

        if (rules.length === 0) {
            upstream.on('data', (chunk) => client.write(chunk));
            return;
        }

        let handshake = Buffer.alloc(0);
        let streaming = false;
        const parser = new FrameParser();
        const assembler = new MessageAssembler();
        let chain: Promise<void> = Promise.resolve();
        let dropped = 0;
        const write = (buffer: Buffer) => {
            if (!client.destroyed) {
                client.write(buffer);
            }
        };
        const emit = (buffer: Buffer) => {
            chain = chain.then(() => write(buffer));
        };

        const onMessage = (message: {opcode: number; payload: Buffer}) => {
            if (message.opcode !== OPCODE.text) {
                emit(encodeFrame(message.opcode, message.payload));
                return;
            }
            let parsed: Record<string, unknown> | null = null;
            try {
                parsed = JSON.parse(message.payload.toString('utf8')) as Record<string, unknown>;
            } catch {
                parsed = null;
            }
            const event = typeof parsed?.event === 'string' ? parsed.event : '';
            const rule = event ? rules.find((r) => r.event === event) : undefined;
            if (parsed && rule?.kind === 'ws_drop') {
                dropped += 1;
                record(rule, 'WS', pathname, `dropped event=${event}`);
                return;
            }
            let payload = message.payload;
            const seq = parsed?.seq;
            if (parsed && dropped > 0 && typeof seq === 'number') {
                const renumber = rules.some((r) => r.kind === 'ws_drop' && r.renumber_seq !== false);
                if (renumber) {
                    parsed.seq = seq - dropped;
                    payload = Buffer.from(JSON.stringify(parsed));
                }
            }
            const frame = encodeFrame(OPCODE.text, payload);
            if (rule?.kind === 'ws_delay') {
                const delay = rule.delay_ms ?? 0;
                record(
                    rule,
                    'WS',
                    pathname,
                    `delayed event=${event} delay_ms=${delay} preserve_order=${rule.preserve_order !== false}`,
                );
                if (rule.preserve_order === false) {
                    setTimeout(() => write(frame), delay).unref();
                } else {
                    chain = chain.then(() => sleep(delay)).then(() => write(frame));
                }
                return;
            }
            emit(frame);
        };

        upstream.on('data', (incoming: Buffer) => {
            let chunk = incoming;
            if (!streaming) {
                handshake = Buffer.concat([handshake, incoming]);
                const end = handshake.indexOf('\r\n\r\n');
                if (end < 0) {
                    return;
                }
                const responseHead = handshake.subarray(0, end + 4);
                const rest = handshake.subarray(end + 4);
                write(responseHead);
                streaming = true;
                if (!/^HTTP\/1\.1 101/.test(responseHead.toString('latin1'))) {
                    upstream.removeAllListeners('data');
                    upstream.on('data', (more: Buffer) => write(more));
                    return;
                }
                chunk = rest;
            }
            for (const frame of parser.push(chunk)) {
                const message = assembler.push(frame);
                if (message) {
                    onMessage(message);
                }
            }
        });
    });

    // Never time out idle client connections: a client reusing one just as it closed gets "socket hang up".
    server.keepAliveTimeout = 0;
    server.on('connection', track);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;
    if (address.address !== '127.0.0.1') {
        server.close();
        throw new Error('Fault proxy bound to a non-loopback address.');
    }
    proxyOrigin = `http://127.0.0.1:${address.port}`;

    return {
        port: address.port,
        origin: proxyOrigin,
        log,
        async close() {
            for (const socket of sockets) {
                socket.destroy();
            }
            await new Promise<void>((resolve) => server.close(() => resolve()));
        },
    };
}
