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

const FIELD = {id: 'field-1', object_type: 'user'};

describe('pageAllPropertyFieldOptions', () => {
    beforeEach(() => {
        jest.restoreAllMocks();
        clearPropertyFieldOptionWalks();
    });

    describe('paging', () => {
        it('returns every option of a single short page', async () => {
            const page = makePage(3, 'p1');
            const spy = jest.spyOn(Client4, 'getPropertyFieldOptions').mockResolvedValue(page);

            const result = await pageAllPropertyFieldOptions(FIELD);

            expect(result).toEqual(page);
            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('stops after a page shorter than the page size', async () => {
            const spy = jest.spyOn(Client4, 'getPropertyFieldOptions').
                mockResolvedValueOnce(makePage(PROPERTY_FIELD_OPTIONS_PER_PAGE, 'p1')).
                mockResolvedValueOnce(makePage(5, 'p2'));

            const result = await pageAllPropertyFieldOptions(FIELD);

            expect(result).toHaveLength(205);
            expect(spy).toHaveBeenCalledTimes(2);
        });

        it('pages once more when the first page is exactly the page size and the second is empty', async () => {
            const spy = jest.spyOn(Client4, 'getPropertyFieldOptions').
                mockResolvedValueOnce(makePage(PROPERTY_FIELD_OPTIONS_PER_PAGE, 'p1')).
                mockResolvedValueOnce([]);

            const result = await pageAllPropertyFieldOptions(FIELD);

            expect(result).toHaveLength(PROPERTY_FIELD_OPTIONS_PER_PAGE);
            expect(spy).toHaveBeenCalledTimes(2);
        });

        it('concatenates three pages in server order', async () => {
            jest.spyOn(Client4, 'getPropertyFieldOptions').
                mockResolvedValueOnce(makePage(PROPERTY_FIELD_OPTIONS_PER_PAGE, 'p1')).
                mockResolvedValueOnce(makePage(PROPERTY_FIELD_OPTIONS_PER_PAGE, 'p2')).
                mockResolvedValueOnce(makePage(7, 'p3'));

            const result = await pageAllPropertyFieldOptions(FIELD);

            expect(result).toHaveLength(407);
            expect(result[0].id).toBe('p1-0');
            expect(result[406].id).toBe('p3-6');
        });

        it('resolves an empty array on an empty first page', async () => {
            const spy = jest.spyOn(Client4, 'getPropertyFieldOptions').mockResolvedValue([]);

            const result = await pageAllPropertyFieldOptions(FIELD);

            expect(result).toEqual([]);
            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('sends no cursor on the first request', async () => {
            const spy = jest.spyOn(Client4, 'getPropertyFieldOptions').mockResolvedValue(makePage(3, 'p1'));

            await pageAllPropertyFieldOptions(FIELD);

            expect(spy.mock.calls[0][3]).toStrictEqual({
                perPage: PROPERTY_FIELD_OPTIONS_PER_PAGE,
                cursorId: undefined,
                cursorCreateAt: undefined,
            });
        });

        it('sends both cursor halves taken from the last option of the previous page', async () => {
            const firstPage = makePage(PROPERTY_FIELD_OPTIONS_PER_PAGE, 'p1');
            const last = firstPage[firstPage.length - 1];
            const spy = jest.spyOn(Client4, 'getPropertyFieldOptions').
                mockResolvedValueOnce(firstPage).
                mockResolvedValueOnce(makePage(2, 'p2'));

            await pageAllPropertyFieldOptions(FIELD);

            expect(spy.mock.calls[1][3]).toStrictEqual({
                perPage: PROPERTY_FIELD_OPTIONS_PER_PAGE,
                cursorId: last.id,
                cursorCreateAt: last.create_at,
            });
        });

        it('always sends per_page 200', async () => {
            const spy = jest.spyOn(Client4, 'getPropertyFieldOptions').
                mockResolvedValueOnce(makePage(PROPERTY_FIELD_OPTIONS_PER_PAGE, 'p1')).
                mockResolvedValueOnce(makePage(PROPERTY_FIELD_OPTIONS_PER_PAGE, 'p2')).
                mockResolvedValueOnce(makePage(1, 'p3'));

            await pageAllPropertyFieldOptions(FIELD);

            expect(spy).toHaveBeenCalledTimes(3);
            for (const call of spy.mock.calls) {
                expect(call[3]).toMatchObject({perPage: PROPERTY_FIELD_OPTIONS_PER_PAGE});
            }
        });

        it('uses the access_control group and the field object_type', async () => {
            const spy = jest.spyOn(Client4, 'getPropertyFieldOptions').
                mockResolvedValueOnce(makePage(PROPERTY_FIELD_OPTIONS_PER_PAGE, 'p1')).
                mockResolvedValueOnce(makePage(1, 'p2'));

            // Not an inline literal: `linked_field_id` only pairs a field with the
            // template it copied and must never reach the GET.
            const fieldWithLink = {id: 'field-1', object_type: 'user', linked_field_id: 'other-field'};

            await pageAllPropertyFieldOptions(fieldWithLink);

            expect(spy).toHaveBeenCalledTimes(2);
            for (const call of spy.mock.calls) {
                expect(call.slice(0, 3)).toEqual([ACCESS_CONTROL_GROUP, 'user', 'field-1']);
            }
            expect(JSON.stringify(spy.mock.calls)).not.toContain('other-field');
        });
    });

    describe('cursor hard stop', () => {
        it('throws when the last option of a full page has no create_at', async () => {
            const page = makePage(PROPERTY_FIELD_OPTIONS_PER_PAGE, 'p1');
            delete page[page.length - 1].create_at;
            const spy = jest.spyOn(Client4, 'getPropertyFieldOptions').mockResolvedValue(page);

            await expect(pageAllPropertyFieldOptions(FIELD)).rejects.toThrow(/has no create_at/);
            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('throws when the last option of a full page has create_at 0', async () => {
            const page = makePage(PROPERTY_FIELD_OPTIONS_PER_PAGE, 'p1');
            page[page.length - 1].create_at = 0;
            const spy = jest.spyOn(Client4, 'getPropertyFieldOptions').mockResolvedValue(page);

            await expect(pageAllPropertyFieldOptions(FIELD)).rejects.toThrow(/has no create_at/);
            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('throws when the last option of a full page has no id', async () => {
            const page = makePage(PROPERTY_FIELD_OPTIONS_PER_PAGE, 'p1');
            page[page.length - 1].id = '';
            const spy = jest.spyOn(Client4, 'getPropertyFieldOptions').mockResolvedValue(page);

            await expect(pageAllPropertyFieldOptions(FIELD)).rejects.toThrow(/\(no id\)/);
            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('does not throw when a short page\'s last option has no create_at', async () => {
            const page = makePage(5, 'p1');
            delete page[page.length - 1].create_at;
            const spy = jest.spyOn(Client4, 'getPropertyFieldOptions').mockResolvedValue(page);

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
            const spy = jest.spyOn(Client4, 'getPropertyFieldOptions').mockReturnValue(page.promise);

            const a = pageAllPropertyFieldOptions(FIELD);
            const b = pageAllPropertyFieldOptions(FIELD);

            page.resolve(makePage(3, 'p1'));

            const [resultA, resultB] = await Promise.all([a, b]);

            expect(resultA).toEqual(resultB);
            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('two concurrent callers for the same field id receive the same array', async () => {
            const page = deferred<PropertyFieldOption[]>();
            jest.spyOn(Client4, 'getPropertyFieldOptions').mockReturnValue(page.promise);

            const a = pageAllPropertyFieldOptions(FIELD);
            const b = pageAllPropertyFieldOptions(FIELD);

            page.resolve(makePage(3, 'p1'));

            const [resultA, resultB] = await Promise.all([a, b]);

            expect(resultA).toBe(resultB);
        });

        it('concurrent callers for different field ids each get their own walk', async () => {
            const spy = jest.spyOn(Client4, 'getPropertyFieldOptions').mockResolvedValue(makePage(3, 'p1'));

            await Promise.all([
                pageAllPropertyFieldOptions({id: 'field-1', object_type: 'user'}),
                pageAllPropertyFieldOptions({id: 'field-2', object_type: 'user'}),
            ]);

            expect(spy).toHaveBeenCalledTimes(2);
            expect(spy.mock.calls.map((call) => call[2]).sort()).toEqual(['field-1', 'field-2']);
        });

        it('a caller arriving after a walk settles starts a fresh walk', async () => {
            const spy = jest.spyOn(Client4, 'getPropertyFieldOptions').mockResolvedValue(makePage(3, 'p1'));

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
            jest.spyOn(Client4, 'getPropertyFieldOptions').mockReturnValue(page.promise);

            const unhandled = captureUnhandledRejections();
            const controller = new AbortController();
            const promise = pageAllPropertyFieldOptions(FIELD, {signal: controller.signal});

            controller.abort();

            await expect(promise).rejects.toMatchObject({name: 'AbortError'});

            page.resolve(makePage(3, 'p1'));
            await macrotask();

            expect(unhandled.seen).toEqual([]);
            unhandled.stop();
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
            jest.spyOn(Client4, 'getPropertyFieldOptions').mockReturnValue(page.promise);

            const unhandled = captureUnhandledRejections();
            const controller = new AbortController();
            controller.abort();

            const promise = pageAllPropertyFieldOptions(FIELD, {signal: controller.signal});

            await expect(promise).rejects.toMatchObject({name: 'AbortError'});

            page.reject(new Error('too late'));
            await macrotask();

            expect(unhandled.seen).toEqual([]);
            unhandled.stop();
        });

        it('aborting one caller leaves the other caller\'s promise pending', async () => {
            const page = deferred<PropertyFieldOption[]>();
            jest.spyOn(Client4, 'getPropertyFieldOptions').mockReturnValue(page.promise);

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
            const spy = jest.spyOn(Client4, 'getPropertyFieldOptions').mockReturnValue(page.promise);

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
            jest.spyOn(Client4, 'getPropertyFieldOptions').mockReturnValue(page.promise);

            const unhandled = captureUnhandledRejections();
            const controller = new AbortController();
            const promise = pageAllPropertyFieldOptions(FIELD, {signal: controller.signal});

            controller.abort();

            const clientError = new Error('forbidden');
            clientError.name = 'ClientError';
            page.reject(clientError);

            await expect(promise).rejects.toMatchObject({name: 'AbortError'});
            await expect(promise).rejects.not.toBe(clientError);

            await macrotask();

            expect(unhandled.seen).toEqual([]);
            unhandled.stop();
        });

        it('does not attach an abort listener when no signal is given', async () => {
            const page = deferred<PropertyFieldOption[]>();
            jest.spyOn(Client4, 'getPropertyFieldOptions').mockReturnValue(page.promise);

            const controller = new AbortController();
            const addEventListener = jest.spyOn(controller.signal, 'addEventListener');

            const a = pageAllPropertyFieldOptions(FIELD);
            const b = pageAllPropertyFieldOptions(FIELD);

            // No wrapper promise, so the caller holds the shared walk itself.
            expect(a).toBe(b);
            expect(addEventListener).not.toHaveBeenCalled();

            page.resolve(makePage(1, 'p1'));
            await Promise.all([a, b]);
        });
    });

    describe('errors and cache cleanup', () => {
        it('propagates a 403 from the first page', async () => {
            const forbidden = new Error('forbidden');
            jest.spyOn(Client4, 'getPropertyFieldOptions').mockRejectedValue(forbidden);

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
            jest.spyOn(Client4, 'getPropertyFieldOptions').mockRejectedValue(networkError);

            await expect(pageAllPropertyFieldOptions(FIELD)).rejects.toBe(networkError);
        });

        it('rejects both concurrent callers with the same error', async () => {
            const page = deferred<PropertyFieldOption[]>();
            const spy = jest.spyOn(Client4, 'getPropertyFieldOptions').mockReturnValue(page.promise);

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
            const spy = jest.spyOn(Client4, 'getPropertyFieldOptions').mockResolvedValue(makePage(3, 'p1'));

            await pageAllPropertyFieldOptions(FIELD);
            await pageAllPropertyFieldOptions(FIELD);

            expect(spy).toHaveBeenCalledTimes(2);
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
