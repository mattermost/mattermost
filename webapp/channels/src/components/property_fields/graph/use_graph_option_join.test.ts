// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyFieldOption} from '@mattermost/types/properties';

import {act, renderHookWithContext, waitFor} from 'tests/react_testing_utils';

import {clearPropertyFieldOptionWalks, pageAllAccessControlFieldOptions} from './page_all_access_control_field_options';
import type {GraphFieldRef} from './page_all_access_control_field_options';

import {useGraphOptionJoin} from './use_graph_option_join';
import type {UseGraphOptionJoinOpts} from './use_graph_option_join';

jest.mock('./page_all_access_control_field_options', () => ({
    ...jest.requireActual('./page_all_access_control_field_options'),
    pageAllAccessControlFieldOptions: jest.fn(),
}));

const mockPageAll = jest.mocked(pageAllAccessControlFieldOptions);

const opt = (id: string, name: string, parents: string[] = []): PropertyFieldOption => ({
    id, name, parents, create_at: 1,
});

const hierarchy = () => [
    opt('opt-air', 'Air Program'),
    opt('opt-jet', 'Fighter Jet', ['Air Program']),
    opt('opt-f18', 'F-18 Program', ['Fighter Jet']),
    opt('opt-rotary', 'Rotary', ['Air Program']),
];

const deferred = <T, >() => {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return {promise, resolve, reject};
};

const abortErrorOf = () => new DOMException('aborted', 'AbortError');

const httpErrorOf = (status: number) => Object.assign(new Error(`request failed with ${status}`), {status_code: status});

const fieldOf = (overrides: Partial<GraphFieldRef> = {}): GraphFieldRef => ({
    id: 'field-1',
    object_type: 'user',
    type: 'graph',
    attrs: {},
    ...overrides,
});

const lastSignal = () => {
    const call = mockPageAll.mock.calls[mockPageAll.mock.calls.length - 1];
    return call[1]!.signal!;
};
const signalOfCall = (index: number) => mockPageAll.mock.calls[index][1]!.signal!;

const settle = async () => {
    await act(async () => {
        await Promise.resolve();
    });
};

const renderJoin = (field: GraphFieldRef, opts?: UseGraphOptionJoinOpts) => {
    const current = {field, opts};
    const rendered = renderHookWithContext(() => useGraphOptionJoin(current.field, current.opts));
    return {
        ...rendered,
        rerenderJoin: (nextField: GraphFieldRef, nextOpts?: UseGraphOptionJoinOpts) => {
            current.field = nextField;
            current.opts = nextOpts;
            rendered.rerender();
        },
    };
};

describe('useGraphOptionJoin', () => {
    beforeEach(() => {
        clearPropertyFieldOptionWalks();
        mockPageAll.mockResolvedValue([]);
    });

    describe('fetch lifecycle', () => {
        test('fetches when open becomes true', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            const field = fieldOf();
            const {rerenderJoin} = renderJoin(field, {open: false, prefetch: false});

            expect(mockPageAll).not.toHaveBeenCalled();

            rerenderJoin(field, {open: true});
            await settle();

            expect(mockPageAll).toHaveBeenCalledTimes(1);
            expect(mockPageAll).toHaveBeenCalledWith(
                {id: 'field-1', object_type: 'user'},
                {signal: expect.any(AbortSignal)},
            );
        });

        test('never sends linked_field_id or a group id', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            const field = {
                id: 'field-1',
                object_type: 'user',
                linked_field_id: 'template-1',
                attrs: {},
            } as GraphFieldRef;
            renderJoin(field, {open: true});
            await settle();

            expect(mockPageAll.mock.calls[0][0]).toEqual({id: 'field-1', object_type: 'user'});
            expect(Object.keys(mockPageAll.mock.calls[0][0])).toEqual(['id', 'object_type']);
        });

        test('does not fetch before the menu is opened', () => {
            renderJoin(fieldOf(), {open: false, prefetch: false});

            expect(mockPageAll).not.toHaveBeenCalled();
        });

        test('refetches on every reopen', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            const field = fieldOf();
            const {rerenderJoin} = renderJoin(field, {open: true});
            await settle();

            rerenderJoin(field, {open: false});
            await settle();
            rerenderJoin(field, {open: true});
            await settle();

            expect(mockPageAll).toHaveBeenCalledTimes(2);
        });

        test('refetches on reopen even when options_omitted', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            const field = fieldOf({attrs: {options_omitted: true, options: []}});
            const {rerenderJoin} = renderJoin(field, {open: true});
            await settle();

            rerenderJoin(field, {open: false});
            await settle();
            rerenderJoin(field, {open: true});
            await settle();

            expect(mockPageAll).toHaveBeenCalledTimes(2);
        });

        test('refetches on reopen even when the field payload inlined its options', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            const field = fieldOf({attrs: {options: hierarchy()}});
            const {rerenderJoin} = renderJoin(field, {open: true});
            await settle();

            rerenderJoin(field, {open: false});
            await settle();
            rerenderJoin(field, {open: true});
            await settle();

            expect(mockPageAll).toHaveBeenCalledTimes(2);
        });

        test('fetches on mount when prefetch is true', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            renderJoin(fieldOf(), {prefetch: true});
            await settle();

            expect(mockPageAll).toHaveBeenCalledTimes(1);
        });

        test('does not fetch on mount when prefetch is false', async () => {
            renderJoin(fieldOf(), {prefetch: false});
            await settle();

            expect(mockPageAll).not.toHaveBeenCalled();
        });

        test('prefetches only once per mount', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            const field = fieldOf();
            const {rerenderJoin} = renderJoin(field, {prefetch: true});
            await settle();

            rerenderJoin(field, {prefetch: true});
            await settle();

            expect(mockPageAll).toHaveBeenCalledTimes(1);
        });

        test('aborts the in-flight walk when the menu closes', async () => {
            const walk = deferred<PropertyFieldOption[]>();
            mockPageAll.mockReturnValue(walk.promise);
            const field = fieldOf();
            const {rerenderJoin} = renderJoin(field, {open: true});
            await settle();

            const signal = lastSignal();
            rerenderJoin(field, {open: false});

            await waitFor(() => expect(signal.aborted).toBe(true));
        });

        test('aborts the in-flight walk on unmount', async () => {
            const walk = deferred<PropertyFieldOption[]>();
            mockPageAll.mockReturnValue(walk.promise);
            const {unmount} = renderJoin(fieldOf(), {open: true});
            await settle();

            const signal = lastSignal();
            unmount();

            expect(signal.aborted).toBe(true);
        });

        test('aborts a prefetch that is still running when the component unmounts', async () => {
            const walk = deferred<PropertyFieldOption[]>();
            mockPageAll.mockReturnValue(walk.promise);
            const {unmount} = renderJoin(fieldOf(), {prefetch: true});
            await settle();

            const signal = lastSignal();
            unmount();

            expect(signal.aborted).toBe(true);
        });

        test('aborts the previous walk when the menu is reopened while one is in flight', async () => {
            const first = deferred<PropertyFieldOption[]>();
            mockPageAll.mockReturnValue(first.promise);
            const field = fieldOf();
            const {rerenderJoin} = renderJoin(field, {open: true});
            await settle();

            const second = deferred<PropertyFieldOption[]>();
            mockPageAll.mockReturnValue(second.promise);
            rerenderJoin(field, {open: false});
            rerenderJoin(field, {open: true});
            await settle();

            expect(mockPageAll).toHaveBeenCalledTimes(2);
            expect(signalOfCall(0).aborted).toBe(true);
            expect(signalOfCall(1).aborted).toBe(false);
        });

        test('a prefetch survives the mount-time onToggle(false)', async () => {
            const walk = deferred<PropertyFieldOption[]>();
            mockPageAll.mockReturnValue(walk.promise);
            const field = fieldOf();
            const {rerenderJoin} = renderJoin(field, {prefetch: true, open: false});
            await settle();

            expect(lastSignal().aborted).toBe(false);

            rerenderJoin(field, {prefetch: true, open: false});
            await settle();

            expect(lastSignal().aborted).toBe(false);
        });

        test('an AbortError rejection is not rendered as an error', async () => {
            mockPageAll.mockRejectedValue(abortErrorOf());
            const {result} = renderJoin(fieldOf(), {open: true});
            await settle();

            expect(result.current.status).not.toBe('error');
        });

        test('an AbortError rejection leaves previously loaded options intact', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            const field = fieldOf();
            const {result, rerenderJoin} = renderJoin(field, {open: true});
            await waitFor(() => expect(result.current.status).toBe('loaded'));
            expect(result.current.join.byId.has('opt-air')).toBe(true);

            mockPageAll.mockRejectedValue(abortErrorOf());
            rerenderJoin(field, {open: false});
            await settle();
            rerenderJoin(field, {open: true});
            await settle();

            expect(result.current.join.byId.has('opt-air')).toBe(true);
            expect(result.current.status).not.toBe('error');
        });

        test('Retry re-runs the walk after a rejected first walk', async () => {
            mockPageAll.mockRejectedValueOnce(httpErrorOf(500));
            mockPageAll.mockResolvedValue(hierarchy());
            const {result} = renderJoin(fieldOf(), {open: true});
            await waitFor(() => expect(result.current.status).toBe('error'));

            act(() => {
                result.current.refetch();
            });

            await waitFor(() => expect(result.current.status).toBe('loaded'));
            expect(result.current.join.byId.has('opt-air')).toBe(true);
            expect(mockPageAll).toHaveBeenCalledTimes(2);
        });

        test('reopening after an error refetches instead of showing stale error copy', async () => {
            mockPageAll.mockRejectedValueOnce(httpErrorOf(500));
            mockPageAll.mockResolvedValue(hierarchy());
            const field = fieldOf();
            const {result, rerenderJoin} = renderJoin(field, {open: true});
            await waitFor(() => expect(result.current.status).toBe('error'));

            rerenderJoin(field, {open: false});
            await settle();
            rerenderJoin(field, {open: true});

            await waitFor(() => expect(result.current.status).toBe('loaded'));
            expect(mockPageAll).toHaveBeenCalledTimes(2);
        });

        test('prefetch as a dep does not walk a second time when refetch identity changes', async () => {
            mockPageAll.mockResolvedValue(hierarchy());
            const field = fieldOf();
            const {rerenderJoin} = renderJoin(field, {prefetch: true, onOptionsLoaded: jest.fn()});
            await settle();

            rerenderJoin(field, {prefetch: true, onOptionsLoaded: jest.fn()});
            await settle();

            expect(mockPageAll).toHaveBeenCalledTimes(1);
        });
    });
});
