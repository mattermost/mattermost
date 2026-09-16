// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {Post} from '@mattermost/types/posts';
import type {FieldType, PropertyField, PropertyValue} from '@mattermost/types/properties';

import {act, fireEvent, renderWithContext, screen} from 'tests/react_testing_utils';
import {RootHtmlPortalId} from 'utils/constants';

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

    // Reaching the same rule through the component: a value the renderer cannot
    // turn into a chip has to be indistinguishable from an unset one, right down
    // to the row not being mounted. Rendering the row would leave an empty
    // flex container with its own vertical margin under the message.
    describe('a value whose option no longer exists', () => {
        test('renders no row at all when it is the post only attribute', () => {
            const fields = [makeField({id: 'f_a', name: 'alpha'})];
            const values = [makeValue({id: 'v_a', field_id: 'f_a', value: 'opt_withdrawn'})];

            renderWithContext(
                <PostAttributesChips
                    post={post}
                    channel={channel}
                />,
                makeState(fields, values),
            );

            expect(screen.queryByTestId('post-attributes-chips')).not.toBeInTheDocument();
            expect(screen.queryByText('opt_withdrawn')).not.toBeInTheDocument();
        });

        test('does not show the stored value as raw text alongside a valid chip', () => {
            const fields = [
                makeField({id: 'f_a', name: 'alpha', attrs: {options: OPTIONS, sort_order: 10}}),
                makeField({id: 'f_gone', name: 'bravo', attrs: {options: OPTIONS, sort_order: 20}}),
            ];
            const values = [
                makeValue({id: 'v_a', field_id: 'f_a', value: 'opt_secret'}),
                makeValue({id: 'v_gone', field_id: 'f_gone', value: 'opt_withdrawn'}),
            ];

            renderWithContext(
                <PostAttributesChips
                    post={post}
                    channel={channel}
                />,
                makeState(fields, values),
            );

            expect(screen.getAllByTestId('select-property').map((chip) => chip.textContent)).toEqual(['SECRET']);
            expect(screen.queryByText('opt_withdrawn')).not.toBeInTheDocument();
            expect(screen.queryByTestId('post-attributes-overflow')).not.toBeInTheDocument();
        });

        test('drops only the unresolvable entries of a multiselect', () => {
            const fields = [makeField({id: 'f_tags', name: 'tags', type: 'multiselect', attrs: {options: OPTIONS, sort_order: 10}})];
            const values = [makeValue({id: 'v_tags', field_id: 'f_tags', value: ['opt_secret', 'opt_withdrawn']})];

            renderWithContext(
                <PostAttributesChips
                    post={post}
                    channel={channel}
                />,
                makeState(fields, values),
            );

            expect(screen.getAllByTestId('select-property').map((chip) => chip.textContent)).toEqual(['SECRET']);
            expect(screen.queryByTestId('post-attributes-overflow')).not.toBeInTheDocument();
        });
    });

    // `PropertyValueRenderer` draws nothing for these a set value of either type
    // must be indistinguishable from an unset one, right down to the row not mounting.
    // Otherwise the post carries an empty flex container with its own vertical margin.
    describe('a field type with no renderer', () => {
        test.each([
            ['date', 'date', 1642694400000],
            ['multiuser', 'multiuser', ['user_1', 'user_2']],
        ])('renders no row when a %s field is the post only attribute', (_label, type, raw) => {
            const fields = [makeField({id: 'f_a', name: 'alpha', type: type as FieldType})];
            const values = [makeValue({id: 'v_a', field_id: 'f_a', value: raw})];

            renderWithContext(
                <PostAttributesChips
                    post={post}
                    channel={channel}
                />,
                makeState(fields, values),
            );

            expect(screen.queryByTestId('post-attributes-chips')).not.toBeInTheDocument();
        });

        test('does not spend a chip slot or inflate +N', () => {
            const fields = [
                makeField({id: 'f_a', name: 'alpha', attrs: {options: OPTIONS, sort_order: 10}}),
                makeField({id: 'f_due', name: 'bravo', type: 'date', attrs: {sort_order: 20}}),
                makeField({id: 'f_b', name: 'charlie', attrs: {options: OPTIONS, sort_order: 30}}),
            ];
            const values = [
                makeValue({id: 'v_a', field_id: 'f_a', value: 'opt_secret'}),
                makeValue({id: 'v_due', field_id: 'f_due', value: 1642694400000}),
                makeValue({id: 'v_b', field_id: 'f_b', value: 'opt_unclassified'}),
            ];

            renderWithContext(
                <PostAttributesChips
                    post={post}
                    channel={channel}
                />,
                makeState(fields, values),
            );

            // Both selects fit. Counting the date would show only SECRET, with a
            // blank second slot and a +1 nobody could account for.
            expect(screen.getAllByTestId('select-property').map((chip) => chip.textContent)).toEqual(['SECRET', 'UNCLASSIFIED']);
            expect(screen.queryByTestId('post-attributes-overflow')).not.toBeInTheDocument();
        });
    });

    describe('the chip budget', () => {
        const MULTI_OPTIONS = [
            {id: 'opt_a', name: 'ALPHA', color: 'blue'},
            {id: 'opt_b', name: 'BRAVO', color: 'purple'},
            {id: 'opt_c', name: 'CHARLIE', color: 'pink'},
            {id: 'opt_d', name: 'DELTA', color: 'yellow'},
        ];

        // The budget is spent on chips, not on fields. Slicing the field list
        // instead would let one multiselect holding four entries render all four
        // inside the first slot, and the select behind it would vanish with no
        // badge to say so.
        test('renders two chips and +3 for a four-entry multiselect followed by a select', () => {
            const fields = [
                makeField({id: 'f_tags', name: 'tags', type: 'multiselect', attrs: {options: MULTI_OPTIONS, sort_order: 10}}),
                makeField({id: 'f_class', name: 'classification', attrs: {options: OPTIONS, sort_order: 20}}),
            ];
            const values = [
                makeValue({id: 'v_tags', field_id: 'f_tags', value: ['opt_a', 'opt_b', 'opt_c', 'opt_d']}),
                makeValue({id: 'v_class', field_id: 'f_class', value: 'opt_secret'}),
            ];

            renderWithContext(
                <PostAttributesChips
                    post={post}
                    channel={channel}
                />,
                makeState(fields, values),
            );

            expect(screen.getAllByTestId('select-property').map((chip) => chip.textContent)).toEqual(['ALPHA', 'BRAVO']);
            expect(screen.queryByText('SECRET')).not.toBeInTheDocument();

            // Two unshown entries of the multiselect, plus the whole select.
            expect(screen.getByTestId('post-attributes-overflow')).toHaveTextContent('+3');
        });

        test('spends the remaining slot on a multiselect that follows a select', () => {
            const fields = [
                makeField({id: 'f_class', name: 'classification', attrs: {options: OPTIONS, sort_order: 10}}),
                makeField({id: 'f_tags', name: 'tags', type: 'multiselect', attrs: {options: MULTI_OPTIONS, sort_order: 20}}),
            ];
            const values = [
                makeValue({id: 'v_class', field_id: 'f_class', value: 'opt_secret'}),
                makeValue({id: 'v_tags', field_id: 'f_tags', value: ['opt_a', 'opt_b', 'opt_c']}),
            ];

            renderWithContext(
                <PostAttributesChips
                    post={post}
                    channel={channel}
                />,
                makeState(fields, values),
            );

            expect(screen.getAllByTestId('select-property').map((chip) => chip.textContent)).toEqual(['SECRET', 'ALPHA']);
            expect(screen.getByTestId('post-attributes-overflow')).toHaveTextContent('+2');
        });

        test('renders a two-entry multiselect in full with no overflow badge', () => {
            const fields = [
                makeField({id: 'f_tags', name: 'tags', type: 'multiselect', attrs: {options: MULTI_OPTIONS, sort_order: 10}}),
            ];
            const values = [
                makeValue({id: 'v_tags', field_id: 'f_tags', value: ['opt_a', 'opt_b']}),
            ];

            renderWithContext(
                <PostAttributesChips
                    post={post}
                    channel={channel}
                />,
                makeState(fields, values),
            );

            expect(screen.getAllByTestId('select-property').map((chip) => chip.textContent)).toEqual(['ALPHA', 'BRAVO']);
            expect(screen.queryByTestId('post-attributes-overflow')).not.toBeInTheDocument();
        });

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

        test('names the overflow badge', () => {
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

            const badge = screen.getByTestId('post-attributes-overflow');

            expect(badge).not.toHaveAttribute('aria-hidden');

            // `role='img'` is what makes the label conforming: a bare span is `generic`,
            // which ARIA prohibits naming.
            expect(badge).toHaveAttribute('role', 'img');
            expect(badge).toHaveAccessibleName('1 more attribute');

            // The label replaces the visible text for assistive technology; it does not
            // change what is drawn.
            expect(badge).toHaveTextContent('+1');
        });

        // The count in the label has to track the badge, not the field total: four
        // fields, two chips drawn, two hidden.
        test('pluralises the label and counts hidden chips, not fields', () => {
            const fields = [
                makeField({id: 'f_a', name: 'alpha', attrs: {options: OPTIONS, sort_order: 10}}),
                makeField({id: 'f_b', name: 'bravo', attrs: {options: OPTIONS, sort_order: 20}}),
                makeField({id: 'f_c', name: 'charlie', attrs: {options: OPTIONS, sort_order: 30}}),
                makeField({id: 'f_d', name: 'delta', attrs: {options: OPTIONS, sort_order: 40}}),
            ];
            const values = fields.map((f, i) => makeValue({id: `v_${i}`, field_id: f.id, value: 'opt_secret'}));

            renderWithContext(
                <PostAttributesChips
                    post={post}
                    channel={channel}
                />,
                makeState(fields, values),
            );

            const badge = screen.getByTestId('post-attributes-overflow');

            expect(badge).toHaveAccessibleName('2 more attributes');
            expect(badge).toHaveTextContent('+2');
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

    // The server sets this when it was asked for a post's values and could not read
    // them. Saying so is the whole point: a post whose marking failed to load must not
    // look like a post that has no marking.
    describe('when the values could not be loaded', () => {
        const unavailablePost = {
            id: POST_ID,
            metadata: {property_values_unavailable: true},
        } as Post;

        test('says so instead of rendering chips', () => {
            renderWithContext(
                <PostAttributesChips
                    post={unavailablePost}
                    channel={channel}
                />,
                makeState([makeField()], [makeValue()]),
            );

            expect(screen.getByTestId('post-attributes-unavailable')).toBeInTheDocument();
            expect(screen.getByText('Attributes unavailable')).toBeInTheDocument();
            expect(screen.queryByText('SECRET')).not.toBeInTheDocument();
        });

        // Values left over from an earlier successful fetch are exactly what must not
        // show: they are the stale reading the marker exists to warn about.
        test('says so even with values still in the store', () => {
            renderWithContext(
                <PostAttributesChips
                    post={unavailablePost}
                    channel={channel}
                />,
                makeState([makeField()], [makeValue()]),
            );

            expect(screen.queryByTestId('post-attributes-chips')).not.toBeInTheDocument();
        });

        // The server only marks a post unavailable for a channel that has fields
        // so an empty field list here means this client has not loaded them or failed
        // to — not that the channel has no attributes. The marker is the more reliable
        // of the two.
        test('says so even before this client has loaded the fields', () => {
            renderWithContext(
                <PostAttributesChips
                    post={unavailablePost}
                    channel={channel}
                />,
                makeState([], []),
            );

            expect(screen.getByTestId('post-attributes-unavailable')).toBeInTheDocument();
        });

        test('stays quiet on a post that was hydrated successfully', () => {
            renderWithContext(
                <PostAttributesChips
                    post={{id: POST_ID, metadata: {property_values_unavailable: false}} as Post}
                    channel={channel}
                />,
                makeState([makeField()], [makeValue()]),
            );

            expect(screen.queryByTestId('post-attributes-unavailable')).not.toBeInTheDocument();
            expect(screen.getByText('SECRET')).toBeInTheDocument();
        });
    });

    describe('the hover trigger', () => {
        // The open delay is 300ms, so nothing here happens without controlling time.
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            act(() => {
                jest.runOnlyPendingTimers();
            });
            jest.useRealTimers();
        });

        function renderRow(postOverride: Post = post) {
            renderWithContext(
                <PostAttributesChips
                    post={postOverride}
                    channel={channel}
                />,
                makeState([makeField()], [makeValue()]),
            );
        }

        function rest() {
            act(() => {
                jest.advanceTimersByTime(300);
            });
        }

        test('opens the card once the pointer has rested on the row', () => {
            renderRow();

            expect(screen.queryByTestId('post-attributes-card')).not.toBeInTheDocument();

            fireEvent.mouseEnter(screen.getByTestId('post-attributes-chips'));

            // Still shut: the delay is what keeps the card from flashing as the
            // pointer crosses the message list on its way somewhere else.
            expect(screen.queryByTestId('post-attributes-card')).not.toBeInTheDocument();

            rest();

            expect(screen.getByTestId('post-attributes-card')).toBeInTheDocument();
        });

        test('closes the card when the pointer leaves the row', () => {
            renderRow();

            const row = screen.getByTestId('post-attributes-chips');

            fireEvent.mouseEnter(row);
            rest();
            expect(screen.getByTestId('post-attributes-card')).toBeInTheDocument();

            fireEvent.mouseLeave(row);

            expect(screen.queryByTestId('post-attributes-card')).not.toBeInTheDocument();
        });

        test('gives the unavailable row no card at all', () => {
            renderRow({id: POST_ID, metadata: {property_values_unavailable: true}} as Post);

            const row = screen.getByTestId('post-attributes-chips-unavailable');

            fireEvent.mouseEnter(row);
            fireEvent.mouseMove(row);
            rest();

            expect(screen.queryByTestId('post-attributes-card')).not.toBeInTheDocument();
        });
    });

    describe('the hover card', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            act(() => {
                jest.runOnlyPendingTimers();
            });
            jest.useRealTimers();
        });

        function open(fields: PropertyField[], values: Array<PropertyValue<unknown>>) {
            const rendered = renderWithContext(
                <PostAttributesChips
                    post={post}
                    channel={channel}
                />,
                makeState(fields, values),
            );

            fireEvent.mouseEnter(screen.getByTestId('post-attributes-chips'));
            act(() => {
                jest.advanceTimersByTime(300);
            });

            return rendered;
        }

        function cardRows() {
            return screen.getAllByRole('listitem').map((row) => row.textContent);
        }

        function chipLabels() {
            return screen.queryAllByTestId('select-property').map((chip) => chip.textContent);
        }

        function overflowCount() {
            const badge = screen.queryByTestId('post-attributes-overflow');
            return badge ? Number(badge.textContent!.replace('+', '')) : 0;
        }

        const MANY_OPTIONS = [
            {id: 'opt_a', name: 'ALPHA', color: 'blue'},
            {id: 'opt_b', name: 'BRAVO', color: 'purple'},
            {id: 'opt_c', name: 'CHARLIE', color: 'pink'},
        ];

        const FOUR_FIELDS = [
            makeField({id: 'f_a', name: 'alpha', attrs: {options: OPTIONS, sort_order: 10}}),
            makeField({id: 'f_b', name: 'bravo', attrs: {options: OPTIONS, sort_order: 20}}),
            makeField({id: 'f_c', name: 'charlie', attrs: {options: OPTIONS, sort_order: 30}}),
            makeField({id: 'f_d', name: 'delta', attrs: {options: OPTIONS, sort_order: 40}}),
        ];
        const FOUR_VALUES = [
            makeValue({id: 'v_a', field_id: 'f_a', value: 'opt_secret'}),
            makeValue({id: 'v_b', field_id: 'f_b', value: 'opt_unclassified'}),
            makeValue({id: 'v_c', field_id: 'f_c', value: 'opt_secret'}),
            makeValue({id: 'v_d', field_id: 'f_d', value: 'opt_unclassified'}),
        ];

        test('lists every attribute, including the ones the row could not fit', () => {
            open(FOUR_FIELDS, FOUR_VALUES);

            expect(chipLabels()).toEqual(['SECRET', 'UNCLASSIFIED']);
            expect(screen.getByTestId('post-attributes-overflow')).toHaveTextContent('+2');

            expect(cardRows()).toEqual([
                'alphaSECRET',
                'bravoUNCLASSIFIED',
                'charlieSECRET',
                'deltaUNCLASSIFIED',
            ]);
        });

        // Catches any future divergence between the row's filter and the card's.
        // Holds for single-valued fields, where one attribute is worth one chip.
        test.each([
            ['four attributes, two of them hidden behind the badge', FOUR_FIELDS, FOUR_VALUES, 4],
            ['three attributes', FOUR_FIELDS.slice(0, 3), FOUR_VALUES.slice(0, 3), 3],
            ['one attribute that fits', [makeField()], [makeValue()], 1],
        ])('lists as many rows as the row shows chips plus its overflow, for %s', (_name, fields, values, expected) => {
            open(fields, values);

            expect(cardRows()).toHaveLength(expected);
            expect(chipLabels().length + overflowCount()).toBe(expected);
        });

        // The one case where those two numbers part company, and it is not a
        // divergence: the budget is spent on chips, so a multiselect holding
        // three entries is worth three chips but is still one attribute.
        test('counts a multiselect as one row and several chips', () => {
            const fields = [
                makeField({id: 'f_tags', name: 'tags', type: 'multiselect', attrs: {options: MANY_OPTIONS, sort_order: 10}}),
            ];
            const values = [
                makeValue({id: 'v_tags', field_id: 'f_tags', value: ['opt_a', 'opt_b', 'opt_c']}),
            ];

            open(fields, values);

            expect(cardRows()).toEqual(['tagsALPHA, BRAVO, and CHARLIE']);
            expect(chipLabels()).toEqual(['ALPHA', 'BRAVO']);
            expect(overflowCount()).toBe(1);
        });

        test('leaves out a value whose option no longer exists, exactly as the badge does', () => {
            const fields = [
                makeField({id: 'f_a', name: 'alpha', attrs: {options: OPTIONS, sort_order: 10}}),
                makeField({id: 'f_stale', name: 'bravo', attrs: {options: OPTIONS, sort_order: 20}}),
            ];
            const values = [
                makeValue({id: 'v_a', field_id: 'f_a', value: 'opt_secret'}),
                makeValue({id: 'v_stale', field_id: 'f_stale', value: 'opt_deleted'}),
            ];

            open(fields, values);

            expect(cardRows()).toEqual(['alphaSECRET']);
            expect(screen.queryByTestId('post-attributes-overflow')).not.toBeInTheDocument();
        });

        test('carries no role and no accessible name', () => {
            open([makeField()], [makeValue()]);

            const card = screen.getByTestId('post-attributes-card');

            expect(card).not.toHaveAttribute('role');
            expect(card).not.toHaveAttribute('aria-label');
            expect(card).not.toHaveAttribute('aria-labelledby');
            expect(card).not.toHaveAttribute('aria-hidden');
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        // Portalled so it escapes the post's stacking and overflow contexts.
        test('mounts outside the chip row', () => {
            open([makeField()], [makeValue()]);

            const card = screen.getByTestId('post-attributes-card');

            expect(screen.getByTestId('post-attributes-chips')).not.toContainElement(card);
            expect(document.getElementById(RootHtmlPortalId)).toContainElement(card);
        });
    });
});
