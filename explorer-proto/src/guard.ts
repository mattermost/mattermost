// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {APIResponse, Browser, BrowserContext, Request, Route} from '@playwright/test';

import {compareStrings} from './snapshot.ts';

export type GuardMode = 'exploration' | 'replay';
type Channel = 'http' | 'redirect' | 'websocket';

// The guard fulfils every document itself, so Chromium sees no peer address for the page and applies its
// Local Network Access check to the page's WebSocket to the (loopback) approved origin, which then fails with
// ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS. This disables only that WebSocket check; the origin checks here,
// and the other LNA checks (navigation, WebRTC, WebTransport), are untouched.
export const WS_LNA_LAUNCH_ARG = '--disable-features=LocalNetworkAccessChecksWebSockets';

const MAX_REDIRECT_HOPS = 5;
const CLOSE_DRAIN_MS = 2000;

// Messages Playwright raises when a context is torn down under a running handler. They are benign only
// while the session is closing; anywhere else they are violations.
const TEARDOWN_ERRORS = [
    'Fetch response has been disposed',
    'Request context disposed',
    'Target page, context or browser has been closed',
    'Route is already handled',
];

/** Port-free description of why a URL is outside the allowed origin. */
export function classifyTarget(url: string, allowedOrigin: string): string {
    let target: URL;
    try {
        target = new URL(url);
    } catch {
        return 'unparseable-url';
    }
    const allowed = new URL(allowedOrigin);
    const allowedScheme = allowed.protocol.replace(':', '');
    const scheme = target.protocol.replace(':', '');
    const wsScheme = scheme === 'ws' || scheme === 'wss';
    const sameSchemeFamily = wsScheme
        ? scheme === (allowedScheme === 'https' ? 'wss' : 'ws')
        : scheme === allowedScheme;
    if (!sameSchemeFamily) {
        return 'other-scheme';
    }
    if (target.hostname === allowed.hostname) {
        return target.port === allowed.port ? 'allowed' : 'same-host-other-port';
    }
    if (target.hostname === 'localhost' || target.hostname === '[::1]' || target.hostname.startsWith('127.')) {
        return 'loopback-alias';
    }
    return 'other-host';
}

export function isAllowedHttpUrl(url: string, allowedOrigin: string): boolean {
    if (url.startsWith('data:')) {
        return true;
    }
    if (url.startsWith('blob:')) {
        return new URL(url).origin === allowedOrigin;
    }
    return classifyTarget(url, allowedOrigin) === 'allowed' && /^https?:/.test(url);
}

export function isAllowedWsUrl(url: string, allowedOrigin: string): boolean {
    return /^wss?:/.test(url) && classifyTarget(url, allowedOrigin) === 'allowed';
}

type LedgerEntry = {mode: GuardMode; channel: Channel; target: string; resourceType: string};

/** Records blocked requests and escapes without URLs or ports, so reports are deterministic. */
export class GuardLedger {
    readonly mode: GuardMode;
    readonly blocked: LedgerEntry[] = [];
    readonly violations: string[] = [];
    readonly inFlight = new Set<Promise<void>>();
    closing = false;
    teardownAborted = 0;

    constructor(mode: GuardMode) {
        this.mode = mode;
    }

    handlerError(error: unknown) {
        const message = String(error instanceof Error ? error.message : error).split('\n')[0];
        this.violations.push(
            `${this.mode}: route handler error: ${message.replace(/https?:\/\/[^\s/]+/g, '<origin>')}`,
        );
    }

    /** Errors are benign only when the session is closing and the message is a known teardown message. */
    isTeardownError(error: unknown): boolean {
        const message = String(error instanceof Error ? error.message : error);
        return this.closing && TEARDOWN_ERRORS.some((m) => message.includes(m));
    }

    block(channel: Channel, target: string, resourceType: string) {
        this.blocked.push({mode: this.mode, channel, target, resourceType});
    }

    violation(kind: string, target: string) {
        this.violations.push(`${this.mode}: ${kind} reached ${target}`);
    }

    summary(): Record<string, number> {
        return summarize(this.blocked);
    }
}

export function summarize(entries: LedgerEntry[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const e of entries) {
        const key = `${e.mode}|${e.channel}|${e.target}|${e.resourceType}`;
        counts[key] = (counts[key] ?? 0) + 1;
    }
    return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => compareStrings(a, b)));
}

function redirectTarget(response: APIResponse, from: string): string | null {
    const status = response.status();
    const location = response.headers().location;
    if (status < 300 || status > 399 || !location) {
        return null;
    }
    return new URL(location, from).href;
}

/**
 * Redirect hops are not passed to route handlers, so a same-origin 3xx is only handed back to the
 * browser after every later hop has been fetched here and found to stay on the allowed origin.
 */
/** Once the session is closing no new fulfil is admitted: the request is aborted and counted instead. */
async function refuseWhileClosing(route: Route, ledger: GuardLedger): Promise<boolean> {
    if (!ledger.closing) {
        return false;
    }
    ledger.teardownAborted++;
    await route.abort('aborted');
    return true;
}

async function guardAllowedRequest(route: Route, context: BrowserContext, allowedOrigin: string, ledger: GuardLedger) {
    const request = route.request();
    if (await refuseWhileClosing(route, ledger)) {
        return;
    }
    const response = await route.fetch({maxRedirects: 0});
    let next = redirectTarget(response, request.url());
    if (!next) {
        if (!(await refuseWhileClosing(route, ledger))) {
            await route.fulfill({response});
        }
        return;
    }

    const api = context.request;
    for (let hop = 0; next; hop++) {
        const target = classifyTarget(next, allowedOrigin);
        if (target !== 'allowed' || hop >= MAX_REDIRECT_HOPS) {
            ledger.block('redirect', hop >= MAX_REDIRECT_HOPS ? 'too-many-hops' : target, request.resourceType());
            await route.abort('blockedbyclient');
            return;
        }
        const hopResponse = await api.get(next, {maxRedirects: 0, failOnStatusCode: false});
        const following = redirectTarget(hopResponse, next);
        await hopResponse.dispose();
        next = following;
    }
    if (!(await refuseWhileClosing(route, ledger))) {
        await route.fulfill({response});
    }
}

async function handleRoute(route: Route, context: BrowserContext, allowedOrigin: string, ledger: GuardLedger) {
    const request = route.request();
    const url = request.url();
    if (url.startsWith('data:') || url.startsWith('blob:')) {
        if (isAllowedHttpUrl(url, allowedOrigin)) {
            await route.fallback();
        } else {
            ledger.block('http', 'other-origin-blob', request.resourceType());
            await route.abort('blockedbyclient');
        }
        return;
    }
    if (!isAllowedHttpUrl(url, allowedOrigin)) {
        ledger.block('http', classifyTarget(url, allowedOrigin), request.resourceType());
        await route.abort('blockedbyclient');
        return;
    }
    await guardAllowedRequest(route, context, allowedOrigin, ledger);
}

/** Must run on a context before it has any page, i.e. before any navigation can happen. */
export async function installGuard(context: BrowserContext, allowedOrigin: string, ledger: GuardLedger) {
    if (context.pages().length > 0) {
        throw new Error('Guard must be installed before the context opens a page.');
    }

    // Every handler is tracked so teardown can wait for it; its errors are classified, never rethrown
    // into Playwright, and anything that is not provably teardown-caused fails the session on close.
    await context.route('**/*', (route) => {
        const handled = handleRoute(route, context, allowedOrigin, ledger).catch(async (error) => {
            if (ledger.isTeardownError(error)) {
                ledger.teardownAborted++;
                return;
            }
            ledger.handlerError(error);
            // Do not leave the request hanging; the violation above already fails the session.
            await route.abort('failed').catch(() => undefined);
        });
        ledger.inFlight.add(handled);
        handled.finally(() => ledger.inFlight.delete(handled));
        return handled;
    });

    await context.routeWebSocket(
        (url) => !isAllowedWsUrl(url.href, allowedOrigin),
        async (ws) => {
            ledger.block('websocket', classifyTarget(ws.url(), allowedOrigin), 'websocket');
            await ws.close({code: 1008, reason: 'blocked by explorer guard'});
        },
    );

    // Last line of defence: anything that still produced a response from another origin is a violation.
    context.on('response', (response) => {
        const url = response.url();
        if (!isAllowedHttpUrl(url, allowedOrigin)) {
            ledger.violation(`response (${response.request().resourceType()})`, classifyTarget(url, allowedOrigin));
        }
    });
    context.on('request', (request) => {
        for (let r: Request | null = request; r; r = r.redirectedFrom()) {
            if (!isAllowedHttpUrl(r.url(), allowedOrigin) && r.redirectedTo()) {
                ledger.violation('redirect chain', classifyTarget(r.url(), allowedOrigin));
            }
        }
        if (request.redirectedFrom() && !isAllowedHttpUrl(request.url(), allowedOrigin)) {
            ledger.violation('redirect hop', classifyTarget(request.url(), allowedOrigin));
        }
    });
}

/**
 * Wraps a Browser so every context it creates blocks service workers and has the guard installed
 * before the caller gets the context back (and therefore before any page exists).
 */
export function guardedBrowser(browser: Browser, allowedOrigin: string, ledger: GuardLedger): Browser {
    return new Proxy(browser, {
        get(target, prop, receiver) {
            if (prop === 'newContext') {
                return async (options: Parameters<Browser['newContext']>[0] = {}) => {
                    const context = await target.newContext({...options, serviceWorkers: 'block'});
                    await installGuard(context, allowedOrigin, ledger);
                    return context;
                };
            }
            const value = Reflect.get(target, prop, receiver);
            return typeof value === 'function' ? value.bind(target) : value;
        },
    });
}

async function settleHandlers(ledger: GuardLedger) {
    let timer: NodeJS.Timeout | undefined;
    const bound = new Promise<void>((resolve) => {
        timer = setTimeout(resolve, CLOSE_DRAIN_MS);
    });
    await Promise.race([Promise.allSettled([...ledger.inFlight]), bound]);
    clearTimeout(timer);
}

/** Marks the session closing, lets in-flight handlers finish (bounded), closes, then lets late ones settle. */
export async function closeWithGuard(ledger: GuardLedger, close: () => Promise<void>) {
    ledger.closing = true;
    await settleHandlers(ledger);
    await close();
    await settleHandlers(ledger);
}

export async function closeGuardedContext(context: BrowserContext, ledger: GuardLedger) {
    await closeWithGuard(ledger, () => context.close());
}

/** Origins of every open page; used to fail a run whose final URL left the allowed origin. */
export function foreignPageOrigins(context: BrowserContext, allowedOrigin: string): string[] {
    return (
        context
            .pages()
            .map((p) => p.url())
            // A blocked navigation leaves Chromium's local error page, which made no network request.
            .filter(
                (u) => u !== 'about:blank' && !u.startsWith('chrome-error://') && !isAllowedHttpUrl(u, allowedOrigin),
            )
            .map((u) => classifyTarget(u, allowedOrigin))
    );
}
