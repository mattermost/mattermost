// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField, PropertyFieldOption} from '@mattermost/types/properties';

import type {ResolvedChannelAttribute} from 'mattermost-redux/selectors/entities/properties';

import {clearPropertyFieldOptionWalks, pageAllAccessControlFieldOptions} from 'components/property_fields/graph/page_all_access_control_field_options';
import {clearGraphOptionNameCache, commitGraphOptionNames} from 'components/property_fields/graph/use_graph_option_names';

import {renderHookWithContext, waitFor} from 'tests/react_testing_utils';

import useGraphAttributeNames from './useGraphAttributeNames';

jest.mock('components/property_fields/graph/page_all_access_control_field_options', () => ({
    ...jest.requireActual('components/property_fields/graph/page_all_access_control_field_options'),
    pageAllAccessControlFieldOptions: jest.fn(),
}));

const mockPageAll = jest.mocked(pageAllAccessControlFieldOptions);

const opt = (id: string, name: string): PropertyFieldOption => ({
    id, name, parents: [], create_at: 1,
});

function graphField(id: string, attrs?: PropertyField['attrs']): PropertyField {
    return {
        id,
        group_id: 'group1',
        name: id,
        type: 'graph',
        target_id: '',
        target_type: 'system',
        object_type: 'channel',
        attrs,
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: '',
        updated_by: '',
    };
}

function graphAttribute(fieldId: string, ids: string[] | undefined, attrs?: PropertyField['attrs']): ResolvedChannelAttribute {
    const field = graphField(fieldId, attrs);
    if (!ids) {
        return {field, displayValue: '', displayValues: []};
    }
    return {
        field,
        value: {
            id: `value_${fieldId}`,
            target_id: 'channel1',
            target_type: 'channel',
            group_id: 'group1',
            field_id: fieldId,
            value: ids,
            create_at: 1,
            update_at: 1,
            delete_at: 0,
            created_by: '',
            updated_by: '',
        },
        displayValue: ids.join(', '),
        displayValues: ids,
    };
}

describe('useGraphAttributeNames', () => {
    beforeEach(() => {
        clearPropertyFieldOptionWalks();
        clearGraphOptionNameCache();
        mockPageAll.mockImplementation(() => {
            throw new Error('pageAllAccessControlFieldOptions called without an explicit mock for this test');
        });
    });

    test('a graph attribute renders raw ids first, then the fetched names comma-joined', async () => {
        mockPageAll.mockResolvedValue([opt('a', 'A'), opt('b', 'B')]);

        const {result} = renderHookWithContext(() => useGraphAttributeNames([
            graphAttribute('field1', ['a', 'b'], {options_omitted: true}),
        ]));

        expect(result.current[0].displayValue).toBe('a, b');

        await waitFor(() => expect(result.current[0].displayValue).toBe('A, B'));
        expect(result.current[0].displayValues).toEqual(['A', 'B']);
    });

    test('names already committed for the field are used on first render, without a walk', () => {
        commitGraphOptionNames('field1', {a: 'A', b: 'B'});

        const {result} = renderHookWithContext(() => useGraphAttributeNames([
            graphAttribute('field1', ['a', 'b'], {options_omitted: true}),
        ]));

        expect(result.current[0].displayValue).toBe('A, B');
        expect(mockPageAll).not.toHaveBeenCalled();
    });

    test('a graph attribute with no stored value triggers no walk', () => {
        renderHookWithContext(() => useGraphAttributeNames([
            graphAttribute('field1', undefined, {options_omitted: true}),
        ]));

        expect(mockPageAll).not.toHaveBeenCalled();
    });

    test('a failed walk leaves the raw ids on screen', async () => {
        mockPageAll.mockRejectedValue(new Error('boom'));

        const {result} = renderHookWithContext(() => useGraphAttributeNames([
            graphAttribute('field1', ['a'], {options_omitted: true}),
        ]));

        await waitFor(() => expect(mockPageAll).toHaveBeenCalledTimes(1));
        expect(result.current[0].displayValue).toBe('a');
    });

    test('unresolvedOptionIds holds the ids with no name, whether or not the field resolved', async () => {
        mockPageAll.mockResolvedValue([opt('a', 'A')]);

        const {result} = renderHookWithContext(() => useGraphAttributeNames([
            graphAttribute('field1', ['a', 'ghost'], {options_omitted: true}),
        ]));

        // The walk is still in flight, so neither id counts as named yet.
        expect(result.current[0].unresolvedOptionIds).toEqual(['a', 'ghost']);

        await waitFor(() => expect(result.current[0].displayValue).toBe('A, ghost'));
        expect(result.current[0].unresolvedOptionIds).toEqual(['ghost']);
    });

    test('unresolvedOptionIds is absent once every id is named', () => {
        commitGraphOptionNames('field1', {a: 'A'});

        const {result} = renderHookWithContext(() => useGraphAttributeNames([
            graphAttribute('field1', ['a'], {options_omitted: true}),
        ]));

        expect(result.current[0]).not.toHaveProperty('unresolvedOptionIds');
    });

    test('a list with no graph attribute keeps the identity it was given', () => {
        const attributes: ResolvedChannelAttribute[] = [{
            field: {...graphField('field1'), type: 'text'},
            displayValue: 'hello',
            displayValues: ['hello'],
        }];

        const {result} = renderHookWithContext(() => useGraphAttributeNames(attributes));

        expect(result.current).toBe(attributes);
    });
});
