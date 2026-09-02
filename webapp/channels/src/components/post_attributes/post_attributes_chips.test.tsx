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

function makeField(overrides: Partial<PropertyField> = {}): PropertyField {
    return {
        id: 'field_1',
        group_id: GROUP_ID,
        name: 'classification',
        type: 'select',
        object_type: 'post',
        target_type: 'channel',
        target_id: CHANNEL_ID,
        attrs: {
            options: [
                {id: 'opt_secret', name: 'SECRET', color: 'red'},
                {id: 'opt_unclassified', name: 'UNCLASSIFIED', color: 'green'},
            ],
        },
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
