// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import http from 'node:http';
import type {AddressInfo} from 'node:net';

import {test as base, type Page} from '@playwright/test';

import {apiOp, defineApi} from '../src/aria/api';

export type Handler = (req: http.IncomingMessage, res: http.ServerResponse, body: string) => void | Promise<void>;

/** A local HTTP server for one test: `/` serves the test's page, every other path goes to the test's handler. */
export type Server = {
    readonly origin: string;

    /** Serves `html` at `/` and opens it. */
    open(page: Page, html: string): Promise<void>;

    /** Answers requests other than `/` (by default 200 `{}`). */
    handle(handler: Handler): void;

    /** Every request the server received, as `METHOD /path`. */
    readonly received: string[];
};

export const test = base.extend<{server: Server}>({
    server: async ({}, use) => {
        let html = '';
        let handler: Handler = (_, res) => json(res, {});
        const received: string[] = [];
        const sockets = new Set<import('node:net').Socket>();
        const server = http.createServer((req, res) => {
            const chunks: Buffer[] = [];
            req.on('data', (c: Buffer) => chunks.push(c));
            req.on('end', () => {
                if (req.url === '/') {
                    res.writeHead(200, {'content-type': 'text/html'}).end(
                        `<!doctype html><html><body>${html}</body></html>`,
                    );
                    return;
                }
                received.push(`${req.method} ${req.url}`);
                Promise.resolve(handler(req, res, Buffer.concat(chunks).toString())).catch(() => res.destroy());
            });
        });
        server.on('connection', (s) => {
            sockets.add(s);
            s.on('close', () => sockets.delete(s));
        });
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
        const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
        await use({
            origin,
            received,
            async open(page, content) {
                html = content;
                await page.goto(`${origin}/`);
            },
            handle(h) {
                handler = h;
            },
        });
        for (const s of sockets) {
            s.destroy();
        }
        await new Promise((resolve) => server.close(resolve));
    },
});

export {expect} from '@playwright/test';

export function json(res: http.ServerResponse, body: unknown, status = 200) {
    res.writeHead(status, {'content-type': 'application/json'}).end(JSON.stringify(body));
}

export function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/** A button with a test id whose click runs `onclick` in the page. */
export function button(testId: string, onclick: string, label = 'Save') {
    return `<button data-testid="${testId}" onclick="${onclick.replace(/"/g, '&quot;')}">${label}</button>`;
}

export type Body = {id: string};

/** The catalog the test pages' requests are matched against, as the generated `Api` is. */
export const Api = defineApi({
    CreatePost: apiOp<Body>()({op: 'CreatePost', method: 'POST', path: '/api/v4/posts'}),
    PatchChannel: apiOp<Body>()({op: 'PatchChannel', method: 'PUT', path: '/api/v4/channels/{channel_id}/patch'}),
    GetChannel: apiOp<Body>()({op: 'GetChannel', method: 'GET', path: '/api/v4/channels/{channel_id}'}),
    GetChannelMember: apiOp<Body>()({
        op: 'GetChannelMember',
        method: 'GET',
        path: '/api/v4/channels/{channel_id}/members/{user_id}',
    }),
    GetMyChannelMember: apiOp<Body>()({
        op: 'GetMyChannelMember',
        method: 'GET',
        path: '/api/v4/channels/{channel_id}/members/me',
    }),
    GetUsers: apiOp<Body>()({op: 'GetUsers', method: 'GET', path: '/api/v4/users'}),
    GetUser: apiOp<Body>()({op: 'GetUser', method: 'GET', path: '/api/v4/users/{user_id}'}),
    GetMe: apiOp<Body>()({op: 'GetMe', method: 'GET', path: '/api/v4/users/me'}),
    UploadFile: apiOp<Body>()({op: 'UploadFile', method: 'POST', path: '/api/v4/files'}),
});
export const {CreatePost, PatchChannel, GetChannel, GetUser, GetUsers, GetMe, UploadFile} = Api;

/** For `promise.then(unexpected, (e) => e as Error)`: a wait that should have failed resolved. */
export function unexpected(): never {
    throw new Error('expected a failure');
}
