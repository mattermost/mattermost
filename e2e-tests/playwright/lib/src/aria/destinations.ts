// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator, Page} from '@playwright/test';

import type {Meta} from './bindings';
import {TIMED_OUT, appPath, beforeDeadline, withoutTrailingSlash} from './deadline';
import {SurfacePage} from './pages';

export type ToOptions = {
    /** One budget, counted from the call (default 30 s): it covers the action and the wait for the destination. */
    timeout?: number;
};

/** Why an action did not arrive where the spec said it leads. */
export class DestinationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DestinationError';
    }
}

const DEFAULT_TIMEOUT = 30_000;
const POLL_INTERVAL = 100;

type ElementDestination = {readonly locator: Locator};

/**
 * Performs `act` and arrives at `destination`: what `clickTo` and `pressTo` do.
 *
 *  1. One immediate sample, no retrying: the destination must not be visible (for a page: the current path must not
 *     already be the page's path for these params).
 *  2. The action, with what is left of the budget; none is started once the budget is spent.
 *  3. The wait: an element or a scope visible; a page, its path and one of its ready elements, in the same sample.
 *  4. The destination, as it was passed in.
 *
 * One budget from the call covers all four: each step is bounded by the same deadline, and a step that succeeds only
 * after it is a failure.
 *
 * `rest` is what the caller received after the destination: `[opts]`, or `[params, opts]` for a page.
 */
export async function arrive(
    actor: {readonly page: Page; readonly meta: Meta},
    action: string,
    act: (timeout: number) => Promise<void>,
    destination: unknown,
    rest: readonly unknown[],
): Promise<unknown> {
    const page = destination instanceof SurfacePage ? destination : null;
    const params = page ? rest[0] : undefined;
    const opts = ((page ? rest[1] : rest[0]) ?? {}) as ToOptions;
    const timeout = opts.timeout ?? DEFAULT_TIMEOUT;
    const deadline = Date.now() + timeout;
    const on = `${action} on "${actor.meta.testId}" (${actor.meta.source})`;
    const left = () => deadline - Date.now();

    // Every asynchronous step is bounded by the one deadline, and nothing past it counts: an action is not started
    // once the budget is spent, and a success that comes back late is a failure.
    const expired = (step: string) => new DestinationError(`${on}: ${step} within ${timeout} ms`);
    const acting = async () => {
        if (left() <= 0) {
            throw expired('the budget was spent before the action could start');
        }
        if ((await beforeDeadline(act(left()), deadline)) === TIMED_OUT) {
            throw expired('the action did not finish');
        }
    };

    if (page) {
        const want = withoutTrailingSlash(page.pathFor(params));
        if (page.page !== actor.page) {
            throw new DestinationError(`${on}: ${page.constructor.name} is on another browser page`);
        }
        if (!page.ready.length) {
            throw new DestinationError(`${on}: ${page.constructor.name} has no ready element to wait for`);
        }
        if (pathOf(actor.page) === want) {
            throw new DestinationError(`${on}: the page was already at ${want} (${page.constructor.name}) before it`);
        }
        await acting();
        const missed = () =>
            new DestinationError(
                `${on} did not reach ${page.constructor.name} (${want}) within ${timeout} ms; the page is at ${pathOf(actor.page)}`,
            );
        for (;;) {
            if (pathOf(actor.page) === want) {
                const ready = await beforeDeadline(anyVisible(page.ready), deadline);
                if (ready === TIMED_OUT) {
                    throw missed();
                }
                if (ready && pathOf(actor.page) === want) {
                    return destination;
                }
            }
            if (left() <= 0) {
                throw missed();
            }
            await sleep(Math.min(POLL_INTERVAL, Math.max(0, left())));
        }
    }

    const target = destination as ElementDestination;
    if (!target || typeof target !== 'object' || !('locator' in target) || 'notRendered' in target) {
        throw new DestinationError(`${on}: the destination is not a scope or an element`);
    }
    const what = describe(target);
    if (target.locator.page() !== actor.page) {
        throw new DestinationError(`${on}: ${what} is on another browser page`);
    }
    const before = await beforeDeadline(target.locator.isVisible(), deadline);
    if (before === TIMED_OUT) {
        throw expired(`checking ${what} before acting did not finish`);
    }
    if (before) {
        throw new DestinationError(`${what} was already visible before ${on}`);
    }
    await acting();
    let shown: unknown;
    try {
        shown = await beforeDeadline(
            target.locator.waitFor({state: 'visible', timeout: Math.max(1, left())}),
            deadline,
        );
    } catch {
        shown = TIMED_OUT;
    }
    if (shown === TIMED_OUT) {
        throw new DestinationError(`${on} did not show ${what} within ${timeout} ms`);
    }
    return destination;
}

/** `"channel_settings_modal"` for a scope, `"x.save--button" (Source)` for an element. */
function describe(target: ElementDestination): string {
    const scope = (target as {scope?: unknown}).scope;
    if (typeof scope === 'string') {
        return `"${scope}" (${target.constructor.name})`;
    }
    const meta = (target as {meta?: Meta}).meta;
    return meta ? `"${meta.testId}" (${meta.source})` : String(target.locator);
}

/** The page's app path, as the router sees it: no origin, query or subpath prefix, no trailing slash. */
function pathOf(page: Page): string {
    let pathname: string;
    try {
        pathname = new URL(page.url()).pathname;
    } catch {
        return page.url();
    }
    return appPath(pathname);
}

async function anyVisible(locators: readonly Locator[]): Promise<boolean> {
    for (const locator of locators) {
        if (await locator.isVisible()) {
            return true;
        }
    }
    return false;
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
