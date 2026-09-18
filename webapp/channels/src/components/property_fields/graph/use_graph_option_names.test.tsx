// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyFieldOption} from '@mattermost/types/properties';

import {render, screen, waitFor} from 'tests/react_testing_utils';

import {clearPropertyFieldOptionWalks, pageAllAccessControlFieldOptions} from './page_all_access_control_field_options';
import type {GraphFieldRef} from './page_all_access_control_field_options';
import {
    clearGraphOptionNameCache,
    clearGraphOptionNamesForField,
    commitGraphOptionNames,
    ensureGraphOptionNames,
    getGraphOptionNames,
    subscribeGraphOptionNames,
    useGraphOptionNames,
} from './use_graph_option_names';
import type {UseGraphOptionNamesResult} from './use_graph_option_names';

jest.mock('./page_all_access_control_field_options', () => ({
    ...jest.requireActual('./page_all_access_control_field_options'),
    pageAllAccessControlFieldOptions: jest.fn(),
}));

const mockPageAll = jest.mocked(pageAllAccessControlFieldOptions);

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((res) => {
        resolve = res;
    });
    return {promise, resolve};
}

async function flushMicrotasks() {
    await Promise.resolve();
    await Promise.resolve();
}

const opt = (id: string, name: string, parents: string[] = []): PropertyFieldOption => ({
    id, name, parents, create_at: 1,
});

const REGIME_1: PropertyFieldOption[] = [
    opt('a', 'A'),
    opt('b', 'B'),
    opt('opt1', 'Option 1'),
];

const fieldOf = (id: string, overrides: GraphFieldRef['attrs'] = {}): GraphFieldRef => ({
    id,
    object_type: 'user',
    type: 'graph',
    attrs: overrides,
});

type HarnessProps = {
    field: GraphFieldRef;
    ids: readonly string[];
    walk?: boolean;
    onResult?: (result: UseGraphOptionNamesResult) => void;
};

function Harness({field, ids, walk, onResult}: HarnessProps) {
    const result = useGraphOptionNames(field, ids, {walk});
    onResult?.(result);
    return (
        <div
            data-testid='hook-result'
            data-did-resolve={String(result.didResolve)}
            data-names={JSON.stringify(result.names)}
        />
    );
}

describe('useGraphOptionNames', () => {
    beforeEach(() => {
        clearPropertyFieldOptionWalks();
        clearGraphOptionNameCache();
        mockPageAll.mockImplementation(() => {
            throw new Error('pageAllAccessControlFieldOptions called without an explicit mock for this test');
        });
    });

    test('merge-never-replace: a second walk that names fewer ids keeps the first walk\'s names', () => {
        commitGraphOptionNames('merge-field', {a: 'A', b: 'B'});
        commitGraphOptionNames('merge-field', {a: 'A'});

        render(
            <Harness
                field={fieldOf('merge-field')}
                ids={['a', 'b']}
                walk={false}
            />,
        );

        expect(JSON.parse(screen.getByTestId('hook-result').dataset.names || '{}')).toEqual({
            a: 'A',
            b: 'B',
        });
    });

    test('a successful walk that names none of the held ids sets didResolve and labelForId returns id', async () => {
        mockPageAll.mockResolvedValue(REGIME_1);
        let latest: UseGraphOptionNamesResult | undefined;

        render(
            <Harness
                field={fieldOf('ghost-field', {options_omitted: true})}
                ids={['ghost-1']}
                walk={true}
                onResult={(result) => {
                    latest = result;
                }}
            />,
        );

        await waitFor(() => expect(latest?.didResolve).toBe(true));
        expect(latest?.labelForId('ghost-1')).toEqual({kind: 'id', text: 'ghost-1'});
    });

    test('a walk commits every named option, so a later id is not treated as unresolved', async () => {
        mockPageAll.mockResolvedValue(REGIME_1);
        let latest: UseGraphOptionNamesResult | undefined;

        const {rerender} = render(
            <Harness
                field={fieldOf('later-field', {options_omitted: true})}
                ids={['ghost-1']}
                walk={true}
                onResult={(result) => {
                    latest = result;
                }}
            />,
        );

        await waitFor(() => expect(latest?.didResolve).toBe(true));
        expect(latest?.labelForId('ghost-1')).toEqual({kind: 'id', text: 'ghost-1'});

        rerender(
            <Harness
                field={fieldOf('later-field', {options_omitted: true})}
                ids={['opt1']}
                walk={false}
                onResult={(result) => {
                    latest = result;
                }}
            />,
        );

        expect(latest?.labelForId('opt1')).toEqual({kind: 'name', text: 'Option 1'});
        expect(mockPageAll).toHaveBeenCalledTimes(1);
    });

    test('a failed walk leaves didResolve false and labelForId unavailable', async () => {
        mockPageAll.mockRejectedValue(new Error('boom'));
        let latest: UseGraphOptionNamesResult | undefined;

        render(
            <Harness
                field={fieldOf('fail-field', {options_omitted: true})}
                ids={['ghost-1']}
                walk={true}
                onResult={(result) => {
                    latest = result;
                }}
            />,
        );

        await waitFor(() => expect(mockPageAll).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(latest).toBeDefined());
        expect(latest?.didResolve).toBe(false);
        expect(latest?.labelForId('ghost-1')).toEqual({kind: 'unavailable', text: ''});
    });

    test('inline payload names do not set didResolve', () => {
        let latest: UseGraphOptionNamesResult | undefined;

        render(
            <Harness
                field={fieldOf('inline-field', {options: [opt('a', 'Alpha')]})}
                ids={['a']}
                walk={false}
                onResult={(result) => {
                    latest = result;
                }}
            />,
        );

        expect(latest?.didResolve).toBe(false);
        expect(latest?.names.a).toBe('Alpha');
        expect(latest?.labelForId('a')).toEqual({kind: 'name', text: 'Alpha'});
    });

    test('commit {} is a successful resolve', () => {
        commitGraphOptionNames('f', {});
        let latest: UseGraphOptionNamesResult | undefined;

        render(
            <Harness
                field={fieldOf('f')}
                ids={['ghost-1']}
                walk={false}
                onResult={(result) => {
                    latest = result;
                }}
            />,
        );

        expect(latest?.didResolve).toBe(true);
        expect(latest?.labelForId('ghost-1')).toEqual({kind: 'id', text: 'ghost-1'});
    });

    test('ensureGraphOptionNames on an options_omitted field pages once and commits', async () => {
        mockPageAll.mockResolvedValue(REGIME_1);

        ensureGraphOptionNames(fieldOf('ensure-field', {options_omitted: true}), ['a']);

        await waitFor(() => expect(getGraphOptionNames('ensure-field').didResolve).toBe(true));
        expect(getGraphOptionNames('ensure-field').names).toEqual({a: 'A', b: 'B', opt1: 'Option 1'});
        expect(mockPageAll).toHaveBeenCalledTimes(1);
    });

    test('ensureGraphOptionNames does not fetch when the field already resolved', () => {
        commitGraphOptionNames('resolved-field', {a: 'A'});

        ensureGraphOptionNames(fieldOf('resolved-field', {options_omitted: true}), ['a', 'b']);

        expect(mockPageAll).not.toHaveBeenCalled();
    });

    test('a failed walk is not retried when something else writes to the cache', async () => {
        mockPageAll.mockRejectedValue(new Error('403'));

        ensureGraphOptionNames(fieldOf('failing-field', {options_omitted: true}), ['a']);
        await waitFor(() => expect(mockPageAll).toHaveBeenCalledTimes(1));

        // What a picker selection on any other field does.
        commitGraphOptionNames('other-field', {x: 'X'});
        ensureGraphOptionNames(fieldOf('failing-field', {options_omitted: true}), ['a']);

        expect(mockPageAll).toHaveBeenCalledTimes(1);
    });

    test('clearGraphOptionNamesForField lets a failed field walk again', async () => {
        mockPageAll.mockRejectedValue(new Error('403'));

        ensureGraphOptionNames(fieldOf('retry-field', {options_omitted: true}), ['a']);
        await waitFor(() => expect(mockPageAll).toHaveBeenCalledTimes(1));

        clearGraphOptionNamesForField('retry-field');
        mockPageAll.mockResolvedValue(REGIME_1);
        ensureGraphOptionNames(fieldOf('retry-field', {options_omitted: true}), ['a']);

        await waitFor(() => expect(getGraphOptionNames('retry-field').didResolve).toBe(true));
    });

    test('an aborted walk is not a failure, so the next caller still walks', async () => {
        mockPageAll.mockRejectedValueOnce(new DOMException('aborted', 'AbortError'));

        ensureGraphOptionNames(fieldOf('abort-field', {options_omitted: true}), ['a']);
        await waitFor(() => expect(mockPageAll).toHaveBeenCalledTimes(1));

        mockPageAll.mockResolvedValueOnce(REGIME_1);
        ensureGraphOptionNames(fieldOf('abort-field', {options_omitted: true}), ['a']);

        await waitFor(() => expect(getGraphOptionNames('abort-field').didResolve).toBe(true));
    });

    test('ensureGraphOptionNames does not fetch when every id is named inline and options_omitted is unset', () => {
        ensureGraphOptionNames(fieldOf('inline-only-field', {options: [opt('a', 'Alpha')]}), ['a']);

        expect(mockPageAll).not.toHaveBeenCalled();
    });

    test('subscribeGraphOptionNames fires on commit and the remover stops it', () => {
        const listener = jest.fn();
        const unsubscribe = subscribeGraphOptionNames(listener);

        commitGraphOptionNames('sub-field', {a: 'A'});
        expect(listener).toHaveBeenCalledTimes(1);

        unsubscribe();
        commitGraphOptionNames('sub-field', {b: 'B'});
        expect(listener).toHaveBeenCalledTimes(1);
    });

    test('clearGraphOptionNamesForField drops only that field and notifies subscribers', () => {
        commitGraphOptionNames('field-a', {x: 'X'});
        commitGraphOptionNames('field-b', {y: 'Y'});
        const listener = jest.fn();
        subscribeGraphOptionNames(listener);

        clearGraphOptionNamesForField('field-a');

        expect(getGraphOptionNames('field-a')).toEqual({names: {}, didResolve: false});
        expect(getGraphOptionNames('field-b')).toEqual({names: {y: 'Y'}, didResolve: true});
        expect(listener).toHaveBeenCalledTimes(1);
    });

    test('two fields do not share a cache entry', () => {
        commitGraphOptionNames('field-a', {x: 'X'});
        let latest: UseGraphOptionNamesResult | undefined;

        render(
            <Harness
                field={fieldOf('field-b')}
                ids={['x']}
                walk={false}
                onResult={(result) => {
                    latest = result;
                }}
            />,
        );

        expect(latest?.names).toEqual({});
        expect(latest?.didResolve).toBe(false);
    });

    test('a stale walk does not commit after clearGraphOptionNamesForField', async () => {
        const walk = deferred<PropertyFieldOption[]>();
        mockPageAll.mockReturnValue(walk.promise);

        const field = fieldOf('stale-walk-field', {options_omitted: true});
        ensureGraphOptionNames(field, ['a']);

        await waitFor(() => expect(mockPageAll).toHaveBeenCalledTimes(1));

        clearGraphOptionNamesForField(field.id);
        commitGraphOptionNames(field.id, {a: 'NEW'});

        walk.resolve([opt('a', 'OLD'), opt('gone', 'GONE')]);
        await flushMicrotasks();

        const cached = getGraphOptionNames(field.id);
        expect(cached.names).toEqual({a: 'NEW'});
        expect(cached.names).not.toHaveProperty('gone');
        expect(cached.didResolve).toBe(true);
    });

    test('after clear, ensureGraphOptionNames starts a fresh walk', async () => {
        const first = deferred<PropertyFieldOption[]>();
        const second = deferred<PropertyFieldOption[]>();
        mockPageAll.
            mockReturnValueOnce(first.promise).
            mockReturnValueOnce(second.promise);

        const field = fieldOf('fresh-walk-field', {options_omitted: true});
        ensureGraphOptionNames(field, ['a']);

        await waitFor(() => expect(mockPageAll).toHaveBeenCalledTimes(1));

        clearGraphOptionNamesForField(field.id);
        ensureGraphOptionNames(field, ['a']);

        await waitFor(() => expect(mockPageAll).toHaveBeenCalledTimes(2));

        first.resolve([opt('a', 'OLD'), opt('gone', 'GONE')]);
        await flushMicrotasks();

        expect(getGraphOptionNames(field.id)).toEqual({names: {}, didResolve: false});

        second.resolve([opt('a', 'NEW')]);

        await waitFor(() => expect(getGraphOptionNames(field.id).didResolve).toBe(true));
        expect(getGraphOptionNames(field.id).names).toEqual({a: 'NEW'});
        expect(getGraphOptionNames(field.id).names).not.toHaveProperty('gone');
    });
});
