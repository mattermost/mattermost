// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyFieldOption} from '@mattermost/types/properties';

import {render, screen, waitFor} from 'tests/react_testing_utils';

import {clearPropertyFieldOptionWalks, pageAllAccessControlFieldOptions} from '../page_all_property_field_options';
import type {GraphFieldRef} from '../page_all_property_field_options';

import {
    clearGraphOptionNameCache,
    commitGraphOptionNames,
    useGraphOptionNames,
} from './use_graph_option_names';
import type {UseGraphOptionNamesResult} from './use_graph_option_names';

jest.mock('../page_all_property_field_options', () => ({
    ...jest.requireActual('../page_all_property_field_options'),
    pageAllAccessControlFieldOptions: jest.fn(),
}));

const mockPageAll = jest.mocked(pageAllAccessControlFieldOptions);

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
});
