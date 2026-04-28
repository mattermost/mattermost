// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyField} from '@mattermost/types/properties';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import {renderPropertyValue} from './render_property_value';

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

describe('components/property_value_editor/renderPropertyValue', () => {
    test('returns null for undefined value', () => {
        const result = renderPropertyValue(makeField(), undefined);
        expect(result).toBeNull();
    });

    test('returns null for null value', () => {
        expect(renderPropertyValue(makeField(), null)).toBeNull();
    });

    test('returns null for empty string', () => {
        expect(renderPropertyValue(makeField(), '')).toBeNull();
    });

    test('returns null for empty array', () => {
        expect(renderPropertyValue(makeField({type: 'multiselect'}), [])).toBeNull();
    });

    test('returns trimmed text for text fields', () => {
        renderWithContext(
            <span data-testid='wrap'>{renderPropertyValue(makeField(), '  hello  ')}</span>,
        );
        expect(screen.getByTestId('wrap')).toHaveTextContent('hello');
    });

    test('renders a colored option pill for select fields', () => {
        const field = makeField({
            type: 'select',
            attrs: {
                options: [
                    {id: 'opt1', name: 'Open', color: '#ff00aa'},
                ],
            },
        });
        const {container} = renderWithContext(
            <span data-testid='wrap'>{renderPropertyValue(field, 'opt1')}</span>,
        );
        const pill = container.querySelector('.property-pill') as HTMLElement | null;
        expect(pill).not.toBeNull();
        expect(pill?.textContent).toBe('Open');
        // jsdom normalizes hex to rgb
        expect(pill?.style.backgroundColor).toBe('rgb(255, 0, 170)');
    });

    test('renders multiple pills for multiselect fields', () => {
        const field = makeField({
            type: 'multiselect',
            attrs: {
                options: [
                    {id: 'opt1', name: 'Bug', color: '#aaa'},
                    {id: 'opt2', name: 'Urgent', color: '#bbb'},
                    {id: 'opt3', name: 'Other', color: '#ccc'},
                ],
            },
        });
        const {container} = renderWithContext(
            <span data-testid='wrap'>{renderPropertyValue(field, ['opt1', 'opt2'])}</span>,
        );
        const pills = container.querySelectorAll('.property-pill');
        expect(pills).toHaveLength(2);
        expect(pills[0].textContent).toBe('Bug');
        expect(pills[1].textContent).toBe('Urgent');
    });

    test('renders user display name for user fields', () => {
        const field = makeField({type: 'user'});
        const initialState = {
            entities: {
                users: {
                    profiles: {
                        u42: {
                            id: 'u42',
                            username: 'alice',
                            first_name: 'Alice',
                            last_name: 'Liddell',
                            nickname: '',
                            last_picture_update: 0,
                        },
                    },
                },
                general: {
                    config: {TeammateNameDisplay: 'username'},
                },
            },
        };
        renderWithContext(
            <span data-testid='wrap'>{renderPropertyValue(field, 'u42')}</span>,
            initialState as any,
        );
        expect(screen.getByTestId('wrap')).toHaveTextContent('alice');
    });

    test('renders a fallback for unknown user ids', () => {
        const field = makeField({type: 'user'});
        renderWithContext(
            <span data-testid='wrap'>{renderPropertyValue(field, 'unknown-user')}</span>,
        );
        // we render the raw user id when unknown
        expect(screen.getByTestId('wrap')).toHaveTextContent('unknown-user');
    });

    test('renders a formatted date for date fields', () => {
        const field = makeField({type: 'date'});
        const {container} = renderWithContext(
            <span data-testid='wrap'>{renderPropertyValue(field, '2024-05-15')}</span>,
        );
        const text = container.querySelector('[data-testid="wrap"]')?.textContent ?? '';
        expect(text.length).toBeGreaterThan(0);
        expect(text).not.toBe('2024-05-15'); // should be formatted, not raw ISO
    });

    test('returns null for an unknown type', () => {
        const field = makeField({type: 'mystery' as PropertyField['type']});
        expect(renderPropertyValue(field, 'whatever')).toBeNull();
    });
});
