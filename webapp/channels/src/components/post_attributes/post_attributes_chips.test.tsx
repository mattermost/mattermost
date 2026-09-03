// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {Post} from '@mattermost/types/posts';
import type {PropertyField, PropertyValue} from '@mattermost/types/properties';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import PostAttributesChips from './post_attributes_chips';

const GROUP_ID = 'group_id';
const CHANNEL_ID = 'channel_id';
const TEAM_ID = 'team_id';
const POST_ID = 'post_id';

const OPTIONS = [
    {id: 'opt_secret', name: 'SECRET', color: 'red'},
    {id: 'opt_unclassified', name: 'UNCLASSIFIED', color: 'green'},
];

function makeField(overrides: Partial<PropertyField> = {}): PropertyField {
    return {
        id: 'field_1',
        group_id: GROUP_ID,
        name: 'classification',
        type: 'select',
        object_type: 'post',
        target_type: 'channel',
        target_id: CHANNEL_ID,
        attrs: {options: OPTIONS},
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: 'user_1',
        updated_by: 'user_1',
        ...overrides,
    };
}

function makeValue(overrides: Partial<PropertyValue<unknown>> = {}): PropertyValue<unknown> {
    return {
        id: 'value_1',
        target_id: POST_ID,
        target_type: 'post',
        group_id: GROUP_ID,
        field_id: 'field_1',
        value: 'opt_secret',
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: 'user_1',
        updated_by: 'user_1',
        ...overrides,
    };
}

function makeState(fields: PropertyField[], values: Array<PropertyValue<unknown>>) {
    const byId: Record<string, PropertyField> = {};
    fields.forEach((f) => {
        byId[f.id] = f;
    });

    const byTargetId: Record<string, Record<string, PropertyValue<unknown>>> = {};
    values.forEach((v) => {
        byTargetId[v.target_id] = {...byTargetId[v.target_id], [v.field_id]: v};
    });

    return {
        entities: {
            channels: {
                channels: {
                    [CHANNEL_ID]: {id: CHANNEL_ID, team_id: TEAM_ID},
                },
            },
            properties: {
                fields: {byId, byObjectType: {post: {[GROUP_ID]: byId}}},
                values: {byTargetId, byFieldId: {}},
                groups: {byId: {[GROUP_ID]: {id: GROUP_ID, name: 'post_attributes'}}, byName: {post_attributes: {id: GROUP_ID, name: 'post_attributes'}}},
            },
        },
    };
}

const post = {id: POST_ID} as Post;
const channel = {id: CHANNEL_ID, team_id: TEAM_ID} as Channel;

describe('PostAttributesChips', () => {
    test('renders a chip for a set value, labelled by the option name', () => {
        renderWithContext(
            <PostAttributesChips
                post={post}
                channel={channel}
            />,
            makeState([makeField()], [makeValue()]),
        );

        expect(screen.getByTestId('post-attributes-chips')).toBeInTheDocument();

        // The stored value is the option id; the chip must show the option's name.
        expect(screen.getByText('SECRET')).toBeInTheDocument();
        expect(screen.queryByText('opt_secret')).not.toBeInTheDocument();
    });

    test('renders nothing when the channel has no applicable fields', () => {
        renderWithContext(
            <PostAttributesChips
                post={post}
                channel={channel}
            />,
            makeState([], [makeValue()]),
        );

        expect(screen.queryByTestId('post-attributes-chips')).not.toBeInTheDocument();
    });

    test('renders nothing when the post has no values', () => {
        renderWithContext(
            <PostAttributesChips
                post={post}
                channel={channel}
            />,
            makeState([makeField()], []),
        );

        expect(screen.queryByTestId('post-attributes-chips')).not.toBeInTheDocument();
    });

    test('renders nothing without a channel, so no scope chain resolves', () => {
        renderWithContext(
            <PostAttributesChips post={post}/>,
            makeState([makeField()], [makeValue()]),
        );

        expect(screen.queryByTestId('post-attributes-chips')).not.toBeInTheDocument();
    });

    test('ignores a channel-scoped field belonging to another channel', () => {
        renderWithContext(
            <PostAttributesChips
                post={post}
                channel={channel}
            />,
            makeState([makeField({target_id: 'other_channel'})], [makeValue()]),
        );

        expect(screen.queryByTestId('post-attributes-chips')).not.toBeInTheDocument();
    });

    test('renders a system-scoped field on any channel', () => {
        renderWithContext(
            <PostAttributesChips
                post={post}
                channel={channel}
            />,
            makeState([makeField({target_type: 'system', target_id: ''})], [makeValue()]),
        );

        expect(screen.getByText('SECRET')).toBeInTheDocument();
    });

    // teamId is derived from the channel inside the selector rather than passed in, so
    // these two cover the derivation, not just the filter.
    test('renders a team-scoped field when it targets the channel\'s team', () => {
        renderWithContext(
            <PostAttributesChips
                post={post}
                channel={channel}
            />,
            makeState([makeField({target_type: 'team', target_id: TEAM_ID})], [makeValue()]),
        );

        expect(screen.getByText('SECRET')).toBeInTheDocument();
    });

    test('ignores a team-scoped field belonging to another team', () => {
        renderWithContext(
            <PostAttributesChips
                post={post}
                channel={channel}
            />,
            makeState([makeField({target_type: 'team', target_id: 'other_team'})], [makeValue()]),
        );

        expect(screen.queryByTestId('post-attributes-chips')).not.toBeInTheDocument();
    });

    test('skips a hidden field even when it is set', () => {
        const field = makeField();
        field.attrs = {...field.attrs, visibility: 'hidden'};

        renderWithContext(
            <PostAttributesChips
                post={post}
                channel={channel}
            />,
            makeState([field], [makeValue()]),
        );

        expect(screen.queryByTestId('post-attributes-chips')).not.toBeInTheDocument();
    });

    test('treats an empty string as unset', () => {
        renderWithContext(
            <PostAttributesChips
                post={post}
                channel={channel}
            />,
            makeState([makeField()], [makeValue({value: ''})]),
        );

        expect(screen.queryByTestId('post-attributes-chips')).not.toBeInTheDocument();
    });

    test.each([
        ['zero', 0],
        ['false', false],
    ])('treats %s as set and gives it a chip', (_label, raw) => {
        renderWithContext(
            <PostAttributesChips
                post={post}
                channel={channel}
            />,
            makeState([makeField({type: 'text', attrs: {}})], [makeValue({value: raw})]),
        );

        expect(screen.getByTestId('post-attributes-chips')).toBeInTheDocument();
        expect(screen.getByTestId('text-property')).toBeInTheDocument();
    });

    test('treats an empty array as unset', () => {
        renderWithContext(
            <PostAttributesChips
                post={post}
                channel={channel}
            />,
            makeState([makeField()], [makeValue({value: []})]),
        );

        expect(screen.queryByTestId('post-attributes-chips')).not.toBeInTheDocument();
    });

    test.each([
        ['null', null],
        ['undefined', undefined],
    ])('treats %s as unset', (_label, raw) => {
        renderWithContext(
            <PostAttributesChips
                post={post}
                channel={channel}
            />,
            makeState([makeField()], [makeValue({value: raw})]),
        );

        expect(screen.queryByTestId('post-attributes-chips')).not.toBeInTheDocument();
    });

    test('renders nothing for an always field with no value', () => {
        const field = makeField();
        field.attrs = {...field.attrs, visibility: 'always'};

        renderWithContext(
            <PostAttributesChips
                post={post}
                channel={channel}
            />,
            makeState([field], []),
        );

        expect(screen.queryByTestId('post-attributes-chips')).not.toBeInTheDocument();
    });

    test('orders chips by sort_order, then by name', () => {
        const fields = [
            makeField({id: 'f_c', name: 'charlie', attrs: {options: OPTIONS, sort_order: 20}}),
            makeField({id: 'f_b', name: 'bravo'}),
            makeField({id: 'f_a', name: 'alpha', attrs: {options: OPTIONS, sort_order: 10}}),
        ];
        const values = fields.map((f, i) => makeValue({id: `v_${i}`, field_id: f.id, value: 'opt_secret'}));

        renderWithContext(
            <PostAttributesChips
                post={post}
                channel={channel}
            />,
            makeState(fields, values),
        );

        // Only the budget's worth renders, so the order is what decides which two.
        expect(screen.getByTestId('post-attributes-chips').textContent).toBe('SECRETSECRET+1');
    });

    describe('the chip budget', () => {
        test('renders two chips and +1 for three set single-valued fields', () => {
            const fields = [
                makeField({id: 'f_a', name: 'alpha', attrs: {options: OPTIONS, sort_order: 10}}),
                makeField({id: 'f_b', name: 'bravo', attrs: {options: OPTIONS, sort_order: 20}}),
                makeField({id: 'f_c', name: 'charlie', attrs: {options: OPTIONS, sort_order: 30}}),
            ];
            const values = [
                makeValue({id: 'v_a', field_id: 'f_a', value: 'opt_secret'}),
                makeValue({id: 'v_b', field_id: 'f_b', value: 'opt_unclassified'}),
                makeValue({id: 'v_c', field_id: 'f_c', value: 'opt_secret'}),
            ];

            renderWithContext(
                <PostAttributesChips
                    post={post}
                    channel={channel}
                />,
                makeState(fields, values),
            );

            expect(screen.getByText('SECRET')).toBeInTheDocument();
            expect(screen.getByText('UNCLASSIFIED')).toBeInTheDocument();
            expect(screen.getByTestId('post-attributes-overflow')).toHaveTextContent('+1');
        });

        // The badge counts what the row could not show, not what the channel
        // defines. A field the rules exclude was never a chip, so it must not reach
        // the budget: counting it would tell the user there are attributes to see
        // when the excluded ones are unset or deliberately hidden.
        test('leaves fields that earn no chip out of the overflow count', () => {
            const fields = [
                makeField({id: 'f_a', name: 'alpha', attrs: {options: OPTIONS, sort_order: 10}}),
                makeField({id: 'f_hidden', name: 'bravo', attrs: {options: OPTIONS, sort_order: 20, visibility: 'hidden'}}),
                makeField({id: 'f_b', name: 'charlie', attrs: {options: OPTIONS, sort_order: 30}}),
                makeField({id: 'f_unset', name: 'delta', attrs: {options: OPTIONS, sort_order: 40, visibility: 'when_set'}}),
                makeField({id: 'f_c', name: 'echo', attrs: {options: OPTIONS, sort_order: 50}}),
            ];
            const values = [
                makeValue({id: 'v_a', field_id: 'f_a', value: 'opt_secret'}),

                // Set, but its field is hidden.
                makeValue({id: 'v_hidden', field_id: 'f_hidden', value: 'opt_secret'}),
                makeValue({id: 'v_b', field_id: 'f_b', value: 'opt_unclassified'}),

                // when_set with nothing in it — a cleared attribute, which is a real
                // row rather than a missing one.
                makeValue({id: 'v_unset', field_id: 'f_unset', value: ''}),
                makeValue({id: 'v_c', field_id: 'f_c', value: 'opt_secret'}),
            ];

            renderWithContext(
                <PostAttributesChips
                    post={post}
                    channel={channel}
                />,
                makeState(fields, values),
            );

            // Five fields, three of which earn a chip: alpha and charlie render, echo
            // overflows. The hidden and the cleared one are not +2 on top of that.
            expect(screen.getByTestId('post-attributes-chips').textContent).toBe('SECRETUNCLASSIFIED+1');
        });

        test('renders no overflow badge when everything fits', () => {
            const fields = [
                makeField({id: 'f_a', name: 'alpha', attrs: {options: OPTIONS, sort_order: 10}}),
                makeField({id: 'f_b', name: 'bravo', attrs: {options: OPTIONS, sort_order: 20}}),
            ];
            const values = [
                makeValue({id: 'v_a', field_id: 'f_a', value: 'opt_secret'}),
                makeValue({id: 'v_b', field_id: 'f_b', value: 'opt_unclassified'}),
            ];

            renderWithContext(
                <PostAttributesChips
                    post={post}
                    channel={channel}
                />,
                makeState(fields, values),
            );

            expect(screen.queryByTestId('post-attributes-overflow')).not.toBeInTheDocument();
        });

        test('hides the overflow badge from assistive technology', () => {
            const fields = [
                makeField({id: 'f_a', name: 'alpha', attrs: {options: OPTIONS, sort_order: 10}}),
                makeField({id: 'f_b', name: 'bravo', attrs: {options: OPTIONS, sort_order: 20}}),
                makeField({id: 'f_c', name: 'charlie', attrs: {options: OPTIONS, sort_order: 30}}),
            ];
            const values = fields.map((f, i) => makeValue({id: `v_${i}`, field_id: f.id, value: 'opt_secret'}));

            renderWithContext(
                <PostAttributesChips
                    post={post}
                    channel={channel}
                />,
                makeState(fields, values),
            );

            expect(screen.getByTestId('post-attributes-overflow')).toHaveAttribute('aria-hidden', 'true');
        });
    });

    test('renders a value whose field is unknown as nothing, without throwing', () => {
        renderWithContext(
            <PostAttributesChips
                post={post}
                channel={channel}
            />,
            makeState([makeField()], [makeValue({field_id: 'deleted_field'})]),
        );

        expect(screen.queryByTestId('post-attributes-chips')).not.toBeInTheDocument();
    });
});
