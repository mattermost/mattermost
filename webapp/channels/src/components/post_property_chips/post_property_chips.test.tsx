// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyField, PropertyValue} from '@mattermost/types/properties';

import {render, screen} from 'tests/react_testing_utils';

import PostPropertyChips from './post_property_chips';

function makeField(overrides: Partial<PropertyField> = {}): PropertyField {
    return {
        id: 'f1',
        group_id: 'g1',
        name: 'Status',
        type: 'text',
        target_id: 'channel-1',
        target_type: 'channel',
        object_type: 'post',
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: 'u1',
        updated_by: 'u1',
        ...overrides,
    };
}

function makeValue(overrides: Partial<PropertyValue<unknown>> = {}): PropertyValue<unknown> {
    return {
        id: 'v1',
        target_id: 'post-1',
        target_type: 'post',
        group_id: 'g1',
        field_id: 'f1',
        value: 'open',
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: 'u1',
        updated_by: 'u1',
        ...overrides,
    };
}

describe('components/post_property_chips/PostPropertyChips', () => {
    test('renders nothing when no fields are configured', () => {
        const {container} = render(
            <PostPropertyChips
                postId='post-1'
                fields={[]}
                valuesByFieldId={{}}
                loadPostPropertyValues={jest.fn()}
            />,
        );
        expect(container).toBeEmptyDOMElement();
    });

    test('renders nothing when fields exist but no values are set', () => {
        const {container} = render(
            <PostPropertyChips
                postId='post-1'
                fields={[makeField()]}
                valuesByFieldId={{}}
                loadPostPropertyValues={jest.fn()}
            />,
        );
        expect(container).toBeEmptyDOMElement();
    });

    test('renders one chip per field with a value, displaying name and value', () => {
        const status = makeField({id: 'f1', name: 'Status'});
        const priority = makeField({id: 'f2', name: 'Priority'});

        render(
            <PostPropertyChips
                postId='post-1'
                fields={[status, priority]}
                valuesByFieldId={{
                    f1: makeValue({field_id: 'f1', value: 'open'}),
                    f2: makeValue({field_id: 'f2', value: 'high', id: 'v2'}),
                }}
                loadPostPropertyValues={jest.fn()}
            />,
        );

        expect(screen.getByText('Status')).toBeInTheDocument();
        expect(screen.getByText('open')).toBeInTheDocument();
        expect(screen.getByText('Priority')).toBeInTheDocument();
        expect(screen.getByText('high')).toBeInTheDocument();
    });

    test('skips fields that have no value, preserving order for those that do', () => {
        const a = makeField({id: 'fa', name: 'A'});
        const b = makeField({id: 'fb', name: 'B'});
        const c = makeField({id: 'fc', name: 'C'});

        render(
            <PostPropertyChips
                postId='post-1'
                fields={[a, b, c]}
                valuesByFieldId={{
                    fa: makeValue({field_id: 'fa', value: 'a-val'}),
                    fc: makeValue({field_id: 'fc', value: 'c-val'}),
                }}
                loadPostPropertyValues={jest.fn()}
            />,
        );

        expect(screen.queryByText('B')).not.toBeInTheDocument();
        expect(screen.getByText('A')).toBeInTheDocument();
        expect(screen.getByText('C')).toBeInTheDocument();
    });

    test('skips fields whose value is an empty string', () => {
        const field = makeField({id: 'f1', name: 'Status'});

        const {container} = render(
            <PostPropertyChips
                postId='post-1'
                fields={[field]}
                valuesByFieldId={{
                    f1: makeValue({field_id: 'f1', value: ''}),
                }}
                loadPostPropertyValues={jest.fn()}
            />,
        );

        expect(container).toBeEmptyDOMElement();
    });

    test('dispatches loadPostPropertyValues once on mount', () => {
        const load = jest.fn();
        const {rerender} = render(
            <PostPropertyChips
                postId='post-1'
                fields={[makeField()]}
                valuesByFieldId={{}}
                loadPostPropertyValues={load}
            />,
        );

        expect(load).toHaveBeenCalledTimes(1);
        expect(load).toHaveBeenCalledWith('post-1');

        rerender(
            <PostPropertyChips
                postId='post-1'
                fields={[makeField()]}
                valuesByFieldId={{f1: makeValue()}}
                loadPostPropertyValues={load}
            />,
        );

        expect(load).toHaveBeenCalledTimes(1);
    });

    test('re-dispatches when postId changes', () => {
        const load = jest.fn();
        const {rerender} = render(
            <PostPropertyChips
                postId='post-1'
                fields={[]}
                valuesByFieldId={{}}
                loadPostPropertyValues={load}
            />,
        );

        rerender(
            <PostPropertyChips
                postId='post-2'
                fields={[]}
                valuesByFieldId={{}}
                loadPostPropertyValues={load}
            />,
        );

        expect(load).toHaveBeenCalledTimes(2);
        expect(load).toHaveBeenLastCalledWith('post-2');
    });

    test('renders array values joined by comma (multiselect)', () => {
        const field = makeField({id: 'f1', name: 'Tags', type: 'multiselect'});
        render(
            <PostPropertyChips
                postId='post-1'
                fields={[field]}
                valuesByFieldId={{
                    f1: makeValue({field_id: 'f1', value: ['urgent', 'bug']}),
                }}
                loadPostPropertyValues={jest.fn()}
            />,
        );

        expect(screen.getByText('urgent, bug')).toBeInTheDocument();
    });
});
