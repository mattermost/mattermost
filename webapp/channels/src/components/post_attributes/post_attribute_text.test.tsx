// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {FieldType, PropertyField, PropertyValue} from '@mattermost/types/properties';
import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import PostAttributeText from './post_attribute_text';

const alice = TestHelper.getUserMock({id: 'user_alice', username: 'alice'});
const bob = TestHelper.getUserMock({id: 'user_bob', username: 'bob'});

const baseState: DeepPartial<GlobalState> = {
    entities: {
        users: {
            profiles: {
                [alice.id]: alice,
                [bob.id]: bob,
            },
        },
        general: {
            config: {},
            license: {},
        },
        preferences: {
            myPreferences: {},
        },
    },
};

function makeField(overrides: Partial<PropertyField> = {}): PropertyField {
    return {
        id: 'field_1',
        group_id: 'group_id',
        name: 'reviewers',
        type: 'multiuser',
        object_type: 'post',
        target_type: 'channel',
        target_id: 'channel_id',
        attrs: {},
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

function renderText(field: Partial<PropertyField>, value: unknown, locale = 'en') {
    return renderWithContext(
        <div data-testid='holder'>
            <PostAttributeText
                field={makeField(field)}
                value={makeValue(value)}
            />
        </div>,
        baseState,
        {locale},
    );
}

describe('PostAttributeText', () => {
    describe('multiuser', () => {
        test('renders every name, joined for the locale', () => {
            renderText({}, [alice.id, bob.id]);

            expect(screen.getByTestId('holder')).toHaveTextContent('alice and bob');
        });

        test('joins with the Japanese separator under ja', () => {
            renderText({}, [alice.id, bob.id], 'ja');

            expect(screen.getByTestId('holder')).toHaveTextContent('alice、bob');
        });

        test('renders a single entry with no separator', () => {
            renderText({}, [alice.id]);

            expect(screen.getByTestId('holder')).toHaveTextContent('alice');
        });

        test('skips empty entries', () => {
            renderText({}, [alice.id, '']);

            expect(screen.getByTestId('holder')).toHaveTextContent('alice');
            expect(screen.getByTestId('holder').textContent).toBe('alice');
        });
    });

    test('renders a user as the display name alone', () => {
        renderText({type: 'user' as FieldType}, alice.id);

        expect(screen.getByTestId('holder').textContent).toBe('alice');
    });

    test('renders nothing for a user whose profile has not arrived', () => {
        // `displayUsername`'s "Someone" fallback is suppressed: a placeholder
        // name is worse than a blank in a card that reports what a post carries.
        renderText({type: 'user' as FieldType}, 'user_missing');

        expect(screen.getByTestId('holder').textContent).toBe('');
    });

    test('renders a plain text value', () => {
        renderText({type: 'text' as FieldType, attrs: {}}, 'MM-12345');

        expect(screen.getByTestId('holder').textContent).toBe('MM-12345');
    });

    test('renders nothing for a text subtype that stores an identifier', () => {
        renderText({type: 'text' as FieldType, attrs: {subType: 'post'}}, 'some_post_id');

        expect(screen.getByTestId('holder').textContent).toBe('');
    });

    test('renders nothing for a type with no plain-text form', () => {
        renderText({type: 'date' as FieldType}, 1700000000000);

        expect(screen.getByTestId('holder').textContent).toBe('');
    });
});
