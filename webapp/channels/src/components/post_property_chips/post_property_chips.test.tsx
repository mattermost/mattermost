// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyField, PropertyValue} from '@mattermost/types/properties';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import PostPropertyChips from './post_property_chips';

const render = renderWithContext;

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

    test('renders one chip per text field with a value', () => {
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

        expect(screen.getByText('open')).toBeInTheDocument();
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

        expect(screen.getByText('a-val')).toBeInTheDocument();
        expect(screen.queryByText('b-val')).not.toBeInTheDocument();
        expect(screen.getByText('c-val')).toBeInTheDocument();
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

    test('renders a type icon for each chip', () => {
        const field = makeField({id: 'f1', name: 'Notes', type: 'text'});

        const {container} = render(
            <PostPropertyChips
                postId='post-1'
                fields={[field]}
                valuesByFieldId={{
                    f1: makeValue({field_id: 'f1', value: 'remember the milk'}),
                }}
                loadPostPropertyValues={jest.fn()}
            />,
        );

        // The outer chip Tag carries an icon (rendered as an svg by compass-icons).
        const chip = container.querySelector('[data-property-field-id="f1"]');
        expect(chip).not.toBeNull();
        expect(chip?.querySelector('svg')).toBeInTheDocument();
    });

    test('renders the outer chip as a small Tag carrying the field id', () => {
        const field = makeField({id: 'f1', name: 'Notes', type: 'text'});

        const {container} = render(
            <PostPropertyChips
                postId='post-1'
                fields={[field]}
                valuesByFieldId={{
                    f1: makeValue({field_id: 'f1', value: 'remember the milk'}),
                }}
                loadPostPropertyValues={jest.fn()}
            />,
        );

        const chip = container.querySelector('[data-property-field-id="f1"]') as HTMLElement | null;
        expect(chip).not.toBeNull();
        expect(chip).toHaveClass('Tag', 'Tag--sm');

        // The field-name prefix is preserved alongside the value.
        expect(chip).toHaveTextContent('Notes');
        expect(chip).toHaveTextContent('remember the milk');
    });

    test('renders select values as a colored option Tag inside the chip', () => {
        const field = makeField({
            id: 'f1',
            name: 'Status',
            type: 'select',
            attrs: {
                options: [
                    {id: 'opt1', name: 'Open', color: '#ff00aa'},
                    {id: 'opt2', name: 'Closed', color: '#00aaff'},
                ],
            },
        });

        const {container} = render(
            <PostPropertyChips
                postId='post-1'
                fields={[field]}
                valuesByFieldId={{
                    f1: makeValue({field_id: 'f1', value: 'opt1'}),
                }}
                loadPostPropertyValues={jest.fn()}
            />,
        );

        const chip = container.querySelector('[data-property-field-id="f1"]') as HTMLElement | null;
        expect(chip).not.toBeNull();
        expect(chip).toHaveTextContent('Open');

        // The inner option Tag carries the option color as a background.
        // The outer chip is the first .Tag (no color) — the inner option Tag has the color.
        const innerTags = chip!.querySelectorAll('.Tag--sm');

        // Outer Tag wraps the inner option Tag — so we expect at least 2 Tag wrappers.
        // Find the one with the colored background.
        const colored = Array.from(innerTags).find((el) => (el as HTMLElement).style.backgroundColor) as HTMLElement | undefined;
        expect(colored).toBeDefined();
        expect(colored).toHaveStyle({backgroundColor: '#ff00aa'});
        expect(colored).toHaveTextContent('Open');
    });

    test('renders a single chip with one Tag per selected option for multiselect values', () => {
        const field = makeField({
            id: 'f1',
            name: 'Tags',
            type: 'multiselect',
            attrs: {
                options: [
                    {id: 'opt1', name: 'urgent', color: '#ff0000'},
                    {id: 'opt2', name: 'bug', color: '#00ff00'},
                ],
            },
        });

        const {container} = render(
            <PostPropertyChips
                postId='post-1'
                fields={[field]}
                valuesByFieldId={{
                    f1: makeValue({field_id: 'f1', value: ['opt1', 'opt2']}),
                }}
                loadPostPropertyValues={jest.fn()}
            />,
        );

        const chips = container.querySelectorAll('[data-property-field-id="f1"]');
        expect(chips).toHaveLength(1);
        expect(chips[0]).toHaveTextContent('Tags');

        // Each selected option becomes an inner Tag with its color background.
        const allSmTags = chips[0].querySelectorAll('.Tag--sm');
        const coloredInner = Array.from(allSmTags).filter((el) => (el as HTMLElement).style.backgroundColor) as HTMLElement[];
        expect(coloredInner).toHaveLength(2);
        expect(coloredInner[0]).toHaveTextContent('urgent');
        expect(coloredInner[0]).toHaveStyle({backgroundColor: '#ff0000'});
        expect(coloredInner[1]).toHaveTextContent('bug');
        expect(coloredInner[1]).toHaveStyle({backgroundColor: '#00ff00'});
    });

    test('renders a date value formatted via FormattedDate', () => {
        const field = makeField({id: 'f1', name: 'Due', type: 'date'});
        const {container} = render(
            <PostPropertyChips
                postId='post-1'
                fields={[field]}
                valuesByFieldId={{
                    f1: makeValue({field_id: 'f1', value: '2026-04-28'}),
                }}
                loadPostPropertyValues={jest.fn()}
            />,
        );

        expect(container.querySelector('.property-date')).toBeInTheDocument();
        expect(container).toHaveTextContent(/2026/);
    });
});
