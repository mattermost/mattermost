// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page, Request, Response} from '@playwright/test';

import {Deadline, type ElementDriver, InputDriver, StateDriver} from './drivers.js';

export type ApiOpSpec = {
    readonly id: string;
    readonly method: string;
    readonly path: string;
    readonly pathParams?: readonly string[];
};

/** Path parameter names of an operation; a typo in `params` is a compile error, not a wildcard match. */
export type PathParamsOf<Op extends ApiOpSpec> = Op['pathParams'] extends readonly string[]
    ? Op['pathParams'][number]
    : string;

export type SettleOptions<Op extends ApiOpSpec = ApiOpSpec> = {
    readonly wait: Op;
    readonly params?: {readonly [K in PathParamsOf<Op>]?: string};
    readonly query?: Record<string, string>;
    readonly status?: number;
    readonly timeout?: number;
};

export class SettleTimeoutError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SettleTimeoutError';
    }
}

export class SettleHttpError extends Error {
    readonly status: number;
    readonly body: string;

    constructor(message: string, status: number, body: string) {
        super(message);
        this.name = 'SettleHttpError';
        this.status = status;
        this.body = body;
    }
}

function buildPathRegex(op: ApiOpSpec, params: Readonly<Record<string, string | undefined>> = {}): RegExp {
    const names = [...op.path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
    const unknown = Object.keys(params).filter((name) => !names.includes(name));
    if (unknown.length > 0) {
        throw new TypeError(
            `Api.${op.id} has no path param ${unknown.map((n) => `"${n}"`).join(', ')}; expected one of: ${names.join(', ') || '(none)'}`,
        );
    }
    const resolved = op.path.replace(/\{([^}]+)\}/g, (_, name: string) => {
        const value = params[name];
        return value === undefined ? '[^/]+' : value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    });
    return new RegExp(`${resolved}$`);
}

function matchesQuery(url: URL, query?: Record<string, string>): boolean {
    if (!query) {
        return true;
    }
    return Object.entries(query).every(([key, value]) => url.searchParams.get(key) === value);
}

/** Run `action` while waiting for the named OpenAPI operation to complete, listing observed API traffic on failure. */
export async function waitForApi<T = unknown, Op extends ApiOpSpec = ApiOpSpec>(
    page: Page,
    options: SettleOptions<Op>,
    action: () => Promise<void>,
): Promise<T> {
    const timeoutMs = options.timeout ?? 30_000;
    const deadline = new Deadline(timeoutMs);
    const pathPattern = buildPathRegex(options.wait, options.params);
    const observed: string[] = [];

    const onRequest = (req: Request) => {
        const pathname = new URL(req.url()).pathname;
        if (pathname.includes('/api/v4/')) {
            observed.push(`${req.method()} ${pathname}`);
        }
    };
    page.on('request', onRequest);

    const predicate = (res: Response) => {
        if (res.request().method() !== options.wait.method) {
            return false;
        }
        const url = new URL(res.url());
        return pathPattern.test(url.pathname) && matchesQuery(url, options.query);
    };

    const waitResult = page.waitForResponse(predicate, {timeout: deadline.remaining()}).then(
        (response) => ({ok: true as const, response}),
        (error: unknown) => ({ok: false as const, error}),
    );

    try {
        await action();
        const settled = await waitResult;
        if (!settled.ok) {
            const seen = observed.length > 0 ? observed.join(', ') : '(none)';
            throw new SettleTimeoutError(
                `Timed out waiting ${timeoutMs}ms for Api.${options.wait.id} (${options.wait.method} ${options.wait.path}). Observed /api/v4 requests: ${seen}`,
            );
        }
        const {response} = settled;
        const expectedStatus = options.status;
        const ok = expectedStatus === undefined ? response.ok() : response.status() === expectedStatus;
        if (!ok) {
            const body = await response.text().catch(() => '');
            throw new SettleHttpError(
                `Api.${options.wait.id} (${options.wait.method} ${options.wait.path}) returned HTTP ${response.status()}: ${body}`,
                response.status(),
                body,
            );
        }
        const text = await response.text();
        if (!text) {
            return undefined as T;
        }
        try {
            return JSON.parse(text) as T;
        } catch {
            return text as unknown as T;
        }
    } finally {
        page.off('request', onRequest);
    }
}

/** Wrap a driver so its action triggers and awaits a specific OpenAPI response. */
export function settle<T = unknown, Op extends ApiOpSpec = ApiOpSpec>(
    driver: ElementDriver,
    options: SettleOptions<Op>,
) {
    const page = driver.locator.page();
    return {
        click: () => waitForApi<T, Op>(page, options, () => driver.click()),
        press: (key: string) => waitForApi<T, Op>(page, options, () => driver.press(key)),
        fill: (value: string) => {
            if (!(driver instanceof InputDriver)) {
                throw new TypeError(`Driver "${driver.testId}" does not support fill()`);
            }
            return waitForApi<T, Op>(page, options, () => driver.fill(value));
        },
        check: () => {
            if (!(driver instanceof StateDriver)) {
                throw new TypeError(`Driver "${driver.testId}" does not support check()`);
            }
            return waitForApi<T, Op>(page, options, () => driver.check());
        },
        uncheck: () => {
            if (!(driver instanceof StateDriver)) {
                throw new TypeError(`Driver "${driver.testId}" does not support uncheck()`);
            }
            return waitForApi<T, Op>(page, options, () => driver.uncheck());
        },
    };
}

const ICU_ARGUMENT = /\{\s*[\w.]+\s*,\s*(?:plural|select|selectordinal)\s*,/;

/** Fill `{placeholder}` values in an en.json template. ICU plural/select messages are rejected, not mangled. */
export function formatMessage(template: string, values: Record<string, string | number> = {}): string {
    if (ICU_ARGUMENT.test(template)) {
        throw new TypeError(
            `formatMessage() supports simple {placeholder} messages only; got ICU message "${template}"`,
        );
    }
    return template.replace(/\{([^}]+)\}/g, (_, key: string) => (key in values ? String(values[key]) : `{${key}}`));
}

/**
 * Longest static run of an en.json message, for substring locators: `{firstUser} **joined the channel**.` ->
 * `joined the channel`. Placeholders and `**` markdown split the text; a trailing period is dropped.
 */
export function messageFragment(template: string): string {
    const runs = template.split(/\{[^}]*\}|\*\*/).map((run) => run.trim().replace(/\.$/, ''));
    const longest = runs.reduce((best, run) => (run.length > best.length ? run : best), '');
    if (!longest) {
        throw new TypeError(`Message "${template}" has no static text to match`);
    }
    return longest;
}
