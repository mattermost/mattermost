// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {FieldType, PropertyField, PropertyValue} from '@mattermost/types/properties';
import type {DeepPartial} from '@mattermost/types/utilities';

import {fireEvent, renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import PostAttributeChip from './post_attribute_chip';

const CHANNEL_ID = 'channel_id';
const TEAM_ID = 'team_id';
const LINKED_POST_ID = 'linked_post';

const OPTIONS = [
    {id: 'opt_secret', name: 'SECRET', color: '#f00'},
    {id: 'opt_open', name: 'OPEN', color: '#0f0'},
    {id: 'opt_draft', name: 'DRAFT', color: '#00f'},
];

function makeField(overrides: Partial<PropertyField> = {}): PropertyField {
    return {
        id: 'field_1',
        group_id: 'group_id',
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

function makeValue(value: unknown): PropertyValue<unknown> {
    return {
        id: 'value_1',
        target_id: 'post_id',
        target_type: 'post',
        group_id: 'group_id',
        field_id: 'field_1',
        value,
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: 'user_1',
        updated_by: 'user_1',
    };
}

function textField(subType?: string): PropertyField {
    return makeField({type: 'text' as FieldType, attrs: subType ? {subType} : {}});
}

const alice = TestHelper.getUserMock({id: 'user_alice', username: 'alice', last_picture_update: 7});

const state: DeepPartial<GlobalState> = {
    entities: {
        channels: {
            channels: {
                [CHANNEL_ID]: {id: CHANNEL_ID, team_id: TEAM_ID, type: 'O' as const, display_name: 'Town Square', name: 'town-square'},
            },
        },
        teams: {
            teams: {
                [TEAM_ID]: {id: TEAM_ID, display_name: 'Local Team', name: 'local-team', last_team_icon_update: 0},
            },
        },
        posts: {
            posts: {
                [LINKED_POST_ID]: {id: LINKED_POST_ID, channel_id: CHANNEL_ID, message: 'linked'},
            },
        },
        general: {config: {}, license: {}},
        preferences: {myPreferences: {}},
        users: {
            profiles: {[alice.id]: alice},
        },
    },
};

function renderChip(field: PropertyField, value: unknown, maxItems?: number) {
    return renderWithContext(
        <PostAttributeChip
            field={field}
            value={makeValue(value)}
            maxItems={maxItems}
            testIdScope='post_attributes.chip'
        />,
        state,
    );
}

describe('PostAttributeChip', () => {
    test('renders an option as a neutral chip, with no colour of its own', () => {
        renderChip(makeField(), 'opt_secret');

        const chip = screen.getByTestId('post_attributes.chip.select--text');
        expect(chip).toHaveTextContent('SECRET');
        expect(chip).toHaveClass('PostAttributeChip');
        expect(chip.style.backgroundColor).toBe('');
        expect(chip.style.color).toBe('');
    });

    test('renders one chip per multiselect option, capped by maxItems after resolving', () => {
        renderChip(makeField({type: 'multiselect'}), ['opt_secret', 'opt_gone', 'opt_open', 'opt_draft'], 2);

        // `opt_gone` names no option, so it neither draws nor spends one of the two slots.
        expect(screen.getAllByTestId('post_attributes.chip.select--text').map((chip) => chip.textContent)).toEqual(['SECRET', 'OPEN']);
    });

    // A post attribute keeps its options on the field, so one with none left had
    // every option deleted. The server sends an empty list when they go and no list
    // at all on later reads; either way the stored id must not show as raw text.
    test.each([
        ['an empty options list', {options: []}],
        ['no options list', {}],
    ])('renders nothing for a field with %s', (_, attrs) => {
        const {container} = renderChip(makeField({attrs}), 'opt_secret');

        expect(container).toBeEmptyDOMElement();
        expect(screen.queryByText('opt_secret')).not.toBeInTheDocument();
    });

    test('renders a user with the avatar and the profile name', () => {
        renderChip(makeField({type: 'user'}), alice.id);

        const chip = screen.getByTestId('post_attributes.chip.user');
        expect(chip.querySelector('img')).toHaveAttribute('src', expect.stringContaining(`/users/${alice.id}/image?_=7`));
        expect(chip).toHaveTextContent('alice');
    });

    test('renders an unknown user id without an avatar and without throwing', () => {
        renderChip(makeField({type: 'user'}), 'user_unknown');

        const chip = screen.getByTestId('post_attributes.chip.user');
        expect(chip.querySelector('img')).toBeNull();
    });

    test('renders one chip per multiuser id, capped by maxItems', () => {
        renderChip(makeField({type: 'multiuser'}), [alice.id, 'user_unknown', alice.id], 2);

        expect(screen.getAllByTestId('post_attributes.chip.user')).toHaveLength(2);
    });

    test('renders a long text value as one chip with the whole text, capped by width rather than cut', () => {
        const long = 'a long value that is well past what one chip can show in the thread sidebar';
        renderChip(textField(), long);

        const chip = screen.getByTestId('post_attributes.chip.text--text');
        expect(chip).toHaveTextContent(long);
        expect(chip).toHaveAttribute('title', long);
        expect(chip).toHaveClass('PostAttributeChip--text');
    });

    test('renders a channel value with its name and the channel icon', () => {
        renderChip(textField('channel'), CHANNEL_ID);

        const chip = screen.getByTestId('post_attributes.chip.channel');
        expect(chip).toHaveTextContent('Town Square');
        expect(chip.querySelector('svg')).not.toBeNull();
    });

    test('renders a channel the store does not know as deleted, as before', () => {
        renderChip(textField('channel'), 'channel_gone');

        expect(screen.getByTestId('post_attributes.chip.channel')).toHaveTextContent('Deleted channel ID: channel_gone');
    });

    test('renders a team value with its name, and no avatar when the team has no image', () => {
        renderChip(textField('team'), TEAM_ID);

        const chip = screen.getByTestId('post_attributes.chip.team');
        expect(chip).toHaveTextContent('Local Team');
        expect(chip.querySelector('img')).toBeNull();
    });

    test('renders a linked post as a short chip naming its channel, not a message preview', () => {
        renderChip(textField('post'), LINKED_POST_ID);

        const chip = screen.getByTestId('post_attributes.chip.post_preview');
        expect(chip).toHaveTextContent('Message in ~Town Square');
        expect(chip).not.toHaveTextContent('linked');
    });

    test('renders a linked post the store does not know as "Message"', () => {
        renderChip(textField('post'), 'post_gone');

        expect(screen.getByTestId('post_attributes.chip.post_preview')).toHaveTextContent('Message');
    });

    test('Enter and Space on a chip remove nothing: the chip takes no onRemove', () => {
        renderChip(makeField(), 'opt_secret');

        const chip = screen.getByTestId('post_attributes.chip.select--text');
        expect(chip).not.toHaveAttribute('role', 'button');
        expect(chip).not.toHaveAttribute('tabindex');
        expect(chip.querySelector('[data-chip-remove]')).toBeNull();

        fireEvent.keyDown(chip, {key: 'Enter'});
        fireEvent.keyDown(chip, {key: ' '});

        expect(screen.getByTestId('post_attributes.chip.select--text')).toBeInTheDocument();
    });
});
