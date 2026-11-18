// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * The operations catalog: what `Api` is made of, and how a request is matched to an operation.
 *
 * The generated `api.ts` imports `apiOp` and `defineApi` from the runtime; the runtime never imports generated code.
 * Nothing here knows which element sends which request: the catalog comes from the client source alone.
 */

export type HttpMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Links an operation to every operation of its catalog. Set by `defineApi`, read by the matcher. */
export const CATALOG: unique symbol = Symbol('catalog');

/** One operation of the client, branded with its response body and its literal path. Built only by the generated `Api`. */
export interface ApiOp<Body = unknown, Path extends string = string> {
    readonly op: string;
    readonly method: HttpMethod;

    /** The path template, `/api/v4/channels/{channel_id}/patch`. */
    readonly path: Path;

    /** Type-level only. */
    readonly __body?: Body;
    readonly [CATALOG]?: readonly AnyApiOp[];
}

export type AnyApiOp = ApiOp<unknown, string>;

export type BodyOf<W> = W extends ApiOp<infer Body, string> ? Body : never;

/** The placeholders of a path template: `'/api/v4/channels/{channel_id}/members/{user_id}'` -> `'channel_id' | 'user_id'`. */
export type PlaceholdersOf<Path extends string> = Path extends `${string}{${infer Name}}${infer Rest}`
    ? Name | PlaceholdersOf<Rest>
    : never;

/** Values for an operation's path placeholders, to wait for one entity's request only: `{channel_id: channel.id}`. */
export type PathParamsOf<W> =
    W extends ApiOp<unknown, infer Path>
        ? [PlaceholdersOf<Path>] extends [never]
            ? Record<string, never> // no placeholder: nothing can be named
            : Partial<Record<PlaceholdersOf<Path>, string>>
        : never;

/** `apiOp<Channel>()({op: 'PatchChannel', method: 'PUT', path: '/api/v4/channels/{channel_id}/patch'})` */
export function apiOp<Body>(): <const Path extends string>(o: {
    op: string;
    method: HttpMethod;
    path: Path;
}) => ApiOp<Body, Path> {
    return (o) => ({...o});
}

/**
 * The generated `Api`: every operation of the client, each linked to all of them.
 *
 * Two operations with the same method and the same pattern are an error (the scan reports it first). Placeholder
 * names do not distinguish patterns: `/users/{id}` and `/users/{user_id}` are the same.
 */
export function defineApi<const T extends Record<string, AnyApiOp>>(ops: T): T {
    const all: AnyApiOp[] = [];
    const seen = new Map<string, string>();
    const out: Record<string, AnyApiOp> = {};
    for (const [name, op] of Object.entries(ops)) {
        if (!op.path.startsWith('/') || segments(op.path).includes('')) {
            throw new Error(`Api: ${name} has a path with an empty segment: ${op.path}`);
        }
        const key = `${op.method} ${canonicalPattern(op.path)}`;
        const other = seen.get(key);
        if (other) {
            throw new Error(`Api: ${name} and ${other} are both ${key}`);
        }
        seen.set(key, name);
        const linked: AnyApiOp = {...op, [CATALOG]: all};
        all.push(linked);
        out[name] = linked;
    }
    return out as T;
}

/** A path template with its placeholder names removed: `/users/{user_id}/image` -> `/users/{}/image`. */
export function canonicalPattern(path: string): string {
    return path.replace(/\{[^}]*\}/g, '{}');
}

/** The segments after the leading slash. Empty segments are kept: `/users//me` has three, and matches nothing. */
const segments = (path: string) => (path.startsWith('/') ? path.slice(1) : path).split('/');
const isPlaceholder = (segment: string) => /^\{[^}]*\}$/.test(segment);

/** Whether the template matches the path, segment by segment. A placeholder matches exactly one non-empty segment. */
function fits(template: string, path: string): boolean {
    const want = segments(template);
    const got = segments(path);
    return (
        want.length === got.length &&
        want.every((segment, i) => (isPlaceholder(segment) ? got[i] !== '' : segment === got[i]))
    );
}

/** The decoded segment, or null when its percent-encoding is malformed: such a request matches no filled value. */
function decoded(segment: string): string | null {
    try {
        return decodeURIComponent(segment);
    } catch {
        return null;
    }
}

/**
 * The operation a request belongs to: among the operations with its method whose pattern fits its path, the most
 * specific. Comparing segments left to right, a literal beats a placeholder. Patterns are unique, so there is no tie.
 * `GET /api/v4/users/me` is `GetMe`, never `GetUser`.
 *
 * `path` is the request's app path: no origin, no subpath prefix, no query, no trailing slash. An encoded segment
 * stays one segment, and an empty segment is a segment: nothing is collapsed.
 */
export function operationOf(catalog: readonly AnyApiOp[], method: string, path: string): AnyApiOp | null {
    let best: AnyApiOp | null = null;
    for (const op of catalog) {
        if (op.method !== method.toUpperCase() || !fits(op.path, path)) {
            continue;
        }
        if (!best || moreSpecific(op.path, best.path)) {
            best = op;
        }
    }
    return best;
}

function moreSpecific(a: string, b: string): boolean {
    const as = segments(a);
    const bs = segments(b);
    for (let i = 0; i < as.length; i++) {
        const literalA = !isPlaceholder(as[i]);
        const literalB = !isPlaceholder(bs[i]);
        if (literalA !== literalB) {
            return literalA;
        }
    }
    return false;
}

/**
 * Whether a request is the one `{wait, params}` names.
 *
 *  - Every placeholder filled: the request's path must be exactly the filled path, and that is all. The test named one
 *    concrete request.
 *  - A placeholder left open: the request must belong to this operation by `operationOf` (most specific wins), and
 *    agree with the placeholders that were filled.
 */
export function isRequestFor(
    wait: AnyApiOp,
    params: Record<string, string | undefined> | undefined,
    method: string,
    path: string,
): boolean {
    if (wait.method !== method.toUpperCase() || !fits(wait.path, path)) {
        return false;
    }
    const want = segments(wait.path);
    const got = segments(path);
    let open = false;
    for (let i = 0; i < want.length; i++) {
        if (!isPlaceholder(want[i])) {
            continue;
        }
        const value = params?.[want[i].slice(1, -1)];
        if (value === undefined) {
            open = true;
        } else if (decoded(got[i]) !== value) {
            return false;
        }
    }
    if (!open) {
        return true;
    }
    return operationOf(catalogOf(wait), method, path)?.op === wait.op;
}

/**
 * What a spec says about a request's query string, to tell two requests of ONE operation apart
 * (`GET /users?in_team=…` and `GET /users?in_team=…&not_in_channel=…` are both `GetUsers`).
 *
 *  - a string: the query has that key exactly once, and its value equals the string;
 *  - `null`: the query does not have that key;
 *  - a key the filter does not list is ignored.
 *
 * Keys are not typed: the catalog knows endpoints, not query shapes (a client call's query cannot be read exactly from
 * its source).
 */
export type QueryFilter = Readonly<Record<string, string | null>>;

/**
 * Whether a request's query string satisfies the filter. `search` is the URL's search part, with or without `?`.
 *
 * Decoding is `URLSearchParams`, nothing else: `+` is a space, percent-decoding happens once, `x=` is present with
 * an empty value. A key given twice never equals a string, whatever its values.
 */
export function matchesQuery(search: string, filter: QueryFilter | undefined): boolean {
    if (!filter) {
        return true;
    }
    const query = new URLSearchParams(search);
    for (const [key, want] of Object.entries(filter)) {
        const got = query.getAll(key);
        if (want === null ? got.length !== 0 : got.length !== 1 || got[0] !== want) {
            return false;
        }
    }
    return true;
}

/**
 * Whether a request is a candidate for `{wait, params, query}`, decided when the request is REGISTERED: from its
 * method and URL alone, before its status or body is looked at and before it counts toward `count`. A request that
 * is not a candidate is ignored whatever it answers: an unwanted variant that returns 500, or whose body never
 * arrives, neither fails the wait nor uses its deadline.
 *
 * The path must satisfy `isRequestFor`; the query filter is applied after it.
 */
export function isCandidate(
    wait: AnyApiOp,
    opts: {params?: Record<string, string | undefined>; query?: QueryFilter},
    method: string,
    path: string,
    search: string,
): boolean {
    return isRequestFor(wait, opts.params, method, path) && matchesQuery(search, opts.query);
}

/** How many seen requests a timeout message lists. */
export const SEEN_LIMIT = 20;

/** The filter as a timeout message prints it: `in_team=abc, not_in_channel absent`. Keys sorted. */
export function describeQuery(filter: QueryFilter | undefined): string {
    const keys = Object.keys(filter ?? {}).sort();
    return keys.map((key) => (filter![key] === null ? `${key} absent` : `${key}=${filter![key]}`)).join(', ');
}

/**
 * The requests a timeout message lists: each with its operation (or method and path when it belongs to none) and its
 * query string, the first `SEEN_LIMIT` in the order issued, then how many were left out.
 */
export function describeSeen(
    catalog: readonly AnyApiOp[],
    seen: ReadonlyArray<{method: string; path: string; search: string}>,
): string[] {
    const lines = seen.slice(0, SEEN_LIMIT).map((request) => {
        const op = operationOf(catalog, request.method, request.path);
        const search = request.search && !request.search.startsWith('?') ? `?${request.search}` : request.search;
        return `${op ? op.op : `${request.method.toUpperCase()} ${request.path}`}${search}`;
    });
    if (seen.length > SEEN_LIMIT) {
        lines.push(`… and ${seen.length - SEEN_LIMIT} more`);
    }
    return lines;
}

/** Every operation of the catalog `op` was defined in. */
export function catalogOf(op: AnyApiOp): readonly AnyApiOp[] {
    const catalog = op[CATALOG];
    if (!catalog) {
        throw new Error(`${op.op} was not built by defineApi`);
    }
    return catalog;
}
