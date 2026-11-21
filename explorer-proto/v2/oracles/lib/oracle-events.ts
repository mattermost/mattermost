// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {BrowserContext, Page, Request, Response, WebSocket} from '@playwright/test';

import type {FindingSink} from './findings.ts';

export type OracleCtx = {
    sink: FindingSink;
    origin: string;
    /** Index of the scripted action currently running (0 = initial load, before the first action). */
    action(): number;
    /** True once the harness is tearing down: events after this point are teardown noise, not findings. */
    detached(): boolean;
    /** Registers a deferred decision so the harness can drain it before writing findings. */
    track(pending: Promise<void>): void;
};

const NAVIGATION_WINDOW_MS = 1500;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function pagePath(page: Page): string {
    try {
        const url = new URL(page.url());
        return /^https?:$/.test(url.protocol) ? url.pathname : '';
    } catch {
        return '';
    }
}

function firstLines(text: string, lines: number): string {
    return text.split('\n').slice(0, lines).join(' | ');
}

const RESOURCE_FAILURE = /^Failed to load resource:/;

/** O-CONSOLE: console.error and uncaught page errors. The resource-failure console line is O-NET's job. */
export function attachConsoleOracle(page: Page, ctx: OracleCtx) {
    page.on('console', (message) => {
        if (message.type() !== 'error' || ctx.detached()) {
            return;
        }
        const text = message.text();
        if (RESOURCE_FAILURE.test(text)) {
            return;
        }
        ctx.sink.add({
            oracle: 'O-CONSOLE',
            class: 'console-error',
            path: pagePath(page),
            evidence: firstLines(text, 2),
            action: ctx.action(),
        });
    });
    page.on('pageerror', (error) => {
        if (ctx.detached()) {
            return;
        }
        ctx.sink.add({
            oracle: 'O-CONSOLE',
            class: 'uncaught-exception',
            path: pagePath(page),
            evidence: firstLines(`${error.name}: ${error.message}`, 1),
            action: ctx.action(),
        });
    });
}

function sameOrigin(url: string, origin: string): boolean {
    try {
        return new URL(url).origin === origin;
    } catch {
        return false;
    }
}

function withoutQuery(url: string): string {
    const parsed = new URL(url);
    return parsed.pathname;
}

/** O-NET (HTTP half): failed requests and 4xx/5xx responses from the app origin. Redirects are not findings. */
export function attachHttpOracle(context: BrowserContext, ctx: OracleCtx) {
    context.on('response', (response: Response) => {
        const status = response.status();
        const url = response.url();
        if (status < 400 || ctx.detached() || !sameOrigin(url, ctx.origin)) {
            return;
        }
        const method = response.request().method();
        ctx.sink.add({
            oracle: 'O-NET',
            class: status >= 500 ? 'http-5xx' : 'http-4xx',
            path: url,
            evidence: `${method} ${ctx.sink.scrubber.path(withoutQuery(url))} -> ${status}`,
            action: ctx.action(),
            meta: {method, status},
        });
    });
    context.on('requestfailed', (request: Request) => {
        const url = request.url();
        if (ctx.detached() || !sameOrigin(url, ctx.origin)) {
            return;
        }
        const method = request.method();
        ctx.sink.add({
            oracle: 'O-NET',
            class: 'request-failed',
            path: url,
            evidence: `${method} ${ctx.sink.scrubber.path(withoutQuery(url))} failed: ${request.failure()?.errorText ?? 'unknown'}`,
            action: ctx.action(),
            meta: {method},
        });
    });
}

/**
 * O-NET (WebSocket half): socket errors, and closes that are not caused by a document navigation, the page
 * closing or harness teardown. Playwright exposes no close code, so a normal server close cannot be told
 * apart from an abnormal one. The app may close its socket before or after the navigation request event
 * is delivered, so a close is judged after a short window: a main-frame navigation request within
 * NAVIGATION_WINDOW_MS of it, and later than the socket's creation, explains the close. A genuine drop that
 * coincides with a navigation is masked.
 */
export function attachWebSocketOracle(page: Page, context: BrowserContext, ctx: OracleCtx) {
    const navigations: number[] = [];
    let pageClosed = false;
    page.on('close', () => {
        pageClosed = true;
    });
    context.on('request', (request) => {
        if (
            request.isNavigationRequest() &&
            request.frame().page() === page &&
            request.frame().parentFrame() === null
        ) {
            navigations.push(Date.now());
        }
    });
    page.on('websocket', (socket: WebSocket) => {
        if (!sameOrigin(socket.url().replace(/^ws/, 'http'), ctx.origin)) {
            return;
        }
        socket.on('socketerror', (error) => {
            if (ctx.detached() || pageClosed) {
                return;
            }
            ctx.sink.add({
                oracle: 'O-NET',
                class: 'ws-error',
                path: socket.url(),
                evidence: `WebSocket error: ${error}`,
                action: ctx.action(),
            });
        });
        const createdAt = Date.now();
        socket.on('close', () => {
            if (ctx.detached() || pageClosed) {
                return;
            }
            const closedAt = Date.now();
            const action = ctx.action();
            ctx.track(
                sleep(NAVIGATION_WINDOW_MS).then(() => {
                    if (navigations.some((at) => at >= createdAt && Math.abs(at - closedAt) <= NAVIGATION_WINDOW_MS)) {
                        return;
                    }
                    ctx.sink.add({
                        oracle: 'O-NET',
                        class: 'ws-close',
                        path: socket.url(),
                        evidence: 'WebSocket closed while the page stayed open',
                        action,
                    });
                }),
            );
        });
    });
}
