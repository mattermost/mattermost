// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page, Request, Response} from '@playwright/test';

import {
    catalogOf,
    describeQuery,
    describeSeen,
    isCandidate,
    type AnyApiOp,
    type BodyOf,
    type PathParamsOf,
    type QueryFilter,
} from './api';
import type {Meta} from './bindings';
import {TIMED_OUT, appPath, beforeDeadline} from './deadline';
import type {AnyDriver} from './drivers';
import {OBSERVING_VERBS, VERBS, type SettleVerb} from './verbs';

export type SettleOptions<W extends AnyApiOp, Count extends number | undefined = undefined> = {
    /** The request the action sends. Required: nothing predicts it. */
    wait: W;

    /**
     * Values for the operation's path placeholders, so only that entity's request counts. With every placeholder
     * filled, the request's path must be exactly the filled path. With one left open, the request must belong to
     * this operation in the whole catalog (the most specific pattern wins: `GET /users/me` is `GetMe`, never
     * `GetUser`) and agree with the placeholders that were filled.
     */
    params?: PathParamsOf<W>;

    /**
     * Only a request whose query string satisfies this counts: a string, that key present exactly once with that
     * decoded value; `null`, that key absent; other keys ignored. For two requests of one operation that differ only
     * by query (`{in_team: team.id, not_in_channel: null}`). Checked when the request is seen, before its status or
     * body, so a variant that fails it is never a candidate. It doesn't change which operation a request belongs to.
     */
    query?: QueryFilter;

    /** Expect this status instead of a 2xx. */
    status?: number;

    /**
     * How long to wait, counted from when the action returns (default 30 s). One absolute deadline: it covers the
     * request arriving, its response, and reading the body.
     */
    timeout?: number;

    /**
     * Wait for this many requests of the operation (one per uploaded file) and resolve to their bodies, in the order
     * issued. A positive integer. It does not mean "everything the action caused has finished".
     */
    count?: Count;
};

type Result<Body, Count> = Count extends number ? Body[] : Body;
type Act<D, V extends keyof D, R> = D[V] extends (...args: infer A) => unknown ? (...args: A) => Promise<R> : never;

/**
 * The driver's verbs, each performing the action and resolving to the body of the request it waited for. `clickTo`
 * and `pressTo` are not among them: an action that needs both a request and a destination is
 * `Promise.all([waitForApi(page, Api.X), d.clickTo(destination)])`.
 */
export type Settling<D extends AnyDriver, W extends AnyApiOp, Count> = {
    readonly [V in keyof D & SettleVerb]: Act<D, V, Result<BodyOf<W>, Count>>;
};

export class SettleError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SettleError';
    }
}

/**
 * "Do this and wait until the server has answered": performs the verb and waits for the request the spec names,
 * resolving to the response body.
 *
 *     const post = await settle(composer.sendButton, {wait: Api.CreatePost}).click();
 *     await settle(composer.messageTextbox, {wait: Api.CreatePost}).press('Enter');
 *     const files = await settle(composer.fileInput, {wait: Api.UploadFile, count: 2}).chooseFiles(paths);
 *     await settle(modal.saveButton, {wait: Api.PatchChannel, params: {channel_id: channel.id}}).click();
 *
 * It waits for the server to answer, not for the UI to re-render (Mattermost updates many views over the websocket
 * afterwards): assert UI state with the retrying matchers. Only requests the page issues after the action starts count
 * (one already in flight is someone else's), redirects are followed to the final response, a request that fails at the
 * network level gives way to a retry, and an HTTP error fails at once with its body. Requests are matched on the app
 * path, so this works under a subpath. A timeout lists the requests that were seen, by operation. A part that is
 * `NotRendered` is not a driver and is not accepted. There is no default wait and no callback form.
 */
export function settle<D extends AnyDriver, W extends AnyApiOp, Count extends number | undefined = undefined>(
    driver: D,
    opts: SettleOptions<W, Count>,
): Settling<D, W, Count> {
    if (!driver || !('meta' in driver) || !driver.meta) {
        throw new SettleError('settle: expected a driver; a part its mount never renders cannot be acted on.');
    }
    if (!opts?.wait) {
        throw new SettleError('settle: name the request to wait for: settle(driver, {wait: Api.…}).');
    }
    if (opts.count !== undefined && !(Number.isInteger(opts.count) && opts.count > 0)) {
        throw new SettleError(`settle: count must be a positive integer, not ${String(opts.count)}.`);
    }
    const observing: readonly string[] = OBSERVING_VERBS;
    const verbs: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
    for (const verb of VERBS) {
        const method = (driver as unknown as Record<string, unknown>)[verb];
        if (typeof method === 'function' && !observing.includes(verb)) {
            verbs[verb] = (...args: unknown[]) => settleVerb(driver, verb, () => method.apply(driver, args), opts);
        }
    }
    return verbs as Settling<D, W, Count>;
}

async function settleVerb(
    driver: AnyDriver,
    verb: string,
    act: () => Promise<unknown>,
    opts: SettleOptions<AnyApiOp, number | undefined>,
): Promise<unknown> {
    const {meta} = driver;
    const page = driver.locator.page();
    const count = opts.count ?? 1;
    const timeout = opts.timeout ?? DEFAULT_TIMEOUT;
    const watch = watchRequests(
        page,
        opts.wait,
        opts.params as Record<string, string | undefined> | undefined,
        opts.query,
    );
    try {
        await act();

        // the clock starts once the action has returned (a click auto-waits for its element first)
        const deadline = Date.now() + timeout;
        const after = `after ${verb}() on ${describeElement(meta)}`;
        const bodies: unknown[] = [];
        for (let i = 0; bodies.length < count; i++) {
            const found = await watch.response(i, deadline);
            if (found === TIMED_OUT) {
                throw new SettleError(
                    `settle: ${bodies.length ? `${bodies.length} of ${count} ` : 'no '}${watch.wanted} within ${timeout} ms ${after}.${watch.seen()}`,
                );
            }
            if ('noResponse' in found) {
                throw new SettleError(
                    `settle: ${describeRequest(found.noResponse)} (${watch.wanted}) had no response within ${timeout} ms ${after}.`,
                );
            }
            if (!found.res) {
                continue;
            }
            bodies.push(await bodyBefore(found.res, deadline, opts.status, after, 'settle', timeout));
        }
        return opts.count === undefined ? bodies[0] : bodies;
    } finally {
        watch.stop();
    }
}

/** What `waitForApi` takes besides the operation. */
export type ApiWaitOptions<W extends AnyApiOp> = {
    /** Bind the operation's path placeholders, so only the request for that entity counts: `{channel_id: channel.id}`. */
    params?: PathParamsOf<W>;

    /**
     * Only a request whose query string satisfies this counts: a string, that key present exactly once with that
     * decoded value; `null`, that key absent; other keys ignored. For two requests of one operation that differ only
     * by query (`{in_team: team.id, not_in_channel: null}`). Checked when the request is seen, before its status or
     * body, so a variant that fails it is never a candidate. It doesn't change which operation a request belongs to.
     */
    query?: QueryFilter;

    /**
     * Count only a response this holds for (the next page of posts, the channel once it's archived); others are
     * skipped and the wait goes on. It sees the typed body and the response, and runs within the timeout.
     */
    predicate?: (body: BodyOf<W>, response: Response) => boolean | Promise<boolean>;

    /** Expect this status instead of a 2xx (negative tests). */
    status?: number;

    /** How long to wait, counted from the call (default 30 s). One absolute deadline covers the body and the predicate. */
    timeout?: number;
};

/**
 * Waits for a request the page sends by itself (a websocket event refetching, a page loading its data), or arms a
 * wait before an action. Matching is `settle`'s. It starts listening when called.
 *
 * Several waits on one action have one form: one or more waiters, all registered first, then exactly one action:
 *
 *     const [job, saved] = await Promise.all([waitForApi(page, Api.CreateJob), settle(save, {wait: Api.PatchChannel}).click()]);
 *     const [post, channel] = await Promise.all([waitForApi(page, Api.CreatePost), send.clickTo(app.channelsPage, params)]);
 *
 * `Promise.all` does not cancel its siblings: if the action fails, a waiter keeps listening until its own deadline
 * and then removes its listener.
 */
export function waitForApi<W extends AnyApiOp>(page: Page, op: W, opts: ApiWaitOptions<W> = {}): Promise<BodyOf<W>> {
    const timeout = opts.timeout ?? DEFAULT_TIMEOUT;
    const deadline = Date.now() + timeout;
    const watch = watchRequests(page, op, opts.params as Record<string, string | undefined> | undefined, opts.query);
    const context = `while waiting for ${op.op}`;

    const wait = async (): Promise<BodyOf<W>> => {
        let rejected = 0;
        try {
            for (let i = 0; ; i++) {
                const found = await watch.response(i, deadline);
                if (found === TIMED_OUT) {
                    const skipped = rejected
                        ? ` that satisfies the predicate (${rejected} other${rejected === 1 ? '' : 's'} didn't)`
                        : '';
                    throw new SettleError(
                        `waitForApi: no ${watch.wanted}${skipped} within ${timeout} ms of the call.${watch.seen()}`,
                    );
                }
                if ('noResponse' in found) {
                    throw new SettleError(
                        `waitForApi: ${describeRequest(found.noResponse)} (${watch.wanted}) had no response within ${timeout} ms of the call.`,
                    );
                }
                if (!found.res) {
                    continue;
                }
                const res = found.res;
                const body = (await bodyBefore(
                    res,
                    deadline,
                    opts.status,
                    context,
                    'waitForApi',
                    timeout,
                )) as BodyOf<W>;
                if (!opts.predicate) {
                    return body;
                }
                const holds = await beforeDeadline(Promise.resolve(opts.predicate(body, res)), deadline);
                if (holds === TIMED_OUT) {
                    throw new SettleError(
                        `waitForApi: the predicate for ${watch.wanted} did not return within ${timeout} ms of the call.`,
                    );
                }
                if (holds) {
                    return body;
                }
                rejected++;
            }
        } finally {
            watch.stop();
        }
    };
    const result = wait();

    // a caller whose action throws before it awaits this would otherwise see an unhandled rejection later
    result.catch(() => undefined);
    return result;
}

/** Where an element comes from, for failure messages. */
export function describeElement(meta: Pick<Meta, 'testId' | 'source'>): string {
    return `"${meta.testId}" (${meta.source})`;
}

const DEFAULT_TIMEOUT = 30_000;

/** The app path of a request URL, as matching reads it: no subpath prefix, no query, no trailing slash. */
function pathOfUrl(url: string): string {
    return appPath(new URL(url).pathname);
}

function describeRequest(req: Request): string {
    return `${req.method()} ${pathOfUrl(req.url())}`;
}

/** The response a request ends with, following redirects; null when it failed at the network level. */
async function finalResponse(req: Request): Promise<Response | null> {
    let current = req;
    for (;;) {
        const res = await current.response();
        if (!res || res.status() < 300 || res.status() >= 400) {
            return res;
        }
        const next = current.redirectedTo();
        if (!next) {
            return res;
        }
        current = next;
    }
}

type Found = typeof TIMED_OUT | {noResponse: Request} | {res: Response | null};

/**
 * Listens for requests of `op` from now on: a request already in flight is never a candidate. `response(i)` is the
 * final response of the i-th candidate (null when it failed at the network level), within the deadline. A request is
 * a candidate when `isRequestFor` says it is the one `{wait: op, params}` names.
 */
function watchRequests(
    page: Page,
    op: AnyApiOp,
    params: Record<string, string | undefined> | undefined,
    query: QueryFilter | undefined,
) {
    const catalog = catalogOf(op);
    const candidates: Request[] = [];
    const issued: Request[] = [];
    let arrived = signal();
    const onRequest = (req: Request) => {
        // a redirect hop: followed from the request that started it
        if (req.redirectedFrom()) {
            return;
        }
        const path = pathOfUrl(req.url());
        if (path.startsWith('/api/')) {
            issued.push(req);
        }
        if (isCandidate(op, {params, query}, req.method(), path, new URL(req.url()).search)) {
            candidates.push(req);
            arrived.resolve();
            arrived = signal();
        }
    };
    page.on('request', onRequest);

    return {
        wanted: `${op.method} ${op.path} (${op.op})${query && Object.keys(query).length ? ` with query ${describeQuery(query)}` : ''}`,
        async response(i: number, deadline: number): Promise<Found> {
            while (i >= candidates.length) {
                if ((await beforeDeadline(arrived.promise, deadline)) === TIMED_OUT) {
                    return TIMED_OUT;
                }
            }
            const req = candidates[i];
            const res = await beforeDeadline(finalResponse(req), deadline);
            if (res === TIMED_OUT) {
                return {noResponse: req};
            }
            // null: failed at the network level (aborted, connection reset); the app may retry, so wait for the next one
            return {res};
        },
        seen(): string {
            const lines = describeSeen(
                catalog,
                issued.map((r) => ({method: r.method(), path: pathOfUrl(r.url()), search: new URL(r.url()).search})),
            );
            return lines.length
                ? ` API requests the page issued: ${lines.join(', ')}.`
                : ' The page issued no API request.';
        },
        stop() {
            page.off('request', onRequest);
        },
    };
}

/** The response's body (parsed JSON, else text) read within the deadline, or a SettleError for an unexpected status. */
async function bodyBefore(
    res: Response,
    deadline: number,
    status: number | undefined,
    context: string,
    who: string,
    timeout: number,
): Promise<unknown> {
    const ok = status === undefined ? res.ok() : res.status() === status;
    const request = `${res.request().method()} ${pathOfUrl(res.url())}`;

    // a body that can't be read (the connection reset, the page closed) is not an empty body
    const read = await beforeDeadline(
        res.text().then(
            (text) => ({text}),
            (error: unknown) => ({error}),
        ),
        deadline,
    );
    if (read === TIMED_OUT) {
        throw new SettleError(
            `${who}: the body of ${request} (${res.status()}) did not arrive within ${timeout} ms ${context}.`,
        );
    }
    if (!ok) {
        const shown = 'text' in read ? read.text.slice(0, 300) : '(its body could not be read)';
        throw new SettleError(
            `${who}: ${request} returned ${res.status()}${status ? `, expected ${status}` : ''} ${context}. ${shown}`,
        );
    }
    if ('error' in read) {
        throw new SettleError(
            `${who}: the body of ${request} (${res.status()}) could not be read ${context}: ${read.error instanceof Error ? read.error.message : String(read.error)}`,
        );
    }
    const {text} = read;
    if (!text) {
        return undefined;
    }
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

function signal(): {promise: Promise<void>; resolve: () => void} {
    let resolve!: () => void;
    const promise = new Promise<void>((r) => {
        resolve = r;
    });
    return {promise, resolve};
}
