// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyFieldOption} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';

import {
    ACCESS_CONTROL_GROUP,
    PROPERTY_FIELD_OPTIONS_PER_PAGE,
    clearPropertyFieldOptionWalks,
    pageAllPropertyFieldOptions,
} from './page_all_property_field_options';

// One flat, creation-ordered list, the way the server stores them: unique ids and
// strictly increasing create_at, so a cursor identifies exactly one position.
function makeOptions(count: number): PropertyFieldOption[] {
    return Array.from({length: count}, (unused, i) => ({
        id: `opt-${i}`,
        name: `Option ${i}`,
        parents: [],
        create_at: 1000 + i,
    }));
}

// A canned page, for the tests that care about the shape of a page rather than
// about walking a keyset. Always queued with the `...Once` mock forms so the
// number of pages a test hands out is exactly the number it queued -- see the
// exhaustion guard in `beforeEach`.
function makePage(count: number, prefix: string): PropertyFieldOption[] {
    return Array.from({length: count}, (unused, i) => ({
        id: `${prefix}-${i}`,
        name: `${prefix} ${i}`,
        parents: [],
        create_at: 1000 + i,
    }));
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return {promise, resolve, reject};
}

// A page turn costs a handful of microtask ticks, so polling beats guessing how
// many. Bounded so a walk that never advances fails the assertion, not the run.
async function waitForCalls(spy: jest.SpyInstance, count: number) {
    for (let i = 0; i < 200 && spy.mock.calls.length < count; i++) {
        await Promise.resolve(); // eslint-disable-line no-await-in-loop
    }
}

// Node reports an unhandled rejection at a macrotask boundary, so the caller has
// to cross one before reading `seen`.
function captureUnhandledRejections() {
    const seen: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
        seen.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);
    return {
        seen,
        stop: () => process.off('unhandledRejection', onUnhandled),
    };
}

function macrotask() {
    return new Promise((resolve) => {
        setTimeout(resolve, 0);
    });
}

type KeysetServer = {
    spy: jest.SpyInstance;

    // The pages handed back, in order, so a test can state the cursor it expects
    // in terms of what it was actually served rather than in terms of a guess.
    served: PropertyFieldOption[][];
};

/**
 * Serves a real keyset: every request returns the slice that *follows* the cursor
 * it was handed. A mock that returns pre-canned pages off a call counter cannot
 * tell a correct walk from one whose cursor never advances, and the latter is not
 * a truncation against a real server -- it is an infinite loop with an
 * accumulator that grows until the tab dies. So a repeated cursor is an error
 * here, not a silent re-serve, and the two halves are cross-checked.
 *
 * One instance per walk: a second walk legitimately re-requests the first page.
 */
function makeKeysetServer(all: PropertyFieldOption[]): KeysetServer {
    const served: PropertyFieldOption[][] = [];
    const requested = new Set<string>();

    const spy = jest.spyOn(Client4, 'getPropertyFieldOptions').mockImplementation(
        async (groupName, objectType, fieldId, options) => {
            const cursorKey = `${options?.cursorId ?? '(none)'}:${options?.cursorCreateAt ?? 0}`;
            if (requested.has(cursorKey)) {
                throw new Error(
                    `keyset server: cursor ${cursorKey} was requested twice, so the walk is not advancing`,
                );
            }
            requested.add(cursorKey);

            let start = 0;
            if (options?.cursorId) {
                const previous = all.findIndex((option) => option.id === options.cursorId);
                if (previous === -1) {
                    throw new Error(`keyset server: no option has cursor id ${options.cursorId}`);
                }
                if (all[previous].create_at !== options.cursorCreateAt) {
                    throw new Error(
                        `keyset server: cursor halves disagree -- ${options.cursorId} was created at ${all[previous].create_at}, not ${options.cursorCreateAt}`,
                    );
                }
                start = previous + 1;
            }

            const page = all.slice(start, start + (options?.perPage ?? PROPERTY_FIELD_OPTIONS_PER_PAGE));
            served.push(page);
            return page;
        },
    );

    return {spy, served};
}

// Every request after the first must carry both halves of the last option of the
// page before it, and the first must carry neither.
function expectCursorChain(server: KeysetServer) {
    const {calls} = server.spy.mock;

    expect(calls[0][3]).toStrictEqual({
        perPage: PROPERTY_FIELD_OPTIONS_PER_PAGE,
        cursorId: undefined,
        cursorCreateAt: undefined,
    });

    for (let i = 1; i < calls.length; i++) {
        const previousPage = server.served[i - 1];
        const last = previousPage[previousPage.length - 1];

        expect(calls[i][3]).toStrictEqual({
            perPage: PROPERTY_FIELD_OPTIONS_PER_PAGE,
            cursorId: last.id,
            cursorCreateAt: last.create_at,
        });
    }
}

const FIELD = {id: 'field-1', object_type: 'user'};

describe('pageAllPropertyFieldOptions', () => {
    beforeEach(() => {
        jest.restoreAllMocks();
        clearPropertyFieldOptionWalks();

        // Asking for a page this test did not queue is an error in its own right,
        // and the two things that happen without this default are both far worse
        // than a failed assertion. An open-ended mock re-serves the same page
        // forever, and because the helper accumulates every page it is handed that
        // exhausts the heap and kills the worker. An exhausted `...Once` queue
        // falls through to the real `Client4`, which reaches `node-fetch` and kills
        // the worker too. Either way the whole file's report is lost, and a walk
        // that does not terminate is exactly the defect this suite exists to catch.
        // Tests layer `...Once` pages, or a keyset server, on top of this.
        jest.spyOn(Client4, 'getPropertyFieldOptions').mockImplementation(async () => {
            throw new Error('the walk requested more pages than this test queued');
        });
    });

    describe('paging', () => {
        it('returns every option of a single short page', async () => {
            const all = makeOptions(3);
            const server = makeKeysetServer(all);

            const result = await pageAllPropertyFieldOptions(FIELD);

            expect(result).toEqual(all);
            expect(server.spy).toHaveBeenCalledTimes(1);
        });

        it('stops after a page shorter than the page size', async () => {
            const all = makeOptions(PROPERTY_FIELD_OPTIONS_PER_PAGE + 5);
            const server = makeKeysetServer(all);

            const result = await pageAllPropertyFieldOptions(FIELD);

            expect(result).toHaveLength(205);
            expect(server.spy).toHaveBeenCalledTimes(2);
            expectCursorChain(server);
        });

        it('pages once more when the first page is exactly the page size and the second is empty', async () => {
            const all = makeOptions(PROPERTY_FIELD_OPTIONS_PER_PAGE);
            const server = makeKeysetServer(all);

            const result = await pageAllPropertyFieldOptions(FIELD);

            expect(result).toHaveLength(PROPERTY_FIELD_OPTIONS_PER_PAGE);
            expect(server.spy).toHaveBeenCalledTimes(2);
            expect(server.served[1]).toEqual([]);
            expectCursorChain(server);
        });

        it('concatenates three pages in server order', async () => {
            const all = makeOptions(407);
            const server = makeKeysetServer(all);

            const result = await pageAllPropertyFieldOptions(FIELD);

            expect(result).toHaveLength(407);
            expect(result[0].id).toBe('opt-0');
            expect(result[406].id).toBe('opt-406');
            expect(server.spy).toHaveBeenCalledTimes(3);
            expectCursorChain(server);
        });

        it('advances the cursor on every request past the second', async () => {
            // The regression guard for a cursor that stops advancing. A mock driven
            // off a call counter serves the right pages no matter what it is asked
            // for, so a frozen cursor looks like a passing walk; the keyset server
            // rejects the repeated request instead. Five pages, so the assertion
            // reaches well past `calls[1]`.
            const all = makeOptions((PROPERTY_FIELD_OPTIONS_PER_PAGE * 4) + 3);
            const server = makeKeysetServer(all);

            const result = await pageAllPropertyFieldOptions(FIELD);

            expect(server.spy).toHaveBeenCalledTimes(5);
            expectCursorChain(server);

            const cursorsSent = server.spy.mock.calls.slice(1).map((call) => call[3].cursorCreateAt);
            expect(cursorsSent).toEqual([1199, 1399, 1599, 1799]);
            expect(result).toHaveLength(803);
        });

        it('returns every option exactly once across page boundaries', async () => {
            const all = makeOptions(407);
            const server = makeKeysetServer(all);

            const result = await pageAllPropertyFieldOptions(FIELD);

            const ids = result.map((option) => option.id);

            // Equality against the server's own order proves no duplicate, no gap
            // and no reordering at the two page seams in one assertion.
            expect(ids).toEqual(all.map((option) => option.id));
            expect(new Set(ids).size).toBe(ids.length);
            expect(server.spy).toHaveBeenCalledTimes(3);
        });

        it('resolves an empty array on an empty first page', async () => {
            const server = makeKeysetServer([]);

            const result = await pageAllPropertyFieldOptions(FIELD);

            expect(result).toEqual([]);
            expect(server.spy).toHaveBeenCalledTimes(1);
        });

        it('sends no cursor on the first request', async () => {
            const server = makeKeysetServer(makeOptions(3));

            await pageAllPropertyFieldOptions(FIELD);

            expect(server.spy.mock.calls[0][3]).toStrictEqual({
                perPage: PROPERTY_FIELD_OPTIONS_PER_PAGE,
                cursorId: undefined,
                cursorCreateAt: undefined,
            });
        });

        it('sends both cursor halves taken from the last option of the previous page', async () => {
            const all = makeOptions(PROPERTY_FIELD_OPTIONS_PER_PAGE + 2);
            const server = makeKeysetServer(all);

            await pageAllPropertyFieldOptions(FIELD);

            const lastOfFirstPage = all[PROPERTY_FIELD_OPTIONS_PER_PAGE - 1];
            expect(server.spy.mock.calls[1][3]).toStrictEqual({
                perPage: PROPERTY_FIELD_OPTIONS_PER_PAGE,
                cursorId: lastOfFirstPage.id,
                cursorCreateAt: lastOfFirstPage.create_at,
            });
        });

        it('always sends per_page 200', async () => {
            const server = makeKeysetServer(makeOptions(407));

            await pageAllPropertyFieldOptions(FIELD);

            expect(server.spy).toHaveBeenCalledTimes(3);
            for (const call of server.spy.mock.calls) {
                expect(call[3]).toMatchObject({perPage: PROPERTY_FIELD_OPTIONS_PER_PAGE});
            }
        });

        it('uses the access_control group and the field object_type', async () => {
            const server = makeKeysetServer(makeOptions(PROPERTY_FIELD_OPTIONS_PER_PAGE + 1));

            // Not an inline literal: `linked_field_id` only pairs a field with the
            // template it copied and must never reach the GET.
            const fieldWithLink = {id: 'field-1', object_type: 'user', linked_field_id: 'other-field'};

            await pageAllPropertyFieldOptions(fieldWithLink);

            expect(server.spy).toHaveBeenCalledTimes(2);
            for (const call of server.spy.mock.calls) {
                expect(call.slice(0, 3)).toEqual([ACCESS_CONTROL_GROUP, 'user', 'field-1']);
            }
            expect(JSON.stringify(server.spy.mock.calls)).not.toContain('other-field');
        });
    });

    describe('cursor hard stop', () => {
        it('throws when the last option of a full page has no create_at', async () => {
            const page = makePage(PROPERTY_FIELD_OPTIONS_PER_PAGE, 'p1');
            delete page[page.length - 1].create_at;
            const spy = jest.spyOn(Client4, 'getPropertyFieldOptions').mockResolvedValueOnce(page);

            await expect(pageAllPropertyFieldOptions(FIELD)).rejects.toThrow(/has no create_at/);
            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('throws when the last option of a full page has create_at 0', async () => {
            const page = makePage(PROPERTY_FIELD_OPTIONS_PER_PAGE, 'p1');
            page[page.length - 1].create_at = 0;
            const spy = jest.spyOn(Client4, 'getPropertyFieldOptions').mockResolvedValueOnce(page);

            await expect(pageAllPropertyFieldOptions(FIELD)).rejects.toThrow(/has no create_at/);
            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('throws when the last option of a full page has no id', async () => {
            const page = makePage(PROPERTY_FIELD_OPTIONS_PER_PAGE, 'p1');
            page[page.length - 1].id = '';
            const spy = jest.spyOn(Client4, 'getPropertyFieldOptions').mockResolvedValueOnce(page);

            // Names the half that is actually missing: this option has a perfectly
            // good create_at, so reporting one would send the next reader hunting
            // for the wrong fault.
            await expect(pageAllPropertyFieldOptions(FIELD)).rejects.toThrow(
                /option \(no id\) of field field-1 has no id/,
            );
            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('does not throw when a short page\'s last option has no create_at', async () => {
            const page = makePage(5, 'p1');
            delete page[page.length - 1].create_at;
            const spy = jest.spyOn(Client4, 'getPropertyFieldOptions').mockResolvedValueOnce(page);

            await expect(pageAllPropertyFieldOptions(FIELD)).resolves.toHaveLength(5);
            expect(spy).toHaveBeenCalledTimes(1);
        });
    });

    describe('plugin mounts', () => {
        it('resolves [] without calling Client4 when field.id is missing', async () => {
            const spy = jest.spyOn(Client4, 'getPropertyFieldOptions');

            await expect(pageAllPropertyFieldOptions({object_type: 'user'})).resolves.toEqual([]);
            expect(spy).not.toHaveBeenCalled();
        });

        it('resolves [] without calling Client4 when field.object_type is missing', async () => {
            const spy = jest.spyOn(Client4, 'getPropertyFieldOptions');

            await expect(pageAllPropertyFieldOptions({id: 'field-1'})).resolves.toEqual([]);
            expect(spy).not.toHaveBeenCalled();
        });

        it('resolves [] without calling Client4 when field.id is an empty string', async () => {
            const spy = jest.spyOn(Client4, 'getPropertyFieldOptions');

            await expect(pageAllPropertyFieldOptions({id: '', object_type: 'user'})).resolves.toEqual([]);
            expect(spy).not.toHaveBeenCalled();
        });

        it('resolves [] without calling Client4 when field.object_type is an empty string', async () => {
            const spy = jest.spyOn(Client4, 'getPropertyFieldOptions');

            await expect(pageAllPropertyFieldOptions({id: 'field-1', object_type: ''})).resolves.toEqual([]);
            expect(spy).not.toHaveBeenCalled();
        });

        it('resolves [] for a field with no id even when the signal is already aborted', async () => {
            const spy = jest.spyOn(Client4, 'getPropertyFieldOptions');
            const controller = new AbortController();
            controller.abort();

            await expect(
                pageAllPropertyFieldOptions({object_type: 'user'}, {signal: controller.signal}),
            ).resolves.toEqual([]);
            expect(spy).not.toHaveBeenCalled();
        });
    });

    describe('in-flight dedupe', () => {
        it('two concurrent callers for the same field id share one walk', async () => {
            const page = deferred<PropertyFieldOption[]>();
            const spy = jest.spyOn(Client4, 'getPropertyFieldOptions').mockReturnValueOnce(page.promise);

            const a = pageAllPropertyFieldOptions(FIELD);
            const b = pageAllPropertyFieldOptions(FIELD);

            page.resolve(makePage(3, 'p1'));

            const [resultA, resultB] = await Promise.all([a, b]);

            expect(resultA).toEqual(resultB);
            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('two concurrent callers for the same field id receive the same array', async () => {
            const page = deferred<PropertyFieldOption[]>();
            jest.spyOn(Client4, 'getPropertyFieldOptions').mockReturnValueOnce(page.promise);

            const a = pageAllPropertyFieldOptions(FIELD);
            const b = pageAllPropertyFieldOptions(FIELD);

            page.resolve(makePage(3, 'p1'));

            const [resultA, resultB] = await Promise.all([a, b]);

            expect(resultA).toBe(resultB);
        });

        it('concurrent callers for different field ids each get their own walk', async () => {
            const spy = jest.spyOn(Client4, 'getPropertyFieldOptions').
                mockResolvedValueOnce(makePage(3, 'p1')).
                mockResolvedValueOnce(makePage(3, 'p1'));

            await Promise.all([
                pageAllPropertyFieldOptions({id: 'field-1', object_type: 'user'}),
                pageAllPropertyFieldOptions({id: 'field-2', object_type: 'user'}),
            ]);

            expect(spy).toHaveBeenCalledTimes(2);
            expect(spy.mock.calls.map((call) => call[2]).sort()).toEqual(['field-1', 'field-2']);
        });

        it('concurrent callers with the same field id and different object_type each get their own walk', async () => {
            // The map is keyed on object_type and id together. A field id maps to
            // one object_type server-side, so a caller that disagrees is holding a
            // malformed field -- it should get its own (404-ing) request rather
            // than quietly receive another object type's options.
            const spy = jest.spyOn(Client4, 'getPropertyFieldOptions').
                mockResolvedValueOnce(makePage(3, 'p1')).
                mockResolvedValueOnce(makePage(3, 'p1'));

            await Promise.all([
                pageAllPropertyFieldOptions({id: 'field-1', object_type: 'user'}),
                pageAllPropertyFieldOptions({id: 'field-1', object_type: 'channel'}),
            ]);

            expect(spy).toHaveBeenCalledTimes(2);
            expect(spy.mock.calls.map((call) => call[1]).sort()).toEqual(['channel', 'user']);
        });

        it('a caller arriving after a walk settles starts a fresh walk', async () => {
            const spy = jest.spyOn(Client4, 'getPropertyFieldOptions').
                mockResolvedValueOnce(makePage(3, 'p1')).
                mockResolvedValueOnce(makePage(3, 'p1'));

            await pageAllPropertyFieldOptions(FIELD);
            await pageAllPropertyFieldOptions(FIELD);

            expect(spy).toHaveBeenCalledTimes(2);
        });

        it('dedupes across a multi-page walk', async () => {
            const firstPage = deferred<PropertyFieldOption[]>();
            const spy = jest.spyOn(Client4, 'getPropertyFieldOptions').
                mockReturnValueOnce(firstPage.promise).
                mockResolvedValueOnce(makePage(3, 'p2'));

            const a = pageAllPropertyFieldOptions(FIELD);
            const b = pageAllPropertyFieldOptions(FIELD);

            firstPage.resolve(makePage(PROPERTY_FIELD_OPTIONS_PER_PAGE, 'p1'));

            const [resultA, resultB] = await Promise.all([a, b]);

            expect(resultA).toHaveLength(203);
            expect(resultB).toHaveLength(203);
            expect(spy).toHaveBeenCalledTimes(2);
        });
    });

    describe('abort', () => {
        it('rejects with AbortError when the signal aborts mid-walk', async () => {
            const page = deferred<PropertyFieldOption[]>();
            jest.spyOn(Client4, 'getPropertyFieldOptions').mockReturnValueOnce(page.promise);

            const controller = new AbortController();
            const promise = pageAllPropertyFieldOptions(FIELD, {signal: controller.signal});

            controller.abort();

            await expect(promise).rejects.toMatchObject({name: 'AbortError'});

            // Letting the walk finish afterwards must not re-settle the wrapper:
            // the caller stays rejected rather than being handed a late array.
            page.resolve(makePage(3, 'p1'));
            await macrotask();
            await expect(promise).rejects.toMatchObject({name: 'AbortError'});
        });

        it('never resolves an aborted caller with a partial list', async () => {
            const secondPage = deferred<PropertyFieldOption[]>();
            const spy = jest.spyOn(Client4, 'getPropertyFieldOptions').
                mockResolvedValueOnce(makePage(PROPERTY_FIELD_OPTIONS_PER_PAGE, 'p1')).
                mockReturnValueOnce(secondPage.promise);

            const controller = new AbortController();
            const promise = pageAllPropertyFieldOptions(FIELD, {signal: controller.signal});

            // Let page 1 land so there is a partial list to be tempted by.
            await waitForCalls(spy, 2);
            expect(spy).toHaveBeenCalledTimes(2);

            controller.abort();

            const rejection = await promise.then(
                (value) => ({resolved: true, value}),
                (error) => ({resolved: false, value: error}),
            );

            expect(rejection.resolved).toBe(false);
            expect(Array.isArray(rejection.value)).toBe(false);
            expect(rejection.value).toMatchObject({name: 'AbortError'});

            secondPage.resolve(makePage(1, 'p2'));
            await macrotask();
        });

        it('rejects immediately for a caller whose signal is already aborted', async () => {
            const page = deferred<PropertyFieldOption[]>();
            jest.spyOn(Client4, 'getPropertyFieldOptions').mockReturnValueOnce(page.promise);

            // LOAD-BEARING, and the only test in this file that covers it.
            //
            // `pageAllPropertyFieldOptions` attaches its handlers to the shared walk
            // BEFORE testing `signal.aborted`. Move that attach after the check and
            // this test is the sole failure: an already-aborted caller -- a React
            // effect that aborts before its body runs, or a strict-mode double
            // invoke straddling a macrotask -- would leave the walk with no
            // rejection handler, and a 403/404 (reachable in production: the whole
            // /properties route tree is feature-flagged) becomes an unhandled
            // rejection that kills the surrounding code.
            //
            // The assertion below is an absence check, which makes it look weak. It
            // is not redundant with anything. Do not delete it.
            const unhandled = captureUnhandledRejections();
            const controller = new AbortController();
            controller.abort();

            const promise = pageAllPropertyFieldOptions(FIELD, {signal: controller.signal});

            await expect(promise).rejects.toMatchObject({name: 'AbortError'});

            page.reject(new Error('too late'));
            await macrotask();

            expect(unhandled.seen.map((reason) => `walk rejected with no handler attached: ${String(reason)}`)).toEqual([]);
            unhandled.stop();
        });

        it('aborting one caller leaves the other caller\'s promise pending', async () => {
            const page = deferred<PropertyFieldOption[]>();
            jest.spyOn(Client4, 'getPropertyFieldOptions').mockReturnValueOnce(page.promise);

            const controllerA = new AbortController();
            const controllerB = new AbortController();
            const a = pageAllPropertyFieldOptions(FIELD, {signal: controllerA.signal});
            const b = pageAllPropertyFieldOptions(FIELD, {signal: controllerB.signal});

            controllerA.abort();

            await expect(a).rejects.toMatchObject({name: 'AbortError'});

            const sentinel = Symbol('pending');
            await expect(Promise.race([b, Promise.resolve(sentinel)])).resolves.toBe(sentinel);

            page.resolve(makePage(1, 'p1'));
            await b;
        });

        it('aborting one caller still delivers the complete list to the other', async () => {
            const page = deferred<PropertyFieldOption[]>();
            const spy = jest.spyOn(Client4, 'getPropertyFieldOptions').mockReturnValueOnce(page.promise);

            const controllerA = new AbortController();
            const controllerB = new AbortController();
            const a = pageAllPropertyFieldOptions(FIELD, {signal: controllerA.signal});
            const b = pageAllPropertyFieldOptions(FIELD, {signal: controllerB.signal});

            controllerA.abort();
            await expect(a).rejects.toMatchObject({name: 'AbortError'});

            const complete = makePage(3, 'p1');
            page.resolve(complete);

            await expect(b).resolves.toEqual(complete);
            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('aborting one caller does not abort the shared walk', async () => {
            const firstPage = deferred<PropertyFieldOption[]>();
            const spy = jest.spyOn(Client4, 'getPropertyFieldOptions').
                mockReturnValueOnce(firstPage.promise).
                mockResolvedValueOnce(makePage(2, 'p2'));

            const controllerA = new AbortController();
            const controllerB = new AbortController();
            const a = pageAllPropertyFieldOptions(FIELD, {signal: controllerA.signal});
            const b = pageAllPropertyFieldOptions(FIELD, {signal: controllerB.signal});

            controllerA.abort();
            await expect(a).rejects.toMatchObject({name: 'AbortError'});
            expect(spy).toHaveBeenCalledTimes(1);

            firstPage.resolve(makePage(PROPERTY_FIELD_OPTIONS_PER_PAGE, 'p1'));

            await expect(b).resolves.toHaveLength(202);
            expect(spy).toHaveBeenCalledTimes(2);
        });

        it('an aborted caller does not receive the walk\'s later error', async () => {
            const page = deferred<PropertyFieldOption[]>();
            jest.spyOn(Client4, 'getPropertyFieldOptions').mockReturnValueOnce(page.promise);

            const controller = new AbortController();
            const promise = pageAllPropertyFieldOptions(FIELD, {signal: controller.signal});

            controller.abort();

            const clientError = new Error('forbidden');
            clientError.name = 'ClientError';
            page.reject(clientError);

            await expect(promise).rejects.toMatchObject({name: 'AbortError'});
            await expect(promise).rejects.not.toBe(clientError);
        });

        it('does not attach an abort listener when no signal is given', async () => {
            const page = deferred<PropertyFieldOption[]>();
            jest.spyOn(Client4, 'getPropertyFieldOptions').mockReturnValueOnce(page.promise);

            const controller = new AbortController();
            const addEventListener = jest.spyOn(controller.signal, 'addEventListener');

            const a = pageAllPropertyFieldOptions(FIELD);
            const b = pageAllPropertyFieldOptions(FIELD);

            // No wrapper promise, so the caller holds the shared walk itself.
            expect(a).toBe(b);
            expect(addEventListener).not.toHaveBeenCalled();

            // Handing the same signal in does produce a wrapper with a listener, so
            // the assertion above is about the signal-less path rather than about a
            // spy no implementation could ever have reached.
            const withSignal = pageAllPropertyFieldOptions(FIELD, {signal: controller.signal});
            expect(withSignal).not.toBe(a);
            expect(addEventListener).toHaveBeenCalledWith('abort', expect.any(Function), {once: true});

            page.resolve(makePage(1, 'p1'));
            await Promise.all([a, b, withSignal]);
        });
    });

    describe('errors and cache cleanup', () => {
        it('propagates a 403 from the first page', async () => {
            const forbidden = new Error('forbidden');
            jest.spyOn(Client4, 'getPropertyFieldOptions').mockRejectedValueOnce(forbidden);

            await expect(pageAllPropertyFieldOptions(FIELD)).rejects.toBe(forbidden);
        });

        it('propagates a 404 from a later page', async () => {
            const notFound = new Error('not found');
            const spy = jest.spyOn(Client4, 'getPropertyFieldOptions').
                mockResolvedValueOnce(makePage(PROPERTY_FIELD_OPTIONS_PER_PAGE, 'p1')).
                mockRejectedValueOnce(notFound);

            const result = await pageAllPropertyFieldOptions(FIELD).then(
                (value) => ({resolved: true, value}),
                (error) => ({resolved: false, value: error}),
            );

            expect(result.resolved).toBe(false);
            expect(result.value).toBe(notFound);
            expect(spy).toHaveBeenCalledTimes(2);
        });

        it('propagates a network error', async () => {
            const networkError = new TypeError('Failed to fetch');
            jest.spyOn(Client4, 'getPropertyFieldOptions').mockRejectedValueOnce(networkError);

            await expect(pageAllPropertyFieldOptions(FIELD)).rejects.toBe(networkError);
        });

        it('rejects both concurrent callers with the same error', async () => {
            const page = deferred<PropertyFieldOption[]>();
            const spy = jest.spyOn(Client4, 'getPropertyFieldOptions').mockReturnValueOnce(page.promise);

            const a = pageAllPropertyFieldOptions(FIELD);
            const b = pageAllPropertyFieldOptions(FIELD);

            const forbidden = new Error('forbidden');
            page.reject(forbidden);

            await expect(a).rejects.toBe(forbidden);
            await expect(b).rejects.toBe(forbidden);
            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('clears the in-flight entry after a failed walk so the next caller retries', async () => {
            const succeeded = makePage(3, 'p2');
            const spy = jest.spyOn(Client4, 'getPropertyFieldOptions').
                mockRejectedValueOnce(new Error('forbidden')).
                mockResolvedValueOnce(succeeded);

            await expect(pageAllPropertyFieldOptions(FIELD)).rejects.toThrow('forbidden');
            await expect(pageAllPropertyFieldOptions(FIELD)).resolves.toEqual(succeeded);

            expect(spy).toHaveBeenCalledTimes(2);
        });

        it('clears the in-flight entry after a successful walk', async () => {
            // Distinct from `a caller arriving after a walk settles starts a fresh
            // walk`, which proves there is no result cache. This proves the map
            // entry itself is gone: a settled entry left behind would let the
            // concurrent pair below join it instead of sharing one new walk.
            const spy = jest.spyOn(Client4, 'getPropertyFieldOptions').
                mockResolvedValueOnce(makePage(3, 'p1')).
                mockResolvedValueOnce(makePage(3, 'p1'));

            await pageAllPropertyFieldOptions(FIELD);
            expect(spy).toHaveBeenCalledTimes(1);

            const [a, b] = await Promise.all([
                pageAllPropertyFieldOptions(FIELD),
                pageAllPropertyFieldOptions(FIELD),
            ]);

            expect(spy).toHaveBeenCalledTimes(2);
            expect(a).toBe(b);
        });

        it('clears the in-flight entry after the cursor hard stop', async () => {
            const badPage = makePage(PROPERTY_FIELD_OPTIONS_PER_PAGE, 'p1');
            delete badPage[badPage.length - 1].create_at;

            const spy = jest.spyOn(Client4, 'getPropertyFieldOptions').
                mockResolvedValueOnce(badPage).
                mockResolvedValueOnce(makePage(PROPERTY_FIELD_OPTIONS_PER_PAGE, 'p2')).
                mockResolvedValueOnce(makePage(4, 'p3'));

            await expect(pageAllPropertyFieldOptions(FIELD)).rejects.toThrow(/has no create_at/);
            await expect(pageAllPropertyFieldOptions(FIELD)).resolves.toHaveLength(204);

            expect(spy).toHaveBeenCalledTimes(3);
        });
    });
});
