// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, type Page, type Request, type Response} from '@playwright/test';

import {Deadline, type ElementDriver, InputDriver, StateDriver} from './drivers.js';

export type ApiOpSpec = {
    readonly id: string;
    readonly method: string;
    readonly path: string;
};

export type SettleOptions = {
    readonly wait: ApiOpSpec;
    readonly params?: Record<string, string>;
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

function buildPathRegex(template: string, params: Record<string, string> = {}): RegExp {
    const resolved = template.replace(/\{([^}]+)\}/g, (_, name: string) => {
        if (name in params) {
            return params[name].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }
        return '[^/]+';
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
export async function waitForApi<T = unknown>(
    page: Page,
    options: SettleOptions,
    action: () => Promise<void>,
): Promise<T> {
    const timeoutMs = options.timeout ?? 30_000;
    const deadline = new Deadline(timeoutMs);
    const pathPattern = buildPathRegex(options.wait.path, options.params);
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
export function settle<T = unknown>(driver: ElementDriver, options: SettleOptions) {
    const page = driver.locator.page();
    return {
        click: () => waitForApi<T>(page, options, () => driver.click()),
        press: (key: string) => waitForApi<T>(page, options, () => driver.press(key)),
        fill: (value: string) => {
            if (!(driver instanceof InputDriver)) {
                throw new TypeError(`Driver "${driver.testId}" does not support fill()`);
            }
            return waitForApi<T>(page, options, () => driver.fill(value));
        },
        check: () => {
            if (!(driver instanceof StateDriver)) {
                throw new TypeError(`Driver "${driver.testId}" does not support check()`);
            }
            return waitForApi<T>(page, options, () => driver.check());
        },
        uncheck: () => {
            if (!(driver instanceof StateDriver)) {
                throw new TypeError(`Driver "${driver.testId}" does not support uncheck()`);
            }
            return waitForApi<T>(page, options, () => driver.uncheck());
        },
    };
}

/** Assert the current page pathname matches `expectedPath` (ignoring origin and subpath prefix). */
export async function toHavePath(page: Page, expectedPath: string, options?: {timeout?: number}): Promise<void> {
    const normalized = expectedPath.startsWith('/') ? expectedPath : `/${expectedPath}`;
    await expect.poll(() => new URL(page.url()).pathname.endsWith(normalized), options).toBe(true);
}

/** Format an i18n message template (`{placeholder}`) for locale-independent assertions. */
export function formatMessage(template: string, values: Record<string, string | number> = {}): string {
    return template.replace(/\{([^}]+)\}/g, (_, key: string) => (key in values ? String(values[key]) : `{${key}}`));
}
